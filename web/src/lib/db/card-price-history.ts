import { supabase } from "@/lib/supabase";

export interface PriceHistoryPoint {
  captured_at: string;
  market_price: number;
  low_price: number | null;
}

export async function loadCardPriceHistory(
  productId: number,
  days?: number
): Promise<PriceHistoryPoint[]> {
  // A single product_id can have more than one sub_type_name row (e.g. a
  // "Normal" print and a "Reverse Holofoil" print sharing the same
  // product_id, each with its own price) — the catalog/search/movers
  // queries elsewhere in the app always surface the higher-priced variant
  // for a given card, so do the same here per date instead of hardcoding a
  // "Normal" filter, which silently returned zero rows for any card whose
  // priced variant happened to be Holofoil/Reverse Holofoil (the majority
  // of modern cards).
  let query = supabase
    .from("card_price_history")
    .select("captured_at, market_price, low_price")
    .eq("product_id", productId)
    .order("captured_at", { ascending: true });

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("captured_at", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;

  const byDate = new Map<string, PriceHistoryPoint>();
  for (const row of (data ?? []) as PriceHistoryPoint[]) {
    const existing = byDate.get(row.captured_at);
    if (!existing || row.market_price > existing.market_price) {
      byDate.set(row.captured_at, row);
    }
  }

  return Array.from(byDate.values()).sort((a, b) =>
    a.captured_at.localeCompare(b.captured_at)
  );
}

export interface SetPriceHistoryPoint {
  captured_at: string;
  total_value: number;
}

export async function loadSetPriceHistory(
  groupId: number,
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  // First get all product_ids for this group
  const { data: products, error: prodErr } = await supabase
    .from("tcg_catalog")
    .select("product_id")
    .eq("group_id", groupId);

  if (prodErr) throw prodErr;
  if (!products || products.length === 0) return [];

  const productIds = products.map((p) => p.product_id);

  let query = supabase
    .from("card_price_history")
    .select("captured_at, market_price")
    .in("product_id", productIds)
    .order("captured_at", { ascending: true });

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("captured_at", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Aggregate by date
  const byDate = new Map<string, number>();
  for (const row of data) {
    const date = row.captured_at as string;
    const price = Number(row.market_price) || 0;
    byDate.set(date, (byDate.get(date) ?? 0) + price);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([captured_at, total_value]) => ({
      captured_at,
      total_value: Math.round(total_value * 100) / 100,
    }));
}

// Aggregate price history for an arbitrary set of product IDs (e.g. a
// user's inventory). Same aggregation logic as loadSetPriceHistory but
// accepts product IDs directly instead of looking them up by group_id.
export async function loadPortfolioPriceHistory(
  productIds: number[],
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  if (productIds.length === 0) return [];

  // Supabase .in() can handle large arrays, but batch into chunks of 500
  // to stay within URL-length limits for GET requests.
  const BATCH = 500;
  const allRows: { captured_at: string; market_price: number }[] = [];

  for (let i = 0; i < productIds.length; i += BATCH) {
    const chunk = productIds.slice(i, i + BATCH);
    let query = supabase
      .from("card_price_history")
      .select("captured_at, market_price")
      .in("product_id", chunk)
      .order("captured_at", { ascending: true });

    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("captured_at", since.toISOString().slice(0, 10));
    }

    const { data, error } = await query;
    if (error) throw error;
    if (data) allRows.push(...(data as { captured_at: string; market_price: number }[]));
  }

  if (allRows.length === 0) return [];

  const byDate = new Map<string, number>();
  for (const row of allRows) {
    const price = Number(row.market_price) || 0;
    byDate.set(row.captured_at, (byDate.get(row.captured_at) ?? 0) + price);
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([captured_at, total_value]) => ({
      captured_at,
      total_value: Math.round(total_value * 100) / 100,
    }));
}

// Catalog-wide "Pokemon index" — total market value of every priced card,
// summed per day. Aggregated server-side by the get_pokemon_index_history
// Postgres function (scripts/create-pokemon-index-history-function.sql)
// rather than pulling every card_price_history row to the client, since
// that table grows by ~23k rows/day and would quickly become too large to
// aggregate in JS the way loadSetPriceHistory does for a single set.
export async function loadPokemonIndexHistory(
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  const { data, error } = await supabase.rpc("get_pokemon_index_history", {
    days_back: days ?? null,
  });
  if (error) throw error;

  return ((data ?? []) as { captured_at: string; total_value: number }[]).map(
    (row) => ({
      captured_at: row.captured_at,
      total_value: Number(row.total_value),
    })
  );
}
