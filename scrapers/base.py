import os
import re
import time
import random
import logging
from abc import ABC, abstractmethod
from typing import List, Optional
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup

from models import Property, SearchParams

logger = logging.getLogger(__name__)

# ScraperAPI key — set env var SCRAPER_API_KEY to bypass anti-bot protection
_SCRAPER_API_KEY = os.environ.get("SCRAPER_API_KEY", "")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "DNT": "1",
}


def _wrap_url(url: str) -> str:
    """Wrap URL through ScraperAPI if a key is configured."""
    if _SCRAPER_API_KEY:
        return f"http://api.scraperapi.com?api_key={_SCRAPER_API_KEY}&url={quote_plus(url)}&render=false&country_code=es"
    return url


class BaseScraper(ABC):
    name: str = "base"

    def __init__(self, delay: float = 2.0):
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(HEADERS)
        if _SCRAPER_API_KEY:
            logger.debug("ScraperAPI activo — anti-bot bypassed")
        else:
            logger.debug("Sin ScraperAPI — los portales pueden bloquear")

    def _get(self, url: str) -> Optional[BeautifulSoup]:
        time.sleep(self.delay + random.uniform(0.3, 1.0))
        wrapped = _wrap_url(url)
        try:
            resp = self.session.get(wrapped, timeout=45)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            logger.warning("Error fetching %s: %s", url, e)
            return None

    @staticmethod
    def _parse_price(text: str) -> Optional[int]:
        digits = re.sub(r"[^\d]", "", text)
        return int(digits) if digits else None

    @staticmethod
    def _parse_size(text: str) -> Optional[int]:
        m = re.search(r"(\d+)\s*m", text, re.IGNORECASE)
        return int(m.group(1)) if m else None

    @staticmethod
    def _parse_rooms(text: str) -> Optional[int]:
        m = re.search(r"(\d+)\s*hab", text, re.IGNORECASE)
        return int(m.group(1)) if m else None

    @abstractmethod
    def search(self, params: SearchParams) -> List[Property]:
        pass
