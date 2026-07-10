#!/usr/bin/env python3
"""
Interfaz web del Generador de Presupuestos – Grupo Europa
Uso: python app.py  → abre http://localhost:5000 en el navegador
"""
import json
import sys
from datetime import datetime
from pathlib import Path

from flask import (Flask, abort, jsonify, redirect, render_template,
                   request, send_file, url_for)

from core.docx_generator import DocxGenerator
from core.excel_generator import ExcelGenerator
from core.html_generator import HtmlGenerator
from core.pdf_converter import PdfConverter
from utils.tarifa_loader import TarifaLoader

BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
TARIFAS_DIR = BASE_DIR / "tarifas"
SALIDAS_DIR = BASE_DIR / "salidas"
TARIFAS_FILE = TARIFAS_DIR / "TARIFAS.xlsx"

SALIDAS_DIR.mkdir(exist_ok=True)

TEMPLATE_FILES = {
    "obra_1":         "MODELO_MAESTRO_1OPCION.docx",
    "obra_2":         "MODELO_MAESTRO_2OPCIONES.docx",
    "desatasco":      "MODELO_DESATASCO.docx",
    "cctv_bajante":   "MODELO_CCTV_BAJANTE.docx",
    "inspeccion_zum": "MODELO_INSPECCION_ZUM.docx",
    "limpieza_aerea": "MODELO_LIMPIEZA_AEREA.docx",
    "fresador":       "MODELO_FRESADOR.docx",
    "robot_limpieza": "MODELO_ROBOT_LIMPIEZA.docx",
    "fuga_agua":      "MODELO_FUGA_AGUA.docx",
    "vaciado_fosa":   "MODELO_VACIADO_FOSA.docx",
}

app = Flask(__name__, template_folder="web_templates")
app.secret_key = "grupo-europa-presupuestos"

_tarifas: TarifaLoader | None = None


def get_tarifas() -> TarifaLoader:
    global _tarifas
    if _tarifas is None:
        _tarifas = TarifaLoader(TARIFAS_FILE)
    return _tarifas


def fmt_euro(amount: float) -> str:
    s = f"{amount:,.2f} €"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def fmt_euro_plain(amount: float) -> str:
    """Format without € symbol (for template placeholders that include it)."""
    s = f"{amount:,.2f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def _parse_fecha(fecha_raw: str):
    try:
        dt = datetime.strptime(fecha_raw, "%Y-%m-%d")
        meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
                 "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
        fecha_larga = f"{dt.day} de {meses[dt.month - 1]} de {dt.year}"
        fecha_display = dt.strftime("%d/%m/%Y")
    except ValueError:
        fecha_larga = fecha_raw
        fecha_display = fecha_raw
    return fecha_larga, fecha_display


def _fval(f, name: str, default: float = 0.0) -> float:
    try:
        return float(f.get(name, str(default)).replace(",", "."))
    except ValueError:
        return default


def _parse_items(f, prefix: str = "item") -> list[dict]:
    items = []
    idx = 0
    while True:
        desc = f.get(f"{prefix}_desc_{idx}", "").strip()
        if not desc:
            break
        qty = _fval(f, f"{prefix}_qty_{idx}", 1.0)
        price = _fval(f, f"{prefix}_price_{idx}", 0.0)
        unit = f.get(f"{prefix}_unit_{idx}", "PA").strip() or "PA"
        items.append({
            "descripcion": desc,
            "unidad": unit,
            "cantidad": qty,
            "precio_unitario": price,
            "importe": round(qty * price, 2),
        })
        idx += 1
    return items


def _svc_line(f, prefix: str) -> tuple[dict, float]:
    """Parse UDS/PRECIO for a service line, return data dict + importe."""
    uds = _fval(f, f"{prefix.lower()}_uds", 1.0)
    precio = _fval(f, f"{prefix.lower()}_precio", 0.0)
    importe = round(uds * precio, 2)
    data = {
        f"[[{prefix}_UDS]]":     _fmt_qty_str(uds),
        f"[[{prefix}_PRECIO]]":  fmt_euro_plain(precio),
        f"[[{prefix}_IMPORTE]]": fmt_euro_plain(importe),
    }
    return data, importe


