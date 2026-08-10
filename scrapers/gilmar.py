import logging
from typing import List, Optional

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.gilmar.es"

# Gilmar URL segments por tipo
TYPE_PATH = {
    "terrenos": "solares-terrenos",
    "solares": "solares-terrenos",
    "pisos": "pisos-apartamentos",
    "casas": "casas-chalets",
    "viviendas": "pisos-apartamentos",
}

# Normalización de zonas de Madrid conocidas por Gilmar
ZONE_MAP = {
    "mirasierra": "mirasierra",
    "montecarmelo": "montecarmelo",
    "madrid": "madrid",
    "barcelona": "barcelona",
}


class GilmarScraper(BaseScraper):
    """Scraper para Gilmar Consulting Inmobiliario."""
    name = "gilmar"

    def _build_url(self, params: SearchParams, page: int = 1) -> str:
        prop_segment = TYPE_PATH.get(params.property_type.lower(), "pisos-apartamentos")
        # Intentar localizar la zona en la URL de Gilmar
        location_slug = params.location.lower().replace(" ", "-")
        path = f"/venta/{prop_segment}/{location_slug}/"
        query = ""
        parts = []
        if params.max_price:
            parts.append(f"precio_max={params.max_price}")
        if params.min_size_m2:
            parts.append(f"metros_min={params.min_size_m2}")
        if page > 1:
            parts.append(f"pagina={page}")
        if parts:
            query = "?" + "&".join(parts)
        return f"{BASE_URL}{path}{query}"

    def _parse_card(self, card) -> Optional[Property]:
        try:
            link_el = card.select_one("a[href]") or card.select_one(".property-item__link")
            if not link_el:
                return None
            href = link_el.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href

            title_el = card.select_one(".property-item__title, h2, h3, .property-title")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = card.select_one(".property-item__price, [class*='price'], .precio")
            if not price_el:
                return None
            price = self._parse_price(price_el.get_text())
            if not price:
                return None

            size_m2: Optional[int] = None
            rooms: Optional[int] = None
            for detail in card.select(".property-item__feature, [class*='feature'], [class*='detail']"):
                text = detail.get_text(strip=True)
                if "m²" in text or " m" in text:
                    size_m2 = self._parse_size(text)
                elif "hab" in text.lower() or "dorm" in text.lower():
                    rooms = self._parse_rooms(text)

            location_el = card.select_one(".property-item__location, [class*='location'], [class*='zona']")
            location_text = location_el.get_text(strip=True) if location_el else params.location

            return Property(
                title=title,
                price=price,
                size_m2=size_m2,
                rooms=rooms,
                location=location_text,
                url=url,
                source=self.name,
            )
        except Exception as e:
            logger.debug("Error parsing Gilmar card: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []

        for page in range(1, params.max_pages + 1):
            url = self._build_url(params, page)
            logger.info("[gilmar] Scraping page %d: %s", page, url)
            soup = self._get(url)
            if not soup:
                break

            cards = soup.select(
                ".property-item, article[class*='property'], "
                "div[class*='listing'], .inmueble-item"
            )
            if not cards:
                logger.info("[gilmar] No listings on page %d", page)
                break

            for card in cards:
                prop = self._parse_card(card)
                if prop:
                    properties.append(prop)

            logger.info("[gilmar] Page %d: %d listings so far", page, len(properties))

        return properties
