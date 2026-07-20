import { supabase } from "@/lib/supabase";

const TABLE = "label_snapshots";

export interface SnapshotCard {
  name: string;
  number: string;
  market_price: number | null;
}

export interface LabelSnapshot {
  downloaded_at: string;
  cards: SnapshotCard[];
}

/** Summary returned when listing all snapshots (without the heavy cards_json). */
export interface SnapshotSummary {
  downloaded_at: string;
  card_count: number;
}

export async function saveSnapshot(
  cards: SnapshotCard[],
  userEmail: string
): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    user_email: userEmail,
    downloaded_at: new Date().toISOString(),
    cards_json: JSON.stringify(cards),
  });
  if (error) throw error;
}

/** List all snapshot timestamps for a user (newest first). */
export async function listSnapshots(
  userEmail: string
): Promise<SnapshotSummary[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("downloaded_at, cards_json")
    .eq("user_email", userEmail)
    .order("downloaded_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    downloaded_at: row.downloaded_at,
    card_count: (JSON.parse(row.cards_json) as SnapshotCard[]).length,
  }));
}

/** Load a specific snapshot by its downloaded_at timestamp. */
export async function loadSnapshotAt(
  userEmail: string,
  downloadedAt: string
): Promise<LabelSnapshot | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("downloaded_at, cards_json")
    .eq("user_email", userEmail)
    .eq("downloaded_at", downloadedAt)
    .single();
  if (error || !data) return null;
  return {
    downloaded_at: data.downloaded_at,
    cards: JSON.parse(data.cards_json) as SnapshotCard[],
  };
}

/** Load the most recent snapshot (convenience for the default view). */
export async function loadSnapshot(
  userEmail: string
): Promise<LabelSnapshot | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("downloaded_at, cards_json")
    .eq("user_email", userEmail)
    .order("downloaded_at", { ascending: false })
    .limit(1)
    .single();
  if (error || !data) return null;
  return {
    downloaded_at: data.downloaded_at,
    cards: JSON.parse(data.cards_json) as SnapshotCard[],
  };
}
