from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote_plus


@dataclass
class Card:
    name: str
    number: str = ""
    quantity: int = 1
    market_price: Optional[float] = None
    tcgplayer_url: Optional[str] = None

    def search_query(self) -> str:
        """Build a search query string from card attributes."""
        parts = [self.name]
        if self.number:
            parts.append(self.number)
        return " ".join(parts)

    def search_url(self) -> str:
        """Build a TCGPlayer search URL for this card."""
        query = quote_plus(self.search_query())
        return (
            f"https://www.tcgplayer.com/search/pokemon/product"
            f"?q={query}&productLineName=pokemon"
        )

    def total_value(self) -> Optional[float]:
        """Return quantity * market_price, or None if no price."""
        if self.market_price is not None:
            return round(self.market_price * self.quantity, 2)
        return None
