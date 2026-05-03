#!/usr/bin/env python3
"""
Buscador de chollos inmobiliarios.

Scrapes Idealista y Fotocasa para detectar propiedades con precio
significativamente por debajo de la mediana del mercado local.

Uso responsable: respeta los robots.txt de cada portal y no abuses de las
peticiones. Este script añade retardos automáticos entre requests.
"""

import logging
import sys
from typing import List, Optional

import click
from rich.console import Console

from models import Property, SearchParams
from scrapers import IdealistaScraper, FotocasaScraper
from analyzer import analyze, summary_stats
from output import console, print_results, export_csv, export_json

SOURCES = {
    "idealista": IdealistaScraper,
    "fotocasa": FotocasaScraper,
}


@click.command()
@click.argument("location")
@click.option("--max-price", "-p", type=int, default=None, help="Precio máximo en euros")
@click.option("--min-size", "-s", type=int, default=None, help="Superficie mínima en m²")
@click.option(
    "--source",
    "-S",
    type=click.Choice(["idealista", "fotocasa", "all"], case_sensitive=False),
    default="all",
    show_default=True,
    help="Portal a scrapear",
)
@click.option("--pages", "-n", type=int, default=3, show_default=True, help="Páginas por portal")
@click.option("--top", "-t", type=int, default=20, show_default=True, help="Número de resultados a mostrar")
@click.option("--export-csv", "csv_path", type=str, default=None, help="Exportar resultados a CSV")
@click.option("--export-json", "json_path", type=str, default=None, help="Exportar resultados a JSON")
@click.option("--delay", "-d", type=float, default=3.0, show_default=True, help="Segundos entre requests")
@click.option("--verbose", "-v", is_flag=True, help="Mostrar logs de depuración")
def main(
    location: str,
    max_price: Optional[int],
    min_size: Optional[int],
    source: str,
    pages: int,
    top: int,
    csv_path: Optional[str],
    json_path: Optional[str],
    delay: float,
    verbose: bool,
) -> None:
    """Busca chollos inmobiliarios en LOCATION (ej: 'madrid', 'barcelona', 'sevilla')."""
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )

    params = SearchParams(
        location=location,
        max_price=max_price,
        min_size_m2=min_size,
        max_pages=pages,
    )

    sources_to_use = list(SOURCES.keys()) if source == "all" else [source]
    all_properties: List[Property] = []

    for src_name in sources_to_use:
        scraper_cls = SOURCES[src_name]
        scraper = scraper_cls(delay=delay)
        console.print(f"[blue]Buscando en {src_name.capitalize()}...[/blue]")
        try:
            props = scraper.search(params)
            console.print(f"[blue]  -> {len(props)} anuncios encontrados[/blue]")
            all_properties.extend(props)
        except Exception as e:
            console.print(f"[red]Error en {src_name}: {e}[/red]")

    if not all_properties:
        console.print("[yellow]No se encontraron anuncios. Prueba con otra ubicacion o fuente.[/yellow]")
        sys.exit(0)

    ranked = analyze(all_properties)
    stats = summary_stats(ranked)

    print_results(ranked, stats, top_n=top)

    if csv_path:
        export_csv(ranked, csv_path)
    if json_path:
        export_json(ranked, json_path)


if __name__ == "__main__":
    main()
