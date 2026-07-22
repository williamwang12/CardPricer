// TCGplayer "latest sales" lookup — the only public source of real per-card
// sales volume (tcgcsv's catalog feed carries prices but no volume). Used
// on-demand for the handful of cards in a trade, never in a catalog-wide cron,
// so we stay well under TCGplayer's per-domain rate limits.

const LATEST_SALES_URL = (productId: number) =>
  `https://mpapi.tcgplayer.com/v2/product/${productId}/latestsales`;

// A browser-like Referer/Origin is required — without it the endpoint returns
// 403 from bot protection.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: "https://www.tcgplayer.com",
  Referer: "https://www.tcgplayer.com/",
};

interface LatestSale {
  quantity: number;
  purchasePrice: number;
  orderDate: string;
}

// Fetches up to `limit` most-recent sales across all variants/conditions.
// Returns null on any failure (403, timeout, malformed) so callers fall back
// to the proxy score instead of throwing.
async function fetchLatestSales(
  productId: number,
  limit = 25
): Promise<LatestSale[] | null> {
  try {
    const res = await fetch(LATEST_SALES_URL(productId), {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        conditions: [],
        languages: [],
        variants: [],
        listingType: "All",
        offset: 0,
        limit,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: LatestSale[] };
    return json.data ?? null;
  } catch {
    return null;
  }
}

export interface SalesVelocity {
  salesPerDay: number;
  windowDays: number;
}

// Derives sales velocity from the most-recent-sales sample: total quantity
// sold divided by the span the sample covers. Needs at least two sales to
// establish a time span; returns null otherwise so the caller uses the proxy.
export async function getSalesVelocity(
  productId: number
): Promise<SalesVelocity | null> {
  const sales = await fetchLatestSales(productId);
  if (!sales || sales.length < 2) return null;

  const times = sales
    .map((s) => new Date(s.orderDate).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (times.length < 2) return null;

  const spanMs = times[times.length - 1] - times[0];
  // Clamp the span so a burst of sales in a few minutes doesn't divide by ~0.
  const windowDays = Math.max(spanMs / 86_400_000, 0.25);

  const totalQty = sales.reduce((sum, s) => sum + (s.quantity || 1), 0);
  const salesPerDay = totalQty / windowDays;

  return { salesPerDay, windowDays };
}

// Maps sales/day to a 0..1 liquidity score. A card selling ~1/day lands at
// 0.5; many per day saturates toward 1; rare sales approach 0.
export function velocityToScore(salesPerDay: number): number {
  if (salesPerDay <= 0) return 0;
  return salesPerDay / (salesPerDay + 1);
}