def _fmt_qty_str(qty: float) -> str:
    if qty == int(qty):
        return str(int(qty))
    return f"{qty:.2f}".replace(".", ",")


def _build_common_data(f) -> tuple[dict, str, str, str, str]:
    """Returns (data_dict, num_contrato, fecha_larga, obra, servicio)."""
    fecha_raw = f.get("fecha_contrato", datetime.now().strftime("%Y-%m-%d"))
    fecha_larga, fecha_display = _parse_fecha(fecha_raw)
    num_contrato = f.get("num_contrato", "").strip()
    obra = f.get("obra", "").strip()
    servicio = f.get("servicio", "").strip()
    data = {
        "[[CONTRATO_NUM]]":          num_contrato,
        "[[NUMERO_PRESUPUESTO]]":    num_contrato,
        "[[FECHA_CONTRATO]]":        fecha_display,
        "[[FECHA_LARGA]]":           fecha_larga,
        "[[OBRA_COMUNIDAD]]":        obra,
        "[[SERVICIO_COMUNIDAD]]":    servicio,
        "[[CLIENTE_NOMBRE]]":        f.get("cliente_nombre", "").strip(),
        "[[CLIENTE_DIRECCION]]":     f.get("cliente_dir", "").strip(),
        "[[CLIENTE_TELEFONO]]":      f.get("cliente_tel", "").strip(),
        "[[CLIENTE_EMAIL]]":         f.get("cliente_email", "").strip(),
        "[[CLIENTE_CORREO ELECTRONICO]]": f.get("cliente_email", "").strip(),
        "[[PROVINCIA]]":             f.get("provincia", "Madrid").strip(),
        "[[ADMINISTRACION]]":        f.get("administracion", "").strip() or "—",
        "[[ADMINISTRACION_TELEFONO]]":          f.get("admin_tel", "").strip(),
        "[[ADMINISTRACION_CORREO ELECTRONICO]]": f.get("admin_email", "").strip(),
    }
    return data, num_contrato, fecha_larga, obra, servicio


def _build_obra_data(f, total_sin_iva: float, fecha_larga: str) -> dict:
    return {
        "[[INFORME_TECNICO]]":         f.get("informe", "").strip(),
        "[[SOLUCION_ADOPTAR]]":        f.get("solucion", "").strip(),
        "[[MEMORIA_TECNICA]]":         f.get("memoria", "").strip(),
        "[[TOTAL_PRESUPUESTO]]":       fmt_euro_plain(total_sin_iva),
        "[[RESUMEN_VALORACION]]":      fmt_euro_plain(total_sin_iva),
        "[[FORMA_PAGO]]":              f.get("forma_pago", "50% inicio, 50% finalización").strip(),
        "[[PLAZO_EJECUCION]]":         f.get("plazo", "30").strip(),
        "[[FECHA_INICIO_OBRA_LARGA]]": fecha_larga,
        "[[FECHA_FIN_OBRA]]":          f.get("fecha_fin_obra", "").strip(),
    }


def _build_obra_2_extra(f, total_a: float, total_b: float) -> dict:
    return {
        "[[TIPO_OPCION]]":           f.get("tipo_opcion", "").strip(),
        "[[MEMORIA_TRADICIONAL]]":   f.get("memoria_tradicional", "").strip(),
        "[[MEMORIA_MULTILINER]]":    f.get("memoria_multiliner", "").strip(),
        "[[IMPORTE_TOTAL_OPCION_A]]": fmt_euro_plain(total_a),
        "[[IMPORTE_TOTAL_OPCION_B]]": fmt_euro_plain(total_b),
        "[[FIRMANTE_NOMBRE]]":       f.get("firmante_nombre", "").strip(),
        "[[FIRMANTE_CARGO]]":        f.get("firmante_cargo", "").strip(),
        "[[FIRMANTE_DNI]]":          f.get("firmante_dni", "").strip(),
        "[[FIRMANTE_FECHA]]":        f.get("firmante_fecha", "").strip(),
    }


