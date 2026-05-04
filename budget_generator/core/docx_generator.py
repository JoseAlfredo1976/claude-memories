"""
DOCX generation: fills [[VARIABLE]] placeholders in the Word template.
Handles:
  - Variables split across XML runs
  - Headers and footers (word/header*.xml, word/footer*.xml)
  - Multiple line items in mediciones tables (1 or 2 opciones)
  - Multi-paragraph text fields
"""
import re
import zipfile
from copy import deepcopy
from io import BytesIO
from pathlib import Path

from lxml import etree

WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WNS}}}"

MULTILINE_VARS = {"[[INFORME_TECNICO]]", "[[SOLUCION_ADOPTAR]]", "[[MEMORIA_TECNICA]]",
                  "[[MEMORIA_TRADICIONAL]]", "[[MEMORIA_MULTILINER]]"}


def _w(tag: str) -> str:
    return f"{W}{tag}"


class DocxGenerator:
    def __init__(self, template_path: Path):
        self.template_path = template_path

    def generate(self, output_path: Path, data: dict,
                 items: list[dict] | None = None,
                 items_a: list[dict] | None = None,
                 items_b: list[dict] | None = None):
        with open(self.template_path, "rb") as f:
            buf = BytesIO(f.read())

        out_buf = BytesIO()
        with zipfile.ZipFile(buf, "r") as zin, zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
            for zi in zin.infolist():
                raw = zin.read(zi.filename)
                name = zi.filename
                if name == "word/document.xml":
                    raw = self._process_document_xml(raw, data, items, items_a, items_b)
                elif (name.startswith("word/header") or name.startswith("word/footer")) and name.endswith(".xml"):
                    raw = self._process_simple_xml(raw, data)
                zout.writestr(zi, raw)

        output_path.write_bytes(out_buf.getvalue())

    # ------------------------------------------------------------------
    # Per-part processors
    # ------------------------------------------------------------------
    def _process_document_xml(self, raw: bytes, data: dict,
                               items, items_a, items_b) -> bytes:
        root = etree.fromstring(raw)
        self._merge_split_placeholders(root)
        for para in root.iter(_w("p")):
            self._replace_in_paragraph(para, data)
        if items:
            self._expand_mediciones_table(root, items, "[[DESCRIPCION_PARTIDA]]")
        if items_a:
            self._expand_mediciones_table(root, items_a, "[[DESCRIPCION_PARTIDA_A]]")
        if items_b:
            self._expand_mediciones_table(root, items_b, "[[DESCRIPCION_PARTIDA_B]]")
        return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

    def _process_simple_xml(self, raw: bytes, data: dict) -> bytes:
        try:
            root = etree.fromstring(raw)
        except etree.XMLSyntaxError:
            return raw
        self._merge_split_placeholders(root)
        for para in root.iter(_w("p")):
            self._replace_in_paragraph(para, data)
        return etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

    # ------------------------------------------------------------------
    # Step 1: merge runs that together form [[VARIABLE]]
    # ------------------------------------------------------------------
    def _merge_split_placeholders(self, root):
        for para in root.iter(_w("p")):
            runs = para.findall(f".//{_w('r')}")
            if not runs:
                continue
            full_text = "".join(
                (t.text or "") for r in runs for t in r.iter(_w("t"))
            )
            if "[[" not in full_text:
                continue
            self._consolidate_para_runs(para)

    def _consolidate_para_runs(self, para):
        runs = list(para.findall(_w("r")))
        if len(runs) <= 1:
            return

        full_text = "".join(
            (t.text or "") for r in runs for t in r.iter(_w("t"))
        )
        if not re.search(r"\[\[[A-Z_]+\]\]", full_text):
            combined = re.sub(r"\s", "", full_text)
            if not re.search(r"\[\[[A-Z_]+\]\]", combined):
                return

        first_run = runs[0]
        rpr = first_run.find(_w("rPr"))

        new_r = etree.SubElement(para, _w("r"))
        if rpr is not None:
            new_r.insert(0, deepcopy(rpr))
        t_elem = etree.SubElement(new_r, _w("t"))
        t_elem.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
        t_elem.text = full_text

        para_children = list(para)
        first_run_idx = para_children.index(first_run)

        for r in runs:
            para.remove(r)
        para.insert(first_run_idx, new_r)

    # ------------------------------------------------------------------
    # Step 2: replace variables in a paragraph
    # ------------------------------------------------------------------
    def _replace_in_paragraph(self, para, data: dict):
        for run in para.findall(_w("r")):
            for t in run.findall(_w("t")):
                if t.text and "[[" in t.text:
                    new_text = t.text
                    for placeholder, value in data.items():
                        if placeholder in new_text:
                            new_text = new_text.replace(placeholder, str(value) if value is not None else "")
                    t.text = new_text

    # ------------------------------------------------------------------
    # Step 3: expand mediciones table
    # ------------------------------------------------------------------
    def _expand_mediciones_table(self, root, items: list[dict], placeholder: str):
        if not items:
            return

        for tbl in root.iter(_w("tbl")):
            template_tr = None
            for tr in tbl.findall(_w("tr")):
                row_text = "".join(
                    (t.text or "") for t in tr.iter(_w("t"))
                )
                if placeholder in row_text:
                    template_tr = tr
                    break

            if template_tr is None:
                continue

            parent = template_tr.getparent()
            idx = list(parent).index(template_tr)

            for i, item in enumerate(items):
                new_tr = deepcopy(template_tr)
                self._fill_item_row(new_tr, item)
                parent.insert(idx + i, new_tr)

            parent.remove(template_tr)

    def _fill_item_row(self, tr, item: dict):
        cells = tr.findall(f".//{_w('tc')}")
        # Column order: DESCRIPCION | UD | UDS/CANTIDAD | PRECIO_UNITARIO | IMPORTE
        mapping = {
            0: item.get("descripcion", ""),
            1: item.get("unidad", "PA"),
            2: _fmt_qty(item.get("cantidad", 1)),
            3: _fmt_euro(item.get("precio_unitario", 0)),
            4: _fmt_euro(item.get("importe", 0)),
        }
        for col_idx, cell in enumerate(cells):
            if col_idx not in mapping:
                continue
            for t in cell.iter(_w("t")):
                text = t.text or ""
                if "[[" in text:
                    t.text = mapping[col_idx]


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _fmt_euro(amount: float) -> str:
    s = f"{amount:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_qty(qty: float) -> str:
    if qty == int(qty):
        return str(int(qty))
    return str(qty).replace(".", ",")
