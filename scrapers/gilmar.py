import logging
from typing import List, Optional

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gilmar.es"

TYPE_PATH = {
    "terrenos": "solares-terrenos",
    "solares": "solares-terrenos",
    "pisos": "pisos-apartamentos",
    "casas": "casas-chalets",
    "viviendas": "pisos-apartamentos",
}

CITIES = {"madrid", "barcelona", "sevilla", "valencia"}


def _gilmar_zones(location: str) -> list:
    """
    Gilmar usa zonas simples: mirasierra, montecarmelo, madrid, etc.
    Devuelve lista de zonas a probar en orden.
    """
    parts = location.lower().replace(" ", "-").split("-")
    zones = []
    for part in parts:
        if part not in CITIES and len(part) > 3:
            zones.append(part)
    for part in parts:
        if part in CITIES:
            zones.append(part)
    return zones or [parts[0]]


class GilmarScraper(BaseScraper):
    name = "gilmar"

    def _build_url(self, zone: str, params: SearchParams, page: int = 1) -> str:
        prop_segment = TYPE_PATH.get(params.property_type.lower(), "pisos-apartamentos")
        path = f"/venta/{prop_segment}/{zone}/"
        parts = []
        if params.max_price:
            parts.append(f"precio_max={params.max_price}")
        if params.min_size_m2:
            parts.append(f"metros_min={params.min_size_m2}")
        if page > 1:
            parts.append(f"pagina={page}")
        query = "?" + "&".join(parts) if parts else ""
        return f"{BASE_URL}{path}{query}"

    def _parse_card(self, card) -> Optional[Property]:
        try:
            link_el = card.select_one("a[href]") or card.select_one(".property-item__link")
            if not link_el:
                return None
            href = link_el.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href

            title_el = card.select_one(".property-item__title, h2, h3, .property-title")
            title = title_el.get_text(strip=True) if title_el else "Sin titulo"

            price_el = card.select_one(".property-item__price, [class*='price'], .precio")
            if not price_el:
                return None
            price = self._parse_price(price_el.get_text())
            if not price:
                return None

            size_m2: Optional[int] = None
            rooms: Optional[int] = None
            for detail in card.select(
                ".property-item__feature, [class*='feature'], [class*='detail']"
            ):
                text = detail.get_text(strip=True)
                if "m2" in text or " m" in text:
                    size_m2 = self._parse_size(text)
                elif "hab" in text.lower() or "dorm" in text.lower():
                    rooms = self._parse_rooms(text)

            location_el = card.select_one(
                ".property-item__location, [class*='location'], [class*='zona']"
            )
            location_text = location_el.get_text(strip=True) if location_el else ""

            return Property(
                title=title, price=price, size_m2=size_m2, rooms=rooms,
                location=location_text, url=url, source=self.name,
            )
        except Exception as e:
            logger.debug("Error parsing Gilmar card: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []
        zones = _gilmar_zones(params.location)
        working_zone = None

        for zone in zones:
            url = self._build_url(zone, params, page=1)
            logger.info("[gilmar] Probando zona '%s': %s", zone, url)
            soup = self._get(url)
            if not soup:
                continue
            cards = soup.select(
                ".property-item, article[class*='property'], "
                "div[class*='listing'], .inmueble-item, [class*='inmueble']"
            )
            if cards:
                working_zone = zone
                for card in cards:
                    prop = self._parse_card(card)
                    if prop:
                        properties.append(prop)
                break

        if not working_zone:
            return properties

        for page in range(2, params.max_pages + 1):
            url = self._build_url(working_zone, params, page=page)
            soup = self._get(url)
            if not soup:
                break
            cards = soup.select(
                ".property-item, article[class*='property'], "
                "div[class*='listing'], .inmueble-item, [class*='inmueble']"
            )
            if not cards:
                break
            for card in cards:
                prop = self._parse_card(card)
                if prop:
                    properties.append(prop)

        return properties
