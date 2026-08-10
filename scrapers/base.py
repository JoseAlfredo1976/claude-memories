import re
import time
import random
import logging
from abc import ABC, abstractmethod
from typing import List, Optional

from bs4 import BeautifulSoup

from models import Property, SearchParams

logger = logging.getLogger(__name__)

# Try curl_cffi first (better anti-bot evasion), fallback to requests
try:
    from curl_cffi import requests as cf_requests
    _USE_CURL_CFFI = True
    logger.debug("Using curl_cffi for HTTP (Chrome impersonation)")
except ImportError:
    import requests as cf_requests  # type: ignore[no-redef]
    _USE_CURL_CFFI = False
    logger.debug("curl_cffi not available, using requests")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "DNT": "1",
}


class BaseScraper(ABC):
    name: str = "base"

    def __init__(self, delay: float = 3.0):
        self.delay = delay
        if _USE_CURL_CFFI:
            self.session = cf_requests.Session(impersonate="chrome124")
        else:
            import requests
            self.session = requests.Session()
            self.session.headers.update(HEADERS)

    def _get(self, url: str) -> Optional[BeautifulSoup]:
        time.sleep(self.delay + random.uniform(0.5, 1.5))
        try:
            if _USE_CURL_CFFI:
                resp = self.session.get(url, headers=HEADERS, timeout=30)
            else:
                resp = self.session.get(url, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            logger.warning("Error fetching %s: %s", url, e)
            return None

    @staticmethod
    def _parse_price(text: str) -> Optional[int]:
        """Extract integer price from strings like '250.000 €'."""
        digits = re.sub(r"[^\d]", "", text)
        return int(digits) if digits else None

    @staticmethod
    def _parse_size(text: str) -> Optional[int]:
        """Extract m² from strings like '85 m²'."""
        m = re.search(r"(\d+)\s*m", text, re.IGNORECASE)
        return int(m.group(1)) if m else None

    @staticmethod
    def _parse_rooms(text: str) -> Optional[int]:
        """Extract room count from strings like '3 hab.' or '3 habitaciones'."""
        m = re.search(r"(\d+)\s*hab", text, re.IGNORECASE)
        return int(m.group(1)) if m else None

    @abstractmethod
    def search(self, params: SearchParams) -> List[Property]:
        pass
