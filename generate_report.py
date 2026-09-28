#!/usr/bin/env python3
"""Genera docs/index.html a partir de docs/resultados.json."""
import json
import os
from datetime import datetime

DOCS = "docs"
os.makedirs(DOCS, exist_ok=True)

json_path = os.path.join(DOCS, "resultados.json")
if not os.path.exists(json_path):
    properties = []
else:
    with open(json_path, encoding="utf-8") as f:
        properties = json.load(f)

now = datetime.utcnow().strftime("%d/%m/%Y %H:%M UTC")
chollos = [p for p in properties if "CHOLLO" in (p.get("deal_label") or "")]

LABEL_COLOR = {
    "SUPER CHOLLO": "#16a34a",
    "CHOLLO": "#22c55e",
    "Buen precio": "#0ea5e9",
    "Precio alto": "#94a3b8",
    "Sin datos m²": "#f59e0b",
}

def badge(label):
    color = LABEL_COLOR.get(label, "#94a3b8")
    return f'<span style="background:{color};color:#fff;padding:2px 8px;border-radius:12px;font-size:.75rem;font-weight:700">{label or "-"}</span>'

def fmt_price(p):
    return f"{p:,.0f} €".replace(",", ".")

def rows(props):
    out = []
    for i, p in enumerate(props, 1):
        score = p.get("deal_score")
        score_str = f"{score:+.1f}%" if score is not None else "-"
        ppm2 = int(p["price_per_m2"]) if p.get("price_per_m2") else "-"
        ppm2_str = f"{ppm2:,}".replace(",", ".") + " €/m²" if ppm2 != "-" else "-"
        size = p.get("size_m2") or "-"
        source_icon = {"idealista": "\U0001f535", "fotocasa": "\U0001f7e0", "gilmar": "\U0001f7e2", "engel&volkers": "⚫"}.get(p.get("source",""), "⚪")
        out.append(f"""
        <tr>
          <td style="color:#94a3b8;text-align:right">{i}</td>
          <td>{badge(p.get("deal_label",""))}</td>
          <td style="font-weight:700;white-space:nowrap">{fmt_price(p["price"])}</td>
          <td style="color:#64748b;font-size:.85rem">{ppm2_str}</td>
          <td style="font-weight:600;color:{'#16a34a' if (score or 0)>0 else '#ef4444'}">{score_str}</td>
          <td style="color:#64748b">{size} m²</td>
          <td style="font-size:.85rem">{p.get("location","-")}</td>
          <td style="font-size:.75rem">{source_icon} {p.get("source","-")}</td>
          <td><a href="{p['url']}" target="_blank" style="color:#6366f1;font-size:.8rem">Ver →</a></td>
        </tr>""")
    return "\n".join(out)

html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Chollos Inmobiliarios · Mirasierra / Montecarmelo</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:16px}}
  h1{{font-size:1.4rem;font-weight:800;margin-bottom:4px}}
  .sub{{color:#94a3b8;font-size:.85rem;margin-bottom:20px}}
  .cards{{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}}
  .card{{background:#1e293b;border-radius:12px;padding:16px 20px;flex:1;min-width:140px}}
  .card .val{{font-size:1.8rem;font-weight:800}}
  .card .lbl{{color:#94a3b8;font-size:.8rem;margin-top:4px}}
  .green{{color:#22c55e}} .blue{{color:#38bdf8}} .yellow{{color:#f59e0b}}
  .tbl-wrap{{overflow-x:auto;-webkit-overflow-scrolling:touch}}
  table{{width:100%;border-collapse:collapse;font-size:.85rem}}
  th{{background:#1e293b;padding:10px 8px;text-align:left;color:#94a3b8;font-weight:600;
      position:sticky;top:0;white-space:nowrap}}
  td{{padding:10px 8px;border-bottom:1px solid #1e293b;vertical-align:middle}}
  tr:hover td{{background:#1e293b55}}
  .footer{{margin-top:20px;color:#475569;font-size:.75rem;text-align:center}}
  @media(max-width:600px){{
    h1{{font-size:1.1rem}}
    .card .val{{font-size:1.3rem}}
    td,th{{padding:8px 6px}}
  }}
</style>
</head>
<body>
<h1>\U0001f3e0 Chollos Inmobiliarios</h1>
<p class="sub">Mirasierra · Montecarmelo · Madrid &nbsp;|&nbsp; Actualizado: {now}</p>

<div class="cards">
  <div class="card"><div class="val blue">{len(properties)}</div><div class="lbl">Anuncios analizados</div></div>
  <div class="card"><div class="val green">{len(chollos)}</div><div class="lbl">Chollos detectados</div></div>
  <div class="card"><div class="val yellow">{fmt_price(min((p["price"] for p in properties), default=0)) if properties else "-"}</div><div class="lbl">Precio mínimo</div></div>
</div>

<div class="tbl-wrap">
<table>
  <thead>
    <tr>
      <th>#</th><th>Valoración</th><th>Precio</th><th>€/m²</th>
      <th>Desc%</th><th>Tamaño</th><th>Ubicación</th><th>Fuente</th><th>Enlace</th>
    </tr>
  </thead>
  <tbody>
    {"<tr><td colspan='9' style='text-align:center;padding:40px;color:#475569'>No se encontraron anuncios. Ejecuta el workflow manualmente.</td></tr>" if not properties else rows(properties)}
  </tbody>
</table>
</div>

<p class="footer">Generado automáticamente · Los precios son orientativos · Verifica siempre en el portal original</p>
</body>
</html>"""

with open(os.path.join(DOCS, "index.html"), "w", encoding="utf-8") as f:
    f.write(html)

print(f"✅ Informe generado: {len(properties)} anuncios, {len(chollos)} chollos → docs/index.html")
