import { supabase } from "@/lib/supabase";

export interface PriceHistoryPoint {
  captured_at: string;
  market_price: number;
  low_price: number | null;
}

export async function loadCardPriceHistory(
  productId: number,
  subTypeName: string = "Normal",
  days?: number
): Promise<PriceHistoryPoint[]> {
  let query = supabase
    .from("card_price_history")
    .select("captured_at, market_price, low_price")
    .eq("product_id", productId)
    .eq("sub_type_name", subTypeName)
    .order("captured_at", { ascending: true });

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("captured_at", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PriceHistoryPoint[];
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
