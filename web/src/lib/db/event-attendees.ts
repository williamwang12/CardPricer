import { supabase } from "@/lib/supabase";
import type { EventAttendee, RegistrationStatus } from "@/lib/types";

const TABLE = "event_attendees";

/**
 * Apply to sell at an event. Creates a `pending` registration, or reactivates a
 * previously cancelled/rejected one back to `pending`. An existing
 * approved/pending/waitlisted row is returned unchanged (idempotent apply).
 */
export async function applyToEvent(
  eventId: number,
  userEmail: string,
  vendorNotes?: string | null
): Promise<EventAttendee> {
  const existing = await getRegistration(eventId, userEmail);
  if (existing && ["approved", "pending", "waitlisted"].includes(existing.status)) {
    return existing;
  }
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        event_id: eventId,
        user_email: userEmail,
        status: "pending",
        vendor_notes: vendorNotes ?? null,
        // Clear any prior review when re-applying.
        reviewed_at: null,
        reviewed_by: null,
      },
      { onConflict: "event_id,user_email" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as EventAttendee;
}

/** A single user's registration for an event, or null. */
export async function getRegistration(
  eventId: number,
  userEmail: string
): Promise<EventAttendee | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return data as EventAttendee | null;
}

/** Vendor cancels their own registration. */
export async function cancelRegistration(
  eventId: number,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status: "cancelled" })
    .eq("event_id", eventId)
    .eq("user_email", userEmail);
  if (error) throw error;
}

export interface ReviewInput {
  status: RegistrationStatus;
  booth_label?: string | null;
  organizer_notes?: string | null;
}

/** Organizer sets a registration's status (approve/waitlist/reject) + booth. */
export async function reviewRegistration(
  eventId: number,
  vendorEmail: string,
  input: ReviewInput,
  reviewerEmail: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status: input.status,
    reviewed_at: new Date().toISOString(),
    reviewed_by: reviewerEmail,
  };
  if (input.booth_label !== undefined) patch.booth_label = input.booth_label;
  if (input.organizer_notes !== undefined)
    patch.organizer_notes = input.organizer_notes;
  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("event_id", eventId)
    .eq("user_email", vendorEmail);
  if (error) throw error;
}

/** Whether a user is an approved attendee — the gate for all showcase access. */
export async function isApprovedAttendee(
  eventId: number,
  userEmail: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("status")
    .eq("event_id", eventId)
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "approved";
}

/** Every registration for an event (all statuses) — organizer inbox. */
export async function listRegistrations(
  eventId: number
): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventAttendee[];
}

/** Approved attendees only — vendor directory + marketplace roster. */
export async function listApprovedAttendees(
  eventId: number
): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "approved")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EventAttendee[];
}

/** Count of approved vendors — for capacity checks and display. */
export async function countApprovedAttendees(eventId: number): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "approved");
  if (error) throw error;
  return count ?? 0;
}

/** All of a user's registrations across events — for "my shows" status map. */
export async function getMyRegistrations(
  userEmail: string
): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_email", userEmail);
  if (error) throw error;
  return (data ?? []) as EventAttendee[];
}
