import statistics
from typing import List

from models import Property

# % below median price/m² to qualify as a deal
CHOLLO_THRESHOLD = 15.0
SUPER_CHOLLO_THRESHOLD = 25.0


def analyze(properties: List[Property]) -> List[Property]:
    """Score each property relative to median €/m² and label deals."""
    with_size = [p for p in properties if p.price_per_m2 is not None]

    if len(with_size) < 3:
        # Not enough data to calculate a meaningful baseline
        for p in properties:
            p.deal_score = 0.0
            p.deal_label = ""
        return properties

    median_ppm2 = statistics.median(p.price_per_m2 for p in with_size)

    for prop in properties:
        if prop.price_per_m2 is None:
            prop.deal_score = 0.0
            prop.deal_label = "Sin datos m²"
            continue

        # Positive score = cheaper than median (good deal)
        prop.deal_score = (median_ppm2 - prop.price_per_m2) / median_ppm2 * 100

        if prop.deal_score >= SUPER_CHOLLO_THRESHOLD:
            prop.deal_label = "SUPER CHOLLO"
        elif prop.deal_score >= CHOLLO_THRESHOLD:
            prop.deal_label = "CHOLLO"
        elif prop.deal_score >= 0:
            prop.deal_label = "Buen precio"
        else:
            prop.deal_label = "Precio alto"

    return sorted(properties, key=lambda p: p.deal_score or 0, reverse=True)


def summary_stats(properties: List[Property]) -> dict:
    with_size = [p for p in properties if p.price_per_m2 is not None]
    prices = [p.price for p in properties]

    stats: dict = {
        "total": len(properties),
        "chollos": sum(1 for p in properties if "CHOLLO" in (p.deal_label or "")),
    }
    if prices:
        stats["precio_min"] = min(prices)
        stats["precio_max"] = max(prices)
        stats["precio_mediana"] = int(statistics.median(prices))
    if with_size:
        ppm2_values = [p.price_per_m2 for p in with_size]
        stats["mediana_eur_m2"] = int(statistics.median(ppm2_values))
        stats["min_eur_m2"] = int(min(ppm2_values))
        stats["max_eur_m2"] = int(max(ppm2_values))
    return stats
