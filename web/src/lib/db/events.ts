import { supabase } from "@/lib/supabase";
import type { Event, EventInput, EventStatus } from "@/lib/types";
import { withDerivedStatus, isVendorVisibleStatus } from "@/lib/event-status";

const TABLE = "events";

export async function createEvent(
  event: EventInput,
  createdBy: string,
  status: EventStatus = "published"
): Promise<Event> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      name: event.name,
      date: event.date,
      date_end: event.date_end ?? null,
      venue_name: event.venue_name ?? null,
      venue_address: event.venue_address ?? null,
      venue_type: event.venue_type,
      description: event.description ?? null,
      status,
      // Keep the legacy boolean in sync for any older reads.
      published: status === "published" || status === "live",
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Admin sets a show's review outcome (approve → published, reject → rejected). */
export async function setShowStatus(
  eventId: number,
  status: EventStatus,
  reviewNote?: string | null
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({
      status,
      published: status === "published" || status === "live",
      review_note: reviewNote ?? null,
    })
    .eq("id", eventId);
  if (error) throw error;
}

/** Shows awaiting admin approval — the admin review queue. */
export async function listPendingShows(): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** All shows created by one organizer (any status) — their "my shows" view. */
export async function listShowsByCreator(email: string): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("created_by", email)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => withDerivedStatus(e));
}

export async function updateEvent(
  eventId: number,
  fields: Partial<EventInput>
): Promise<void> {
  const { error } = await supabase.from(TABLE).update(fields).eq("id", eventId);
  if (error) throw error;
}

export async function deleteEvent(eventId: number): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", eventId);
  if (error) throw error;
}

export async function getEvent(eventId: number): Promise<Event | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", eventId)
    .single();
  if (error) return null;
  return withDerivedStatus(data);
}

/** All events, including unpublished drafts — for admin management. */
export async function listAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((e) => withDerivedStatus(e));
}

/** Public shows only — what vendors browse (upcoming + live, never pending or
 *  ended). We fetch the stored `published`/`live` rows then re-derive by date,
 *  dropping shows whose date has passed (derived `ended`). */
export async function listPublishedEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("status", ["published", "live"])
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? [])
    .map((e) => withDerivedStatus(e))
    .filter((e) => isVendorVisibleStatus(e.status));
}
