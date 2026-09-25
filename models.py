from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SearchParams:
    location: str
    max_price: Optional[int] = None
    min_size_m2: Optional[int] = None
    property_type: str = "pisos"
    max_pages: int = 3


@dataclass
class Property:
    title: str
    price: int
    location: str
    url: str
    source: str
    size_m2: Optional[int] = None
    rooms: Optional[int] = None
    floor: Optional[str] = None
    price_per_m2: Optional[float] = field(default=None, init=False)
    deal_score: Optional[float] = field(default=None, init=False)
    deal_label: str = field(default="", init=False)

    def __post_init__(self):
        if self.size_m2 and self.size_m2 > 0:
            self.price_per_m2 = round(self.price / self.size_m2, 0)
