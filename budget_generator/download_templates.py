#!/usr/bin/env python3
"""
Descarga las plantillas desde Google Drive usando gdown.
Uso: python download_templates.py

Requiere: pip install gdown
"""
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
TEMPLATES_DIR = BASE_DIR / "templates"
TARIFAS_DIR = BASE_DIR / "tarifas"

# IDs de los archivos en Google Drive (carpeta PAQUETE COMPARTIR)
TEMPLATE_ID = "1AtRLVS2nVKt-MaWo2RG8_sD2s8Ndj_tl"
TARIFAS_ID = "1hrIuXd6vgVHITd096pWJwCzGlPBgspor"


def main():
    try:
        import gdown
    except ImportError:
        print("Instalando gdown...")
        import subprocess
        subprocess.run([sys.executable, "-m", "pip", "install", "gdown", "-q"], check=True)
        import gdown

    TEMPLATES_DIR.mkdir(exist_ok=True)
    TARIFAS_DIR.mkdir(exist_ok=True)

    template_out = TEMPLATES_DIR / "MODELO_MAESTRO.docx"
    tarifas_out = TARIFAS_DIR / "TARIFAS.xlsx"

    if not template_out.exists():
        print(f"Descargando plantilla Word -> {template_out} ...")
        gdown.download(id=TEMPLATE_ID, output=str(template_out), quiet=False)
    else:
        print(f"Plantilla ya existe: {template_out}")

    if not tarifas_out.exists():
        print(f"Descargando tarifas Excel -> {tarifas_out} ...")
        gdown.download(id=TARIFAS_ID, output=str(tarifas_out), quiet=False)
    else:
        print(f"Tarifas ya existe: {tarifas_out}")

    print("\n✓ Listo. Ejecuta: python main.py")


if __name__ == "__main__":
    main()