def _build_service_data(f, tipo: str, base_data: dict) -> tuple[dict, float]:
    data = dict(base_data)
    total = 0.0

    if tipo == "desatasco":
        for prefix in ["CAMION", "CAMION_DESP", "TAPA", "INODORO", "CATA"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp

    elif tipo == "cctv_bajante":
        for prefix in ["CCTV", "CCTV_DESP", "TAPA", "INODORO", "CATA"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp

    elif tipo == "inspeccion_zum":
        for prefix in ["CCTV", "CCTV_DESP"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp

    elif tipo == "limpieza_aerea":
        for prefix in ["CAMION", "CAMION_DESP", "OCUPACION", "MEDIOS", "TAPA"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp
        data["[[HORAS_ESTIMADAS]]"] = f.get("horas_estimadas", "").strip()
        data["[[TIEMPO_ESTIMADO]]"] = f.get("tiempo_estimado", "").strip()

    elif tipo == "fresador":
        for prefix in ["FRESADOR", "FRESADOR_DESP", "CAMION", "CAMION_DESP", "MEDIOS"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp
        data["[[HORAS_ESTIMADAS]]"] = f.get("horas_estimadas", "").strip()

    elif tipo == "robot_limpieza":
        for prefix in ["CCTV", "CCTV_DESP", "CAMION", "CAMION_DESP", "OCUPACION", "MEDIOS", "LOCALIZACION"]:
            d, imp = _svc_line(f, prefix)
            data.update(d)
            total += imp
        data["[[HORAS_ESTIMADAS]]"] = f.get("horas_estimadas", "").strip()
        data["[[TIEMPO_ESTIMADO]]"] = f.get("tiempo_estimado", "").strip()

    elif tipo == "fuga_agua":
        data["[[LOCALIZACION_SERVICIO]]"] = f.get("localizacion_servicio", "").strip()
        p1 = _fval(f, "precio_localizacion", 0.0)
        p2 = _fval(f, "precio_hora_adicional", 0.0)
        p3 = _fval(f, "precio_bombona", 0.0)
        data["[[PRECIO_LOCALIZACION_FUGA]]"] = fmt_euro_plain(p1)
        data["[[PRECIO_HORA_ADICIONAL]]"]    = fmt_euro_plain(p2)
        data["[[PRECIO_BOMBONA_GAS]]"]       = fmt_euro_plain(p3)
        total = p1

    elif tipo == "vaciado_fosa":
        data["[[VALIDEZ_OFERTA]]"] = f.get("validez_oferta", "30 días").strip()
        for field in ["UD_DESPLAZAMIENTO", "UD_SUCCION", "UD_LIMPIEZA", "UD_DESCARGA", "UD_RESIDUO"]:
            data[f"[[{field}]]"] = f.get(field.lower(), "").strip()

    data["[[IMPORTE_TOTAL_ESTIMADO]]"] = fmt_euro_plain(total)
    return data, total


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    today = datetime.now().strftime("%Y-%m-%d")
    missing = [name for name in TEMPLATE_FILES.values()
               if not (TEMPLATES_DIR / name).exists()]
    return render_template("index.html", today=today, missing_templates=missing)


@app.route("/api/tarifa/<code>")
def api_tarifa(code: str):
    item = get_tarifas().lookup(code)
    if not item:
        return jsonify({}), 404
    return jsonify(item)


@app.route("/api/tarifas")
def api_tarifas_list():
    return jsonify(get_tarifas().all_codes())


@app.route("/generar", methods=["POST"])
def generar():
    f = request.form
    tipo = f.get("tipo_modelo", "obra_1")

    common_data, num_contrato, fecha_larga, obra, servicio = _build_common_data(f)

    items = items_a = items_b = None
    total_sin_iva = total_a = total_b = total_estimado = 0.0

    if tipo == "obra_1":
        items = _parse_items(f, "item")
        if not items:
            return redirect(url_for("index"))
        total_sin_iva = sum(i["importe"] for i in items)
        data = {**common_data, **_build_obra_data(f, total_sin_iva, fecha_larga)}

    elif tipo == "obra_2":
        items_a = _parse_items(f, "item_a")
        items_b = _parse_items(f, "item_b")
        if not items_a and not items_b:
            return redirect(url_for("index"))
        total_a = sum(i["importe"] for i in (items_a or []))
        total_b = sum(i["importe"] for i in (items_b or []))
        total_sin_iva = max(total_a, total_b)
        data = {
            **common_data,
            **_build_obra_data(f, total_sin_iva, fecha_larga),
            **_build_obra_2_extra(f, total_a, total_b),
        }

    else:
        data, total_estimado = _build_service_data(f, tipo, common_data)

    # ── File naming ───────────────────────────────────────────────────────────
    num_safe = num_contrato.replace("/", "-").replace("\\", "-")
    label = (servicio or obra)[:40].upper().replace("/", "-").replace("\\", "-")
    stem = f"{num_safe}- {label} - PRESUPUESTO"
    folder_name = stem[:80].rstrip(". ")
    output_dir = SALIDAS_DIR / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    generated = {}
    errors = []

    # DOCX ────────────────────────────────────────────────────────────────────
    template_file = TEMPLATES_DIR / TEMPLATE_FILES.get(tipo, "MODELO_MAESTRO_1OPCION.docx")
    if template_file.exists():
        try:
            docx_path = output_dir / f"{stem}.docx"
            DocxGenerator(template_file).generate(
                docx_path, data,
                items=items, items_a=items_a, items_b=items_b,
            )
            generated["docx"] = docx_path.relative_to(SALIDAS_DIR).as_posix()
        except Exception as e:
            errors.append(f"DOCX: {e}")
    else:
        errors.append(f"Plantilla no encontrada: {template_file.name} — ejecuta download_templates.py")

    # Excel + HTML only for obra types (require items list)
    if tipo in ("obra_1", "obra_2"):
        items_for_excel = items or items_a or []
        try:
            xlsx_path = output_dir / f"{stem}.xlsx"
            ExcelGenerator().generate(xlsx_path, data, items_for_excel)
            generated["xlsx"] = xlsx_path.relative_to(SALIDAS_DIR).as_posix()
        except Exception as e:
            errors.append(f"Excel: {e}")

        try:
            html_path = output_dir / f"{stem}_Visor.html"
            HtmlGenerator().generate(html_path, data, items_for_excel)
            generated["html"] = html_path.relative_to(SALIDAS_DIR).as_posix()
        except Exception as e:
            errors.append(f"HTML: {e}")

    # PDF ─────────────────────────────────────────────────────────────────────
    try:
        docx_for_pdf = SALIDAS_DIR / generated["docx"] if "docx" in generated else None
        html_for_pdf = SALIDAS_DIR / generated["html"] if "html" in generated else None
        pdf_path = PdfConverter().convert(
            docx_for_pdf or output_dir / f"{stem}.docx",
            output_dir,
            html_fallback_path=html_for_pdf,
        )
        if pdf_path:
            generated["pdf"] = pdf_path.relative_to(SALIDAS_DIR).as_posix()
    except Exception as e:
        errors.append(f"PDF: {e}")

    return render_template(
        "resultado.html",
        tipo_modelo=tipo,
        num_contrato=num_contrato,
        obra=obra,
        servicio=servicio,
        cliente=data.get("[[CLIENTE_NOMBRE]]", ""),
        fecha=fecha_larga,
        # obra types
        items=items or [],
        items_a=items_a or [],
        items_b=items_b or [],
        total_sin_iva=fmt_euro(total_sin_iva),
        total_con_iva=fmt_euro(total_sin_iva * 1.21),
        total_a=fmt_euro(total_a),
        total_b=fmt_euro(total_b),
        # service types
        total_estimado=fmt_euro(total_estimado),
        # meta
        generated=generated,
        errors=errors,
        folder_name=folder_name,
    )


@app.route("/descargar/<path:rel_path>")
def descargar(rel_path: str):
    full = SALIDAS_DIR / rel_path
    if not full.exists() or not full.is_file():
        abort(404)
    try:
        full.resolve().relative_to(SALIDAS_DIR.resolve())
    except ValueError:
        abort(403)
    return send_file(full, as_attachment=True, download_name=full.name)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    is_local = port == 5000

    if is_local:
        import webbrowser, threading, time

        def open_browser():
            time.sleep(1.2)
            webbrowser.open(f"http://localhost:{port}")

        threading.Thread(target=open_browser, daemon=True).start()
        print(f"\n  Generador de Presupuestos – Grupo Europa")
        print(f"  Abriendo en el navegador: http://localhost:{port}")
        print(f"  (Para parar: pulsa Ctrl+C)\n")

    app.run(host="0.0.0.0", port=port, debug=False)
