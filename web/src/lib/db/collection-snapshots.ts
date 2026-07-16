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
  let query = supabase
    .from(TABLE)
    .select("captured_at, total_value, card_count, unique_count")
    .eq("user_email", email)
    .order("captured_at", { ascending: true });

  if (days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    query = query.gte("captured_at", since.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    captured_at: r.captured_at,
    total_value: Number(r.total_value),
    card_count: r.card_count,
    unique_count: r.unique_count,
  }));
}
