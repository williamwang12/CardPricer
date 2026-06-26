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

export async function saveSnapshot(
  cards: SnapshotCard[],
  userEmail: string
): Promise<void> {
  const { error } = await supabase.from(TABLE).upsert({
    user_email: userEmail,
    downloaded_at: new Date().toISOString(),
    cards_json: JSON.stringify(cards),
  });
  if (error) throw error;
}

export async function loadSnapshot(
  userEmail: string
): Promise<LabelSnapshot | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("downloaded_at, cards_json")
    .eq("user_email", userEmail)
    .single();
  if (error || !data) return null;
  return {
    downloaded_at: data.downloaded_at,
    cards: JSON.parse(data.cards_json) as SnapshotCard[],
  };
}
