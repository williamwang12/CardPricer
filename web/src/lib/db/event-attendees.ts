import { supabase } from "@/lib/supabase";
import type { EventAttendee } from "@/lib/types";

const TABLE = "event_attendees";

/** RSVP to an event (or update table number if already RSVP'd). */
export async function rsvpToEvent(
  eventId: number,
  userEmail: string,
  tableNumber?: string | null
): Promise<EventAttendee> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        event_id: eventId,
        user_email: userEmail,
        table_number: tableNumber ?? null,
      },
      { onConflict: "event_id,user_email" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unRsvp(eventId: number, userEmail: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("event_id", eventId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

export async function listAttendees(eventId: number): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function isAttendee(
  eventId: number,
  userEmail: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id")
    .eq("event_id", eventId)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function updateTableNumber(
  eventId: number,
  userEmail: string,
  tableNumber: string | null
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ table_number: tableNumber })
    .eq("event_id", eventId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

/** All of a user's RSVPs, across events — used to build an "am I attending" map. */
export async function getMyRsvps(userEmail: string): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_email", userEmail);
  if (error) throw error;
  return data ?? [];
}
