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
  const since = (() => {
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  })();

  // Paginate rather than issuing one unbounded query: a single product with
  // multiple sub_type rows accumulates ~2 rows/day, so a lone ascending query
  // with no LIMIT would hit PostgREST's 1000-row cap after ~1.4 years and then
  // silently drop the newest dates (today included). The secondary sort on
  // sub_type_name keeps ordering deterministic across page boundaries so no row
  // is skipped or duplicated. (Set/portfolio charts avoid this entirely by
  // aggregating server-side; a single card returns few enough rows that fetching
  // them all and deduping in JS stays cheap.)
  const PAGE = 1000;
  const rows: PriceHistoryPoint[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from("card_price_history")
      .select("captured_at, market_price, low_price")
      .eq("product_id", productId)
      .order("captured_at", { ascending: true })
      .order("sub_type_name", { ascending: true })
      .range(from, from + PAGE - 1);

    if (since) query = query.gte("captured_at", since);

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as PriceHistoryPoint[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }

  const byDate = new Map<string, PriceHistoryPoint>();
  for (const row of rows) {
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
  // Aggregated server-side by the get_set_price_history Postgres function
  // (scripts/create-set-and-portfolio-price-history-functions.sql). Doing the
  // SUM/GROUP BY in Postgres returns one row per day, which — unlike the old
  // approach of pulling every card_price_history row for the set and summing
  // in JS — is immune to PostgREST's 1000-row cap. That cap, combined with an
  // ascending captured_at order and no LIMIT, used to silently drop the newest
  // dates (including today) for any set with more than 1000 history rows.
  const { data, error } = await supabase.rpc("get_set_price_history", {
    group_id_param: groupId,
    days_back: days ?? null,
  });
  if (error) throw error;

  return ((data ?? []) as { captured_at: string; total_value: number }[]).map(
    (row) => ({
      captured_at: row.captured_at,
      total_value: Math.round(Number(row.total_value) * 100) / 100,
    })
  );
}

// Aggregate price history for an arbitrary set of product IDs (e.g. a
// user's inventory). Aggregated server-side by the get_portfolio_price_history
// Postgres function — same rationale as loadSetPriceHistory above: SUM/GROUP BY
// in Postgres returns one row per day and sidesteps the 1000-row cap that used
// to truncate the newest dates for any portfolio with over 1000 history rows.
export async function loadPortfolioPriceHistory(
  productIds: number[],
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  if (productIds.length === 0) return [];

  const { data, error } = await supabase.rpc("get_portfolio_price_history", {
    product_ids_param: productIds,
    days_back: days ?? null,
  });
  if (error) throw error;

  return ((data ?? []) as { captured_at: string; total_value: number }[]).map(
    (row) => ({
      captured_at: row.captured_at,
      total_value: Math.round(Number(row.total_value) * 100) / 100,
    })
  );
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
