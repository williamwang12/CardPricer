import { supabase } from "@/lib/supabase";

const TABLE = "collection_snapshots";

export async function saveSnapshot(
  email: string,
  totalValue: number,
  cardCount: number,
  uniqueCount: number
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert(
    {
      user_email: email,
      captured_at: new Date().toISOString().slice(0, 10),
      total_value: totalValue,
      card_count: cardCount,
      unique_count: uniqueCount,
    },
    { onConflict: "user_email,captured_at" }
  );
  if (error) throw error;
}

export interface Snapshot {
  captured_at: string;
  total_value: number;
  card_count: number;
  unique_count: number;
}

export async function loadSnapshots(
  email: string,
  days?: number
): Promise<Snapshot[]> {
  const since = (() => {
    if (!days) return null;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  })();

  // One row per user per day, so a single query stays well under PostgREST's
  // 1000-row cap for ~2.7 years. Paginate anyway so the chart can never
  // silently lose its newest points once a user crosses that horizon — an
  // unbounded ascending query with no LIMIT would drop the most recent days
  // first (the same bug that hit the set/portfolio charts on card_price_history).
  const PAGE = 1000;
  const rows: Snapshot[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase
      .from(TABLE)
      .select("captured_at, total_value, card_count, unique_count")
      .eq("user_email", email)
      .order("captured_at", { ascending: true })
      .range(from, from + PAGE - 1);

    if (since) query = query.gte("captured_at", since);

    const { data, error } = await query;
    if (error) throw error;
    const batch = data ?? [];
    for (const r of batch) {
      rows.push({
        captured_at: r.captured_at,
        total_value: Number(r.total_value),
        card_count: r.card_count,
        unique_count: r.unique_count,
      });
    }
    if (batch.length < PAGE) break;
  }
  return rows;
}
