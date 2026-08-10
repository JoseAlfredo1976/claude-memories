import logging
from typing import List, Optional
from urllib.parse import urlencode

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.engelvoelkers.com"


class EngelVoelkersScraper(BaseScraper):
    """Scraper para Engel & Völkers España."""
    name = "engel&volkers"

    # E&V expone una API JSON interna que devuelve los listings
    API_URL = "https://www.engelvoelkers.com/es/search/"

    def _build_url(self, params: SearchParams, start: int = 0) -> str:
        property_type = params.property_type.lower()
        facets_parts = ["bsnssr:residential", "typ:sell", "cntry:es"]
        if property_type in ("terrenos", "solares"):
            facets_parts.append("ptyp:developmentSite")

        # Localidad como texto libre en el campo q
        query = {
            "q": params.location,
            "startIndex": start,
            "businessArea": "residential",
            "sortOrder": "ASC",
            "sortField": "sortPrice",
            "pageSize": 18,
            "facets": ";".join(facets_parts),
        }
        if params.max_price:
            query["maxPrice"] = params.max_price
        return f"{self.API_URL}?{urlencode(query)}"

    def _parse_card(self, card) -> Optional[Property]:
        try:
            link_el = card.select_one("a[href]") or card.select_one(".ev-property-teaser__link")
            if not link_el:
                return None
            href = link_el.get("href", "")
            url = href if href.startswith("http") else BASE_URL + href

            title_el = card.select_one(".ev-property-teaser__title, h2, h3")
            title = title_el.get_text(strip=True) if title_el else "Sin título"

            price_el = card.select_one(".ev-property-teaser__price, [class*='price']")
            if not price_el:
                return None
            price = self._parse_price(price_el.get_text())
            if not price:
                return None

            size_m2: Optional[int] = None
            rooms: Optional[int] = None
            for detail in card.select(".ev-property-teaser__fact, [class*='fact'], [class*='detail']"):
                text = detail.get_text(strip=True)
                if "m²" in text or " m" in text:
                    size_m2 = self._parse_size(text)
                elif "hab" in text.lower() or "bed" in text.lower():
                    rooms = self._parse_rooms(text)

            location_el = card.select_one(".ev-property-teaser__location, [class*='location']")
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
            logger.debug("Error parsing E&V card: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []

        for page in range(params.max_pages):
            start = page * 18
            url = self._build_url(params, start=start)
            logger.info("[engel&volkers] Scraping offset %d: %s", start, url)
            soup = self._get(url)
            if not soup:
                break

            cards = soup.select(
                "div.ev-property-teaser, article[class*='property'], "
                "div[class*='teaser'], .property-item"
            )
            if not cards:
                logger.info("[engel&volkers] No listings at offset %d", start)
                break

            for card in cards:
                prop = self._parse_card(card)
                if prop:
                    properties.append(prop)

            logger.info("[engel&volkers] Offset %d: %d listings so far", start, len(properties))

        return properties
