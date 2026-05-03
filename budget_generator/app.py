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
TEMPLATE_FILE = TEMPLATES_DIR / "MODELO_MAESTRO.docx"
TARIFAS_FILE = TARIFAS_DIR / "TARIFAS.xlsx"

SALIDAS_DIR.mkdir(exist_ok=True)

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


# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    today = datetime.now().strftime("%Y-%m-%d")
    template_ok = TEMPLATE_FILE.exists()
    return render_template("index.html", today=today, template_ok=template_ok)


@app.route("/api/tarifa/<code>")
def api_tarifa(code: str):
    item = get_tarifas().lookup(code)
    if not item:
        return jsonify({}), 404
    return jsonify(item)


@app.route("/api/tarifas")
def api_tarifas_list():
    t = get_tarifas()
    return jsonify(t.all_codes())


@app.route("/generar", methods=["POST"])
def generar():
    f = request.form

    # ── Parse items ───────────────────────────────────────────────────────────
    items = []
    idx = 0
    while True:
        desc = f.get(f"item_desc_{idx}", "").strip()
        if not desc:
            break
        try:
            qty = float(f.get(f"item_qty_{idx}", "1").replace(",", "."))
        except ValueError:
            qty = 1.0
        try:
            price = float(f.get(f"item_price_{idx}", "0").replace(",", "."))
        except ValueError:
            price = 0.0
        unit = f.get(f"item_unit_{idx}", "PA").strip() or "PA"
        items.append({
            "descripcion": desc,
            "unidad": unit,
            "cantidad": qty,
            "precio_unitario": price,
            "importe": round(qty * price, 2),
        })
        idx += 1

    if not items:
        return redirect(url_for("index"))

    # ── Fecha formatting ──────────────────────────────────────────────────────
    fecha_raw = f.get("fecha_contrato", datetime.now().strftime("%Y-%m-%d"))
    try:
        dt = datetime.strptime(fecha_raw, "%Y-%m-%d")
        meses = ["enero","febrero","marzo","abril","mayo","junio",
                 "julio","agosto","septiembre","octubre","noviembre","diciembre"]
        fecha_larga = f"{dt.day} de {meses[dt.month-1]} de {dt.year}"
        fecha_display = dt.strftime("%d/%m/%Y")
    except ValueError:
        fecha_larga = fecha_raw
        fecha_display = fecha_raw

    # ── Totals ────────────────────────────────────────────────────────────────
    total_sin_iva = sum(i["importe"] for i in items)

    num_contrato = f.get("num_contrato", "").strip()
    obra = f.get("obra", "").strip()

    data = {
        "[[CONTRATO_NUM]]":         num_contrato,
        "[[FECHA_CONTRATO]]":       fecha_display,
        "[[FECHA_LARGA]]":          fecha_larga,
        "[[OBRA_COMUNIDAD]]":       obra,
        "[[SERVICIO_COMUNIDAD]]":   f.get("servicio", "").strip(),
        "[[CLIENTE_NOMBRE]]":       f.get("cliente_nombre", "").strip(),
        "[[CLIENTE_DIRECCION]]":    f.get("cliente_dir", "").strip(),
        "[[CLIENTE_TELEFONO]]":     f.get("cliente_tel", "").strip(),
        "[[CLIENTE_EMAIL]]":        f.get("cliente_email", "").strip(),
        "[[PROVINCIA]]":            f.get("provincia", "Madrid").strip(),
        "[[ADMINISTRACION]]":       f.get("administracion", "").strip() or "—",
        "[[INFORME_TECNICO]]":      f.get("informe", "").strip(),
        "[[SOLUCION_ADOPTAR]]":     f.get("solucion", "").strip(),
        "[[MEMORIA_TECNICA]]":      f.get("memoria", "").strip(),
        "[[TOTAL_PRESUPUESTO]]":    fmt_euro(total_sin_iva),
        "[[RESUMEN_VALORACION]]":   fmt_euro(total_sin_iva),
        "[[FORMA_PAGO]]":           f.get("forma_pago", "").strip(),
        "[[PLAZO_EJECUCION]]":      f.get("plazo", "30").strip(),
        "[[FECHA_INICIO_OBRA_LARGA]]": fecha_larga,
        "[[FECHA_FIN_OBRA]]":       "",
    }

    # ── Output folder ─────────────────────────────────────────────────────────
    num_safe = num_contrato.replace("/", "-").replace("\\", "-")
    obra_safe = obra[:30].replace("/", "-").replace(":", "").strip()
    today_str = datetime.now().strftime("%Y-%m-%d")
    folder_name = f"{today_str}_Presupuesto_{num_safe}_{obra_safe}"
    output_dir = SALIDAS_DIR / folder_name
    output_dir.mkdir(parents=True, exist_ok=True)

    stem = f"{today_str}_Presupuesto_{num_safe}"
    generated = {}
    errors = []

    # DOCX ────────────────────────────────────────────────────────────────────
    if TEMPLATE_FILE.exists():
        try:
            docx_path = output_dir / f"{stem}.docx"
            DocxGenerator(TEMPLATE_FILE).generate(docx_path, data, items)
            generated["docx"] = docx_path.relative_to(SALIDAS_DIR).as_posix()
        except Exception as e:
            errors.append(f"DOCX: {e}")
    else:
        errors.append("Plantilla Word no encontrada (ejecuta download_templates.py)")

    # Excel ───────────────────────────────────────────────────────────────────
    try:
        xlsx_path = output_dir / f"{stem}_Valoracion.xlsx"
        ExcelGenerator().generate(xlsx_path, data, items)
        generated["xlsx"] = xlsx_path.relative_to(SALIDAS_DIR).as_posix()
    except Exception as e:
        errors.append(f"Excel: {e}")

    # HTML ────────────────────────────────────────────────────────────────────
    try:
        html_path = output_dir / f"{stem}_Visor.html"
        HtmlGenerator().generate(html_path, data, items)
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
        num_contrato=num_contrato,
        obra=obra,
        cliente=data["[[CLIENTE_NOMBRE]]"],
        fecha=fecha_larga,
        total_sin_iva=fmt_euro(total_sin_iva),
        total_con_iva=fmt_euro(total_sin_iva * 1.21),
        items=items,
        generated=generated,
        errors=errors,
        folder_name=folder_name,
    )


@app.route("/descargar/<path:rel_path>")
def descargar(rel_path: str):
    full = SALIDAS_DIR / rel_path
    if not full.exists() or not full.is_file():
        abort(404)
    # Security: must be inside SALIDAS_DIR
    try:
        full.resolve().relative_to(SALIDAS_DIR.resolve())
    except ValueError:
        abort(403)
    return send_file(full, as_attachment=True, download_name=full.name)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import webbrowser, threading, time

    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://localhost:5000")

    threading.Thread(target=open_browser, daemon=True).start()
    print("\n  Generador de Presupuestos – Grupo Europa")
    print("  Abriendo en el navegador: http://localhost:5000")
    print("  (Para parar: pulsa Ctrl+C)\n")
    app.run(host="0.0.0.0", port=5000, debug=False)
