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
