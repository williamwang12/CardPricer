"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  listAllEvents,
  listPublishedEvents,
} from "@/lib/db/events";
import {
  rsvpToEvent,
  unRsvp,
  listAttendees,
  isAttendee,
  updateTableNumber,
  getMyRsvps,
} from "@/lib/db/event-attendees";
import { deleteListing } from "@/lib/db/event-listings";
import { deleteOffersForListing } from "@/lib/db/offers";
import type { Event, EventInput, EventAttendee } from "@/lib/types";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

// ── Admin: event CRUD ────────────────────────────────────────────────────────

export async function createEventAction(input: EventInput): Promise<Event> {
  const adminEmail = await requireAdmin();
  const event = await createEvent(input, adminEmail);
  revalidatePath("/events");
  revalidatePath("/admin/events");
  return event;
}

export async function updateEventAction(
  eventId: number,
  fields: Partial<EventInput>
): Promise<void> {
  await requireAdmin();
  await updateEvent(eventId, fields);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/admin/events");
}

export async function deleteEventAction(eventId: number): Promise<void> {
  await requireAdmin();
  await deleteEvent(eventId);
  revalidatePath("/events");
  revalidatePath("/admin/events");
}

export async function togglePublishAction(
  eventId: number,
  published: boolean
): Promise<void> {
  await requireAdmin();
  await updateEvent(eventId, { published });
  revalidatePath("/events");
  revalidatePath("/admin/events");
}

export async function listAllEventsAction(): Promise<Event[]> {
  await requireAdmin();
  return listAllEvents();
}

// ── Vendor: browse + RSVP ────────────────────────────────────────────────────

export async function listPublishedEventsAction(): Promise<Event[]> {
  await getUserEmail();
  return listPublishedEvents();
}

export async function getEventAction(eventId: number): Promise<Event | null> {
  await getUserEmail();
  return getEvent(eventId);
}

export async function getMyRsvpsAction(): Promise<EventAttendee[]> {
  const email = await getUserEmail();
  return getMyRsvps(email);
}

export async function isAttendingAction(eventId: number): Promise<boolean> {
  const email = await getUserEmail();
  return isAttendee(eventId, email);
}

export async function listAttendeesAction(
  eventId: number
): Promise<EventAttendee[]> {
  await getUserEmail();
  return listAttendees(eventId);
}

export async function rsvpAction(
  eventId: number,
  tableNumber?: string | null
): Promise<EventAttendee> {
  const email = await getUserEmail();
  const event = await getEvent(eventId);
  if (!event || !event.published) throw new Error("Event not available");
  const attendee = await rsvpToEvent(eventId, email, tableNumber);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  return attendee;
}

/** Un-RSVP also tears down the vendor's listing + any offers on it for this event. */
export async function unRsvpAction(eventId: number): Promise<void> {
  const email = await getUserEmail();
  await deleteOffersForListing(eventId, email);
  await deleteListing(eventId, email);
  await unRsvp(eventId, email);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

export async function updateTableNumberAction(
  eventId: number,
  tableNumber: string | null
): Promise<void> {
  const email = await getUserEmail();
  await updateTableNumber(eventId, email, tableNumber);
  revalidatePath(`/events/${eventId}`);
}
