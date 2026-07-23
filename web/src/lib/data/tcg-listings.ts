// TCGplayer live-listings lookup — the only public source of per-condition
// prices (tcgcsv's feed only carries the Near Mint market price). Used
// on-demand for the specific (product, condition) pairs a user actually holds,
// never catalog-wide, to stay under TCGplayer's per-domain rate limits.

const LISTINGS_URL = (productId: number) =>
  `https://mp-search-api.tcgplayer.com/v1/product/${productId}/listings`;

// A browser-like Referer/Origin is required or the endpoint 403s.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: "https://www.tcgplayer.com",
  Referer: "https://www.tcgplayer.com/",
};

// How many of the cheapest listings to average — smooths out single-listing
// lowball noise while staying close to the real market floor.
const SAMPLE = 5;

interface Listing {
  price: number;
  shippingPrice: number;
}

export interface ConditionListingPrice {
  price: number; // avg of the cheapest SAMPLE listings' item price
  listingCount: number; // total live listings for the condition
}

// Lowest-few average price for one product in one condition. Returns null on
// failure (403/timeout/no listings) so callers fall back to the multiplier.
export async function fetchConditionPrice(
  productId: number,
  condition: string
): Promise<ConditionListingPrice | null> {
  try {
    const res = await fetch(LISTINGS_URL(productId), {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        filters: {
          term: {
            sellerStatus: "Live",
            channelId: 0,
            condition: [condition],
            language: ["English"],
          },
          range: { quantity: { gte: 1 } },
          exclude: { channelExclusion: 0 },
        },
        from: 0,
        size: SAMPLE,
        sort: { field: "price+shipping", order: "asc" },
        context: { shippingCountry: "US", cart: {} },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;

    const json = (await res.json()) as {
      results?: { totalResults?: number; results?: Listing[] }[];
    };
    const block = json.results?.[0];
    const listings = block?.results ?? [];
    if (listings.length === 0) return null;

    const prices = listings
      .map((l) => Number(l.price))
      .filter((p) => Number.isFinite(p) && p > 0);
    if (prices.length === 0) return null;

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    return {
      price: Math.round(avg * 100) / 100,
      listingCount: block?.totalResults ?? listings.length,
    };
  } catch {
    return null;
  }
}
