import { supabase } from "@/lib/supabase";
import { cardKey } from "@/lib/diff";
import type { SnapshotCardWithQty, ShowDiffResult } from "@/lib/types";

const TABLE = "card_shelf_life";

export interface ShelfLifeRow {
  card_key: string;
  consecutive_shows: number;
  last_show_id: number | null;
}

/**
 * After a show diff is finalized, update shelf-life counters:
 *  - Sold cards: reset to 0
 *  - Unsold cards (in pre-show snapshot, not sold): increment by 1
 *
 * Uses `last_show_id` to prevent double-counting if called multiple times
 * for the same show.
 */
export async function updateShelfLife(
  showId: number,
  diff: ShowDiffResult,
  preSnapshot: SnapshotCardWithQty[],
  userEmail: string
): Promise<void> {
  // Reset sold cards to 0
  for (const s of diff.sold) {
    const key = cardKey(s.name, s.number);
    await supabase.from(TABLE).upsert(
      {
        user_email: userEmail,
        card_key: key,
        consecutive_shows: 0,
        last_show_id: showId,
      },
      { onConflict: "user_email,card_key" }
    );
  }

  // Increment unsold cards (everything in pre that wasn't sold)
  const soldKeys = new Set(diff.sold.map((s) => cardKey(s.name, s.number)));
  for (const c of preSnapshot) {
    const key = cardKey(c.name, c.number);
    if (soldKeys.has(key)) continue;

    // Fetch current row
    const { data: existing } = await supabase
      .from(TABLE)
      .select("consecutive_shows, last_show_id")
      .eq("user_email", userEmail)
      .eq("card_key", key)
      .single();

    // Skip if already counted for this show
    if (existing?.last_show_id === showId) continue;

    const current = existing?.consecutive_shows ?? 0;
    await supabase.from(TABLE).upsert(
      {
        user_email: userEmail,
        card_key: key,
        consecutive_shows: current + 1,
        last_show_id: showId,
      },
      { onConflict: "user_email,card_key" }
    );
  }
}

/** Get all cards at or above the stale threshold. */
export async function getStaleCards(
  userEmail: string,
  threshold: number = 3
): Promise<ShelfLifeRow[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("card_key, consecutive_shows, last_show_id")
    .eq("user_email", userEmail)
    .gte("consecutive_shows", threshold)
    .order("consecutive_shows", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
