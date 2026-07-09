import { supabase } from "@/lib/supabase";
import type { Show, ShowInput } from "@/lib/types";

const TABLE = "shows";

export async function createShow(
  show: ShowInput,
  userEmail: string
): Promise<Show> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_email: userEmail,
      name: show.name,
      date: show.date,
      date_end: show.date_end ?? null,
      venue_type: show.venue_type,
      table_fee: show.table_fee ?? null,
      notes: show.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listShows(userEmail: string): Promise<Show[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_email", userEmail)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getShow(
  showId: number,
  userEmail: string
): Promise<Show | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", showId)
    .eq("user_email", userEmail)
    .single();
  if (error) return null;
  return data;
}

export async function updateShow(
  showId: number,
  fields: Partial<ShowInput>,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update(fields)
    .eq("id", showId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

export async function deleteShow(
  showId: number,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", showId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

/** Permanently mark a show as finalized. A show can only be finalized once. */
export async function markShowFinalized(
  showId: number,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ finalized_at: new Date().toISOString() })
    .eq("id", showId)
    .eq("user_email", userEmail);
  if (error) throw error;
}
