"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireAdmin, isAdmin } from "@/lib/admin";
import {
  createEvent,
  updateEvent,
  deleteEvent,
  getEvent,
  listAllEvents,
  listPublishedEvents,
  listPendingShows,
  listShowsByCreator,
  setShowStatus,
} from "@/lib/db/events";
import { setOrganizer } from "@/lib/db/profiles";
import {
  applyToEvent,
  cancelRegistration,
  getRegistration,
  reviewRegistration,
  listRegistrations,
  listApprovedAttendees,
  countApprovedAttendees,
  getMyRegistrations,
  type ReviewInput,
} from "@/lib/db/event-attendees";
import { deleteListing } from "@/lib/db/event-listings";
import { deleteOffersForListing } from "@/lib/db/offers";
import {
  requireRealUser,
  requireOrganizer,
  requireEventOrganizer,
  canManageEvent,
} from "@/lib/guards";
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

// ── Organizer: create shows (Tier 1 — admin auto-publishes, else pending) ────

export async function createShowAction(input: EventInput): Promise<Event> {
  const email = await requireOrganizer();
  const status = isAdmin(email) ? "published" : "pending_approval";
  const event = await createEvent(input, email, status);
  revalidatePath("/events");
  revalidatePath("/events/manage");
  revalidatePath("/admin/events");
  return event;
}

/** An organizer's own shows (any status), for their management view. */
export async function listMyShowsAction(): Promise<Event[]> {
  const email = await requireOrganizer();
  return listShowsByCreator(email);
}

// ── Admin: review show requests + grant organizer access ─────────────────────

export async function listPendingShowsAction(): Promise<Event[]> {
  await requireAdmin();
  return listPendingShows();
}

export async function approveShowAction(eventId: number): Promise<void> {
  await requireAdmin();
  await setShowStatus(eventId, "published");
  revalidatePath("/events");
  revalidatePath("/events/manage");
  revalidatePath("/admin/events");
}

export async function rejectShowAction(
  eventId: number,
  note?: string | null
): Promise<void> {
  await requireAdmin();
  await setShowStatus(eventId, "rejected", note ?? null);
  revalidatePath("/events");
  revalidatePath("/events/manage");
  revalidatePath("/admin/events");
}

/** Admin grants or revokes a user's organizer capability. */
export async function setOrganizerAction(
  targetEmail: string,
  isOrganizer: boolean
): Promise<void> {
  await requireAdmin();
  await setOrganizer(targetEmail.trim().toLowerCase(), isOrganizer);
  revalidatePath("/admin/events");
}

export async function listAllEventsAction(): Promise<Event[]> {
  await requireAdmin();
  return listAllEvents();
}

// ── Vendor: browse + apply ───────────────────────────────────────────────────

export async function listPublishedEventsAction(): Promise<Event[]> {
  await getUserEmail();
  return listPublishedEvents();
}

export async function getEventAction(eventId: number): Promise<Event | null> {
  await getUserEmail();
  return getEvent(eventId);
}

/** A user's registrations across all events (for status badges). */
export async function getMyRegistrationsAction(): Promise<EventAttendee[]> {
  const email = await getUserEmail();
  return getMyRegistrations(email);
}

/** The caller's registration for one event (status, booth, notes), or null. */
export async function getMyRegistrationAction(
  eventId: number
): Promise<EventAttendee | null> {
  const email = await getUserEmail();
  return getRegistration(eventId, email);
}

function isRegistrationOpen(event: Event): boolean {
  const now = Date.now();
  if (event.registration_opens_at &&
      now < Date.parse(event.registration_opens_at)) return false;
  if (event.registration_closes_at &&
      now > Date.parse(event.registration_closes_at)) return false;
  return true;
}

/** Vendor applies to sell at a show — creates a `pending` registration. */
export async function applyToEventAction(
  eventId: number,
  vendorNotes?: string | null
): Promise<EventAttendee> {
  const email = await requireRealUser();
  // The show's organizer (creator or an admin) manages it; they don't apply to
  // their own show as a vendor. Guard here so a stray click can't create a
  // self-application that then shows up in their own review queue.
  if (await canManageEvent(eventId, email)) {
    throw new Error("You organize this show, so you can't apply to it as a vendor.");
  }
  const event = await getEvent(eventId);
  if (
    !event ||
    event.status === "draft" ||
    event.status === "cancelled" ||
    event.status === "ended"
  ) {
    throw new Error("This show isn't accepting applications");
  }
  if (!isRegistrationOpen(event)) {
    throw new Error("Applications for this show are closed");
  }
  // Capacity guards new approvals, but block obviously-full shows at apply time
  // too so vendors aren't misled. Final capacity is enforced on approval.
  const existing = await getRegistration(eventId, email);
  if (
    event.vendor_capacity != null &&
    !existing &&
    (await countApprovedAttendees(eventId)) >= event.vendor_capacity
  ) {
    throw new Error("This show is at vendor capacity");
  }
  const reg = await applyToEvent(eventId, email, vendorNotes);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
  return reg;
}

/** Cancelling also tears down the vendor's listing + any offers for this event. */
export async function cancelRegistrationAction(eventId: number): Promise<void> {
  const email = await requireRealUser();
  await deleteOffersForListing(eventId, email);
  await deleteListing(eventId, email);
  await cancelRegistration(eventId, email);
  revalidatePath("/events");
  revalidatePath(`/events/${eventId}`);
}

// ── Organizer: review applications ───────────────────────────────────────────

/** Full registration list for an event — organizer inbox. */
export async function listRegistrationsAction(
  eventId: number
): Promise<EventAttendee[]> {
  await requireEventOrganizer(eventId);
  const [event, regs] = await Promise.all([
    getEvent(eventId),
    listRegistrations(eventId),
  ]);
  // Never list the show's own organizer as a vendor applicant — they manage
  // the show, they don't apply to it. Defends against any pre-existing
  // self-application rows too.
  return regs.filter((r) => r.user_email !== event?.created_by);
}

/** Organizer sets a vendor's status (approve/waitlist/reject) + booth. */
export async function reviewRegistrationAction(
  eventId: number,
  vendorEmail: string,
  input: ReviewInput
): Promise<void> {
  const reviewer = await requireEventOrganizer(eventId);
  if (input.status === "approved") {
    const event = await getEvent(eventId);
    const current = await getRegistration(eventId, vendorEmail);
    if (
      event?.vendor_capacity != null &&
      current?.status !== "approved" &&
      (await countApprovedAttendees(eventId)) >= event.vendor_capacity
    ) {
      throw new Error("Show is at vendor capacity, waitlist instead");
    }
  }
  await reviewRegistration(eventId, vendorEmail, input, reviewer);
  revalidatePath(`/events/${eventId}`);
}

/** Whether the caller can manage this event (drives the organizer UI). */
export async function canManageEventAction(eventId: number): Promise<boolean> {
  const email = await getUserEmail();
  return canManageEvent(eventId, email);
}

/** Approved-vendor count — for the organizer dashboard. */
export async function approvedCountAction(eventId: number): Promise<number> {
  await requireEventOrganizer(eventId);
  return countApprovedAttendees(eventId);
}

export async function listApprovedAttendeesAction(
  eventId: number
): Promise<EventAttendee[]> {
  await requireRealUser();
  return listApprovedAttendees(eventId);
}
