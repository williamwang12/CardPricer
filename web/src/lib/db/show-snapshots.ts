import { supabase } from "@/lib/supabase";
import { loadAllCards } from "./cards";
import type { ShowSnapshot, SnapshotCardWithQty } from "@/lib/types";

const TABLE = "show_snapshots";

/** Snapshot the user's current inventory and attach it to a show. */
export async function takeSnapshot(
  showId: number,
  type: "pre" | "post",
  userEmail: string
): Promise<ShowSnapshot> {
  const cards = await loadAllCards(userEmail);
  const snapshotCards: SnapshotCardWithQty[] = cards.map((c) => ({
    name: c.name,
    number: c.number,
    quantity: c.quantity,
    market_price: c.market_price,
  }));

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        show_id: showId,
        user_email: userEmail,
        type,
        cards_json: JSON.stringify(snapshotCards),
        created_at: new Date().toISOString(),
      },
      { onConflict: "show_id,type" }
    )
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    show_id: data.show_id,
    type: data.type,
    cards: JSON.parse(data.cards_json) as SnapshotCardWithQty[],
    created_at: data.created_at,
  };
}

/** Find shows starting today or tomorrow that don't have a pre-snapshot yet. */
export async function findShowsNeedingPreSnapshot(): Promise<
  { show_id: number; user_email: string }[]
> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString().slice(0, 10);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  // Get non-finalized shows starting today or tomorrow
  const { data: shows, error: showsErr } = await supabase
    .from("shows")
    .select("id, user_email")
    .is("finalized_at", null)
    .gte("date", todayStr)
    .lte("date", tomorrowStr);
  if (showsErr) throw showsErr;
  if (!shows || shows.length === 0) return [];

  // Check which already have a pre-snapshot
  const showIds = shows.map((s) => s.id);
  const { data: existing, error: snapErr } = await supabase
    .from(TABLE)
    .select("show_id")
    .in("show_id", showIds)
    .eq("type", "pre");
  if (snapErr) throw snapErr;

  const hasPreSet = new Set((existing ?? []).map((r) => r.show_id));
  return shows
    .filter((s) => !hasPreSet.has(s.id))
    .map((s) => ({ show_id: s.id, user_email: s.user_email }));
}

/** Batch-load snapshot status for multiple shows. Returns a map of showId → { hasPre, hasPost }. */
export async function loadSnapshotStatuses(
  showIds: number[],
  userEmail: string
): Promise<Map<number, { hasPre: boolean; hasPost: boolean }>> {
  const result = new Map<number, { hasPre: boolean; hasPost: boolean }>();
  if (showIds.length === 0) return result;

  const { data, error } = await supabase
    .from(TABLE)
    .select("show_id, type")
    .in("show_id", showIds)
    .eq("user_email", userEmail);
  if (error) throw error;

  for (const id of showIds) {
    result.set(id, { hasPre: false, hasPost: false });
  }
  for (const row of data ?? []) {
    const entry = result.get(row.show_id);
    if (!entry) continue;
    if (row.type === "pre") entry.hasPre = true;
    if (row.type === "post") entry.hasPost = true;
  }
  return result;
}

/** Load snapshots for a show. Returns { pre, post } — either may be null. */
export async function loadShowSnapshots(
  showId: number,
  userEmail: string
): Promise<{ pre: ShowSnapshot | null; post: ShowSnapshot | null }> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("show_id", showId)
    .eq("user_email", userEmail);
  if (error) throw error;

  let pre: ShowSnapshot | null = null;
  let post: ShowSnapshot | null = null;

  for (const row of data ?? []) {
    const snapshot: ShowSnapshot = {
      id: row.id,
      show_id: row.show_id,
      type: row.type,
      cards: JSON.parse(row.cards_json) as SnapshotCardWithQty[],
      created_at: row.created_at,
    };
    if (row.type === "pre") pre = snapshot;
    if (row.type === "post") post = snapshot;
  }

  return { pre, post };
}
