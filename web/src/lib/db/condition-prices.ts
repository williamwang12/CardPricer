import { supabase } from "@/lib/supabase";
import { fetchConditionPrice } from "@/lib/data/tcg-listings";
import { conditionMultiplier, DEFAULT_CONDITION } from "@/lib/trade";

const CACHE_TTL_HOURS = 24;

export type PriceSource = "listings" | "multiplier" | "nm";

export interface ConditionedPrice {
  price: number;
  source: PriceSource;
  listingCount: number | null;
}

function key(productId: number, condition: string): string {
  return `${productId}|${condition}`;
}

// Fresh cache rows for the given (product, condition) pairs. Wrapped so a
// missing card_condition_prices table degrades to "no cache".
async function readCache(
  pairs: { productId: number; condition: string }[]
): Promise<Map<string, ConditionedPrice>> {
  const out = new Map<string, ConditionedPrice>();
  if (pairs.length === 0) return out;
  try {
    const cutoff = new Date(
      Date.now() - CACHE_TTL_HOURS * 3_600_000
    ).toISOString();
    const productIds = [...new Set(pairs.map((p) => p.productId))];
    const conditions = [...new Set(pairs.map((p) => p.condition))];
    const wanted = new Set(pairs.map((p) => key(p.productId, p.condition)));

    const { data, error } = await supabase
      .from("card_condition_prices")
      .select("product_id, condition, price, listing_count, source, computed_at")
      .in("product_id", productIds)
      .in("condition", conditions)
      .gte("computed_at", cutoff);
    if (error) return out;

    for (const r of data ?? []) {
      const k = key(r.product_id, r.condition);
      if (!wanted.has(k)) continue;
      out.set(k, {
        price: Number(r.price),
        source: r.source === "multiplier" ? "multiplier" : "listings",
        listingCount: r.listing_count != null ? Number(r.listing_count) : null,
      });
    }
  } catch {
    /* table missing */
  }
  return out;
}

// Condition-adjusted value per item, cache-only (never blocks on a live
// fetch — safe for page loads). Near Mint uses the passed NM market price;
// non-NM uses a fresh cached listings price, else a flat multiplier fallback.
export async function getConditionedValues(
  items: { productId: number; condition: string; nmMarket: number }[]
): Promise<Map<string, ConditionedPrice>> {
  const out = new Map<string, ConditionedPrice>();
  const nonNm = items.filter((i) => i.condition !== DEFAULT_CONDITION);
  const cache = await readCache(
    nonNm.map((i) => ({ productId: i.productId, condition: i.condition }))
  );

  for (const i of items) {
    const k = key(i.productId, i.condition);
    if (i.condition === DEFAULT_CONDITION) {
      out.set(k, { price: i.nmMarket, source: "nm", listingCount: null });
      continue;
    }
    const cached = cache.get(k);
    if (cached) {
      out.set(k, cached);
    } else {
      out.set(k, {
        price: i.nmMarket * conditionMultiplier(i.condition),
        source: "multiplier",
        listingCount: null,
      });
    }
  }
  return out;
}

// Single fresh cached price for one (product, condition), or null on miss.
// Used to decide whether a set-condition needs a (quota-counted) live fetch.
export async function getCachedConditionPrice(
  productId: number,
  condition: string
): Promise<ConditionedPrice | null> {
  const m = await readCache([{ productId, condition }]);
  return m.get(key(productId, condition)) ?? null;
}

async function writeCache(
  productId: number,
  condition: string,
  cp: ConditionedPrice
): Promise<void> {
  try {
    await supabase.from("card_condition_prices").upsert(
      {
        product_id: productId,
        condition,
        price: cp.price,
        listing_count: cp.listingCount,
        source: cp.source === "listings" ? "listings" : "multiplier",
        computed_at: new Date().toISOString(),
      },
      { onConflict: "product_id,condition" }
    );
  } catch {
    /* table missing — skip caching */
  }
}

// Live-fetch a single (product, condition) price from TCGplayer listings and
// cache it. Falls back to (and caches) the multiplier price on failure so we
// don't hammer a blocked/empty endpoint. Used on-demand (when a user sets a
// card's condition) and by the background warmer. Near Mint never fetches.
export async function refreshConditionPrice(
  productId: number,
  condition: string,
  nmMarket: number
): Promise<ConditionedPrice> {
  if (condition === DEFAULT_CONDITION) {
    return { price: nmMarket, source: "nm", listingCount: null };
  }

  const listings = await fetchConditionPrice(productId, condition);
  const cp: ConditionedPrice = listings
    ? { price: listings.price, source: "listings", listingCount: listings.listingCount }
    : {
        price: nmMarket * conditionMultiplier(condition),
        source: "multiplier",
        listingCount: null,
      };

  await writeCache(productId, condition, cp);
  return cp;
}
