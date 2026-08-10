import logging
from typing import List, Optional

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.fotocasa.es"

# Map property_type → Fotocasa URL segment
TYPE_PATH = {
    "terrenos": "terrenos",
    "solares": "terrenos",
    "pisos": "viviendas",
    "casas": "viviendas",
    "viviendas": "viviendas",
}


class FotocasaScraper(BaseScraper):
    name = "fotocasa"

    def _build_url(self, params: SearchParams, page: int = 1) -> str:
        location = params.location.lower().replace(" ", "-")
        segment = TYPE_PATH.get(params.property_type.lower(), "viviendas")
        path = f"/es/comprar/{segment}/{location}/todas-las-zonas/l"
        query_parts = []
        if params.max_price:
            query_parts.append(f"maxPrice={params.max_price}")
        if params.min_size_m2:
            query_parts.append(f"minSurface={params.min_size_m2}")
        if page > 1:
            query_parts.append(f"page={page}")
        query = "&".join(query_parts)
        return f"{BASE_URL}{path}{'?' + query if query else ''}"

    def _parse_card(self, card) -> Optional[Property]:
        try:
            link_el = card.select_one("a[href*='/es/inmueble/']") or card.select_one("a.re-Card-link")
            if not link_el:
                return None
            href = link_el.get("href", "")
            url = BASE_URL + href if href.startswith("/") else href

            title_el = card.select_one(".re-Card-title") or card.select_one("h3")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = card.select_one(".re-CardPrice") or card.select_one("[class*='price']")
            if not price_el:
                return None
            price = self._parse_price(price_el.get_text())
            if not price:
                return None

            size_m2: Optional[int] = None
            rooms: Optional[int] = None
            for feat in card.select(".re-CardFeatures-feature, [class*='feature'], li"):
                text = feat.get_text(strip=True)
                if "m²" in text or " m" in text:
                    size_m2 = self._parse_size(text)
                elif "hab" in text.lower() or "dorm" in text.lower():
                    rooms = self._parse_rooms(text)

            location_el = card.select_one(".re-Card-location, [class*='location'], [class*='address']")
            location_text = location_el.get_text(strip=True) if location_el else ""

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
            logger.debug("Error parsing card: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []

        for page in range(1, params.max_pages + 1):
            url = self._build_url(params, page)
            logger.info("[fotocasa] Scraping page %d: %s", page, url)
            soup = self._get(url)
            if not soup:
                break

            cards = soup.select(
                "article.re-CardPackMain, article[class*='Card'], div[class*='CardPack']"
            )
            if not cards:
                logger.info("[fotocasa] No more listings on page %d", page)
                break

            for card in cards:
                prop = self._parse_card(card)
                if prop:
                    properties.append(prop)

            logger.info("[fotocasa] Page %d: %d listings so far", page, len(properties))

        return properties
