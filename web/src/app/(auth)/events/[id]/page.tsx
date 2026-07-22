import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEvent } from "@/lib/db/events";
import {
  getRegistration,
  listRegistrations,
  listApprovedAttendees,
  countApprovedAttendees,
} from "@/lib/db/event-attendees";
import { getMyListing, listEventListings } from "@/lib/db/event-listings";
import { getProfilesByEmails } from "@/lib/db/profiles";
import { listOffersForEvent } from "@/lib/db/offers";
import { loadAllCardsCached } from "@/lib/db/cards";
import { canManageEvent } from "@/lib/guards";
import { publicUrl } from "@/lib/storage";
import { buildVendorDirectory } from "@/lib/directory";
import EventDetailClient from "@/components/events/EventDetailClient";
import type { EventAttendee, EventListing, DirectoryVendor } from "@/lib/types";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const { id } = await params;
  const eventId = parseInt(id, 10);
  if (isNaN(eventId)) notFound();

  const event = await getEvent(eventId);
  if (!event) notFound();

  const [registration, canManage, approvedCount] = await Promise.all([
    getRegistration(eventId, email),
    canManageEvent(eventId, email),
    countApprovedAttendees(eventId),
  ]);
  const approved = registration?.status === "approved";

  // Approved vendors get the marketplace payload + the vendor directory.
  let myListing: EventListing | null = null;
  let myCards: Awaited<ReturnType<typeof loadAllCardsCached>> = [];
  let otherListings: EventListing[] = [];
  let offers = { incoming: [], outgoing: [] } as Awaited<
    ReturnType<typeof listOffersForEvent>
  >;
  let directory: DirectoryVendor[] = [];

  if (approved) {
    const [listing, cards, allListings, off, approvedAttendees] =
      await Promise.all([
        getMyListing(eventId, email),
        loadAllCardsCached(email),
        listEventListings(eventId),
        listOffersForEvent(eventId, email),
        listApprovedAttendees(eventId),
      ]);
    myListing = listing;
    myCards = cards;
    offers = off;
    otherListings = allListings.filter(
      (l) => l.user_email !== email && l.visibility !== "hidden"
    );

    // Build the directory: every approved vendor but me, with their profile,
    // booth, and visible showcase cards (see buildVendorDirectory for rules).
    const otherEmails = approvedAttendees
      .filter((a) => a.user_email !== email)
      .map((a) => a.user_email);
    const profiles = await getProfilesByEmails(otherEmails);
    directory = buildVendorDirectory(
      email,
      approvedAttendees,
      profiles,
      allListings,
      (path) => publicUrl("avatars", path)
    );
  }

  const registrations: EventAttendee[] = canManage
    ? await listRegistrations(eventId)
    : [];

  return (
    <EventDetailClient
      event={event}
      registration={registration}
      approvedCount={approvedCount}
      canManage={canManage}
      registrations={registrations}
      myListing={myListing}
      myCards={myCards}
      otherListings={otherListings}
      directory={directory}
      initialOffers={offers}
    />
  );
}
