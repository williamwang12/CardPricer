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
