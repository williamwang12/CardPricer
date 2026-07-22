import { auth } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { getProfile, sharesApprovedShow } from "@/lib/db/profiles";
import { isApprovedAttendee } from "@/lib/db/event-attendees";
import { getEvent } from "@/lib/db/events";
import { isParticipant } from "@/lib/db/messaging";
import { isBlockedBetween } from "@/lib/db/blocks";

/**
 * Guest sessions get a throwaway `guest-<uuid>@cardparser.guest` email (see
 * the Credentials "guest" provider in src/lib/auth.ts). Guests may browse but
 * cannot use any write/social feature of the vendor network.
 */
export function isGuestEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith("@cardparser.guest");
}

/** Authenticated email or throw. */
export async function getUserEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

/**
 * Authenticate AND require a real (non-guest) account. Gates every write/social
 * action: apply, publish showcase, offer, message, block, report, edit profile.
 */
export async function requireRealUser(): Promise<string> {
  const email = await getUserEmail();
  if (isGuestEmail(email)) {
    throw new Error("Sign in with Google or Facebook to use this feature");
  }
  return email;
}

/**
 * Require organizer rights: an ADMIN_EMAILS admin, or a user granted
 * `profiles.is_organizer = true`. Guests can never qualify.
 */
export async function requireOrganizer(): Promise<string> {
  const email = await requireRealUser();
  if (isAdmin(email)) return email;
  const profile = await getProfile(email);
  if (profile?.is_organizer) return email;
  throw new Error("Organizer access required");
}

/** Whether a user may manage a given event (its creator, or an admin). */
export async function canManageEvent(
  eventId: number,
  email: string
): Promise<boolean> {
  if (isAdmin(email)) return true;
  const event = await getEvent(eventId);
  return !!event && event.created_by === email;
}

/** Gate for organizer actions on a specific event (review, dashboard). */
export async function requireEventOrganizer(eventId: number): Promise<string> {
  const email = await requireRealUser();
  if (await canManageEvent(eventId, email)) return email;
  throw new Error("Organizer access required");
}

/** Gate for all showcase/marketplace access: a real, approved attendee. */
export async function requireApprovedAttendee(eventId: number): Promise<string> {
  const email = await requireRealUser();
  if (await isApprovedAttendee(eventId, email)) return email;
  throw new Error("You must be an approved vendor for this show");
}

/**
 * Whether `me` may open a conversation with `other`: a real user, sharing at
 * least one approved show, with no block in either direction. (v1 messaging
 * scope: shared-show vendors only.)
 */
export async function canMessage(me: string, other: string): Promise<boolean> {
  if (me === other) return false;
  if (isGuestEmail(me) || isGuestEmail(other)) return false;
  if (await isBlockedBetween(me, other)) return false;
  return sharesApprovedShow(me, other);
}

/** Gate for starting/continuing a conversation with another user. */
export async function requireCanMessage(other: string): Promise<string> {
  const email = await requireRealUser();
  if (!(await canMessage(email, other))) {
    throw new Error("You can only message vendors you share a show with");
  }
  return email;
}

/** Gate for reading/writing a conversation: a real participant only. */
export async function requireConversationParticipant(
  conversationId: number
): Promise<string> {
  const email = await requireRealUser();
  if (await isParticipant(conversationId, email)) return email;
  throw new Error("You are not a participant in this conversation");
}
