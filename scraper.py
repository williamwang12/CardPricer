import time
import logging
from typing import Optional, Tuple

import requests

from models import Card

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.5",
}

SEARCH_API_URL = (
    "https://mp-search-api.tcgplayer.com/v1/search/request"
    "?q={query}&isList=false&mpfev=2952"
)

PRODUCT_URL_TEMPLATE = "https://www.tcgplayer.com/product/{product_id}"

REQUEST_DELAY = 1.5  # seconds between requests


def _build_search_payload() -> dict:
    """Build the JSON payload for the TCGPlayer search API."""
    return {
        "algorithm": "",
        "from": 0,
        "size": 24,
        "filters": {
            "term": {"productLineName": ["pokemon"]},
            "range": {},
            "match": {},
        },
        "listingSearch": {
            "filters": {
                "term": {"sellerStatus": "Live", "channelId": 0},
                "range": {"quantity": {"gte": 1}},
                "exclude": {"channelExclusion": 0},
            }
        },
        "context": {"cart": {}, "shippingCountry": "US", "userProfile": {}},
    }


def _find_best_match(results: list[dict], card: Card) -> Optional[dict]:
    """Find the best matching result from search API results.

    Prioritizes exact card number match, then name match.
    """
    if not results:
        return None

    card_name_lower = card.name.lower()
    card_number = card.number.split("/")[0] if card.number else ""

    # Pass 1: Match by card number (the part before the slash)
    if card_number:
        for r in results:
            product_name = r.get("productName", "")
            # TCGPlayer formats as "Name - 025/165"
            if f"- {card.number}" in product_name:
                return r
            if card_number and f"- {card_number}" in product_name:
                return r

    # Pass 2: Match by exact name in product name
    for r in results:
        product_name = r.get("productName", "").lower()
        if card_name_lower in product_name:
            return r

    # Fallback: return the first result
    return results[0]


def search_tcgplayer(
    card: Card, session: Optional[requests.Session] = None
) -> Tuple[Optional[float], Optional[str]]:
    """
    Look up a card's Near Mint market price on TCGPlayer.

    Returns (market_price, product_url) or (None, None) on failure.
    """
    if session is None:
        session = requests.Session()

    query = card.search_query()
    url = SEARCH_API_URL.format(query=requests.utils.quote(query))
    payload = _build_search_payload()

    logger.info("Searching TCGPlayer API: %s", query)

    try:
        resp = session.post(url, json=payload, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, ValueError) as e:
        logger.warning("Search API failed for '%s': %s", query, e)
        return None, None

    # Parse results
    api_results = data.get("results", [])
    if not api_results:
        return None, None

    hits = api_results[0].get("results", [])
    if not hits:
        logger.warning("No results found for: %s", query)
        return None, card.search_url()

    match = _find_best_match(hits, card)
    if match is None:
        return None, card.search_url()

    price = match.get("marketPrice")
    product_id = match.get("productId")

    product_url = None
    if product_id:
        product_url = PRODUCT_URL_TEMPLATE.format(product_id=int(product_id))

    if price is not None:
        price = round(float(price), 2)

    return price, product_url


def price_cards(
    cards: list[Card],
    progress_callback=None,
) -> list[Card]:
    """
    Look up prices for a list of cards.

    Args:
        cards: List of Card objects to price.
        progress_callback: Optional callable(current_index, total, card) for progress updates.

    Returns:
        The same list of Card objects with market_price and tcgplayer_url populated.
    """
    session = requests.Session()
    total = len(cards)

    for i, card in enumerate(cards):
        if progress_callback:
            progress_callback(i, total, card)

        price, url = search_tcgplayer(card, session)
        card.market_price = price
        card.tcgplayer_url = url

        # Rate limit between requests (skip delay after last card)
        if i < total - 1:
            time.sleep(REQUEST_DELAY)

    return cards
