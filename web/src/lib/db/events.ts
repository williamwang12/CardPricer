import { supabase } from "@/lib/supabase";
import type { Event, EventInput } from "@/lib/types";

const TABLE = "events";

export async function createEvent(
  event: EventInput,
  createdBy: string
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
      published: event.published ?? true,
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
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
  return data;
}

/** All events, including unpublished drafts — for admin management. */
export async function listAllEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Published events only — what vendors browse. */
export async function listPublishedEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("published", true)
    .order("date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
