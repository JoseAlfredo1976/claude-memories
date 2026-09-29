import csv
import json
from typing import List

from rich.console import Console
from rich.table import Table
from rich import box
from rich.panel import Panel
from rich.text import Text

from models import Property

console = Console()

DEAL_STYLES = {
    "SUPER CHOLLO": "bold green",
    "CHOLLO": "green",
    "Buen precio": "cyan",
    "Precio alto": "dim",
    "Sin datos m²": "dim yellow",
    "": "dim",
}


def print_results(properties: List[Property], stats: dict, top_n: int = 20) -> None:
    _print_stats(stats)
    _print_table(properties[:top_n])


def _print_stats(stats: dict) -> None:
    lines = [
        f"Total anuncios: [bold]{stats.get('total', 0)}[/bold]",
        f"Chollos detectados: [bold green]{stats.get('chollos', 0)}[/bold green]",
    ]
    if "precio_mediana" in stats:
        lines.append(f"Precio mediano: [bold]{stats['precio_mediana']:,} €[/bold]")
    if "mediana_eur_m2" in stats:
        lines.append(
            f"€/m² mediana: [bold]{stats['mediana_eur_m2']:,}[/bold]  "
            f"(min {stats['min_eur_m2']:,} – max {stats['max_eur_m2']:,})"
        )
    console.print(Panel("\n".join(lines), title="Resumen del mercado", border_style="blue"))


def _print_table(properties: List[Property]) -> None:
    table = Table(
        title="Chollos inmobiliarios",
        box=box.ROUNDED,
        show_lines=True,
        highlight=True,
    )
    table.add_column("#", style="dim", width=3, justify="right")
    table.add_column("Valoración", min_width=13)
    table.add_column("Precio", justify="right", min_width=11)
    table.add_column("€/m²", justify="right", min_width=7)
    table.add_column("Desc%", justify="right", min_width=6)
    table.add_column("m²", justify="right", min_width=4)
    table.add_column("Hab.", justify="right", min_width=4)
    table.add_column("Ubicación", min_width=20)
    table.add_column("Fuente", min_width=8)
    table.add_column("Enlace", min_width=30, no_wrap=True)

    for i, p in enumerate(properties, 1):
        style = DEAL_STYLES.get(p.deal_label, "")
        score_str = f"{p.deal_score:+.1f}%" if p.deal_score is not None else "-"
        ppm2_str = f"{int(p.price_per_m2):,}" if p.price_per_m2 else "-"
        size_str = str(p.size_m2) if p.size_m2 else "-"
        rooms_str = str(p.rooms) if p.rooms else "-"

        label = Text(p.deal_label or "-", style=style)

        table.add_row(
            str(i),
            label,
            f"{p.price:,} €",
            ppm2_str,
            score_str,
            size_str,
            rooms_str,
            p.location or "-",
            p.source,
            p.url,
            style=style if "CHOLLO" in (p.deal_label or "") else "",
        )

    console.print(table)


def export_csv(properties: List[Property], path: str) -> None:
    fields = ["title", "price", "size_m2", "rooms", "price_per_m2", "deal_score", "deal_label", "location", "source", "url"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for p in properties:
            writer.writerow({k: getattr(p, k, "") for k in fields})
    console.print(f"[green]Exportado a {path}[/green]")


def export_json(properties: List[Property], path: str) -> None:
    data = [
        {
            "title": p.title,
            "price": p.price,
            "size_m2": p.size_m2,
            "rooms": p.rooms,
            "price_per_m2": p.price_per_m2,
            "deal_score": p.deal_score,
            "deal_label": p.deal_label,
            "location": p.location,
            "source": p.source,
            "url": p.url,
        }
        for p in properties
    ]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    console.print(f"[green]Exportado a {path}[/green]")
