import logging
from typing import List, Optional
from urllib.parse import urlencode

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.idealista.com"

# Map property_type keyword → Idealista URL segment
TYPE_PATH = {
    "terrenos": "venta-terrenos",
    "solares": "venta-terrenos",
    "pisos": "venta-viviendas",
    "casas": "venta-viviendas",
    "viviendas": "venta-viviendas",
}


class IdealistaScraper(BaseScraper):
    name = "idealista"

    def _build_url(self, params: SearchParams, page: int = 1) -> str:
        location = params.location.lower().replace(" ", "-")
        segment = TYPE_PATH.get(params.property_type.lower(), "venta-viviendas")
        path = f"/{segment}/{location}/"
        query: dict = {"ordenado-por": "precio-asc"}
        if params.max_price:
            query["precio-max"] = params.max_price
        if params.min_size_m2:
            query["metros-min"] = params.min_size_m2
        if page > 1:
            query["pagina"] = page
        return f"{BASE_URL}{path}?{urlencode(query)}"

    def _parse_article(self, article, fallback_location: str) -> Optional[Property]:
        try:
            link_el = article.select_one("a.item-link")
            if not link_el:
                return None

            title = link_el.get_text(strip=True)
            url = BASE_URL + link_el["href"]

            price_el = article.select_one(".item-price")
            if not price_el:
                return None
            price = self._parse_price(price_el.get_text())
            if not price:
                return None

            details = [el.get_text(strip=True) for el in article.select(".item-detail")]

            size_m2: Optional[int] = None
            rooms: Optional[int] = None
            for detail in details:
                if "m²" in detail or " m" in detail:
                    size_m2 = self._parse_size(detail)
                elif "hab" in detail.lower():
                    rooms = self._parse_rooms(detail)

            address_el = article.select_one(".item-address")
            location_text = address_el.get_text(strip=True) if address_el else fallback_location

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
            logger.debug("Error parsing article: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []

        for page in range(1, params.max_pages + 1):
            url = self._build_url(params, page)
            logger.info("[idealista] Scraping page %d: %s", page, url)
            soup = self._get(url)
            if not soup:
                break

            articles = soup.select("article.item")
            if not articles:
                logger.info("[idealista] No more listings found on page %d", page)
                break

            for article in articles:
                prop = self._parse_article(article, params.location)
                if prop:
                    properties.append(prop)

            logger.info("[idealista] Page %d: %d listings so far", page, len(properties))

        return properties
