import { supabase } from "@/lib/supabase";
import type { EventListing, ListedCard } from "@/lib/types";

const TABLE = "event_listings";

function rowToListing(row: {
  id: number;
  event_id: number;
  user_email: string;
  cards_json: string;
  updated_at: string;
}): EventListing {
  return {
    id: row.id,
    event_id: row.event_id,
    user_email: row.user_email,
    cards: JSON.parse(row.cards_json) as ListedCard[],
    updated_at: row.updated_at,
  };
}

/** Publish (or overwrite) a vendor's listing for an event. */
export async function saveListing(
  eventId: number,
  userEmail: string,
  cards: ListedCard[]
): Promise<EventListing> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        event_id: eventId,
        user_email: userEmail,
        cards_json: JSON.stringify(cards),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "event_id,user_email" }
    )
    .select()
    .single();
  if (error) throw error;
  return rowToListing(data);
}

export async function getMyListing(
  eventId: number,
  userEmail: string
): Promise<EventListing | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToListing(data) : null;
}

export async function deleteListing(
  eventId: number,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("event_id", eventId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

/** All listings for an event (all vendors) — caller filters out their own. */
export async function listEventListings(
  eventId: number
): Promise<EventListing[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId);
  if (error) throw error;
  return (data ?? []).map(rowToListing);
}
