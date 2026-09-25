import logging
from typing import List, Optional

from models import Property, SearchParams
from .base import BaseScraper

logger = logging.getLogger(__name__)

BASE_URL = "https://www.fotocasa.es"

TYPE_PATH = {
    "terrenos": "terrenos",
    "solares": "terrenos",
    "pisos": "viviendas",
    "casas": "viviendas",
    "viviendas": "viviendas",
}

CITIES = {"madrid", "barcelona", "sevilla", "valencia", "bilbao", "zaragoza", "malaga"}


def _fotocasa_slugs(location: str) -> list:
    """
    Fotocasa espera '{barrio}-{ciudad}' o '{ciudad}-capital'.
    Devuelve lista de slugs a probar en orden de especificidad.
    Ej: 'mirasierra-montecarmelo-madrid'
        -> ['mirasierra-madrid', 'montecarmelo-madrid', 'madrid-capital']
    """
    parts = location.lower().replace(" ", "-").split("-")
    slugs = []
    if parts[-1] in CITIES:
        city = parts[-1]
        neighborhoods = [p for p in parts[:-1] if len(p) > 2]
        for n in neighborhoods:
            slugs.append(f"{n}-{city}")
        slugs.append(f"{city}-capital")
    else:
        slugs.append(location.lower().replace(" ", "-"))
        slugs.append(parts[0])
    return slugs


class FotocasaScraper(BaseScraper):
    name = "fotocasa"

    def _build_url(self, slug: str, params: SearchParams, page: int = 1) -> str:
        segment = TYPE_PATH.get(params.property_type.lower(), "viviendas")
        path = f"/es/comprar/{segment}/{slug}/todas-las-zonas/l"
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
            title = title_el.get_text(strip=True) if title_el else "Sin titulo"

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
                if "m2" in text or " m" in text:
                    size_m2 = self._parse_size(text)
                elif "hab" in text.lower() or "dorm" in text.lower():
                    rooms = self._parse_rooms(text)

            location_el = card.select_one(".re-Card-location, [class*='location'], [class*='address']")
            location_text = location_el.get_text(strip=True) if location_el else ""

            return Property(
                title=title, price=price, size_m2=size_m2, rooms=rooms,
                location=location_text, url=url, source=self.name,
            )
        except Exception as e:
            logger.debug("Error parsing card: %s", e)
            return None

    def search(self, params: SearchParams) -> List[Property]:
        properties: List[Property] = []
        slugs = _fotocasa_slugs(params.location)
        working_slug = None

        for slug in slugs:
            url = self._build_url(slug, params, page=1)
            logger.info("[fotocasa] Probando slug '%s': %s", slug, url)
            soup = self._get(url)
            if not soup:
                continue
            cards = soup.select(
                "article.re-CardPackMain, article[class*='Card'], div[class*='CardPack']"
            )
            if cards:
                working_slug = slug
                for card in cards:
                    prop = self._parse_card(card)
                    if prop:
                        properties.append(prop)
                break

        if not working_slug:
            return properties

        for page in range(2, params.max_pages + 1):
            url = self._build_url(working_slug, params, page=page)
            soup = self._get(url)
            if not soup:
                break
            cards = soup.select(
                "article.re-CardPackMain, article[class*='Card'], div[class*='CardPack']"
            )
            if not cards:
                break
            for card in cards:
                prop = self._parse_card(card)
                if prop:
                    properties.append(prop)

        return properties
