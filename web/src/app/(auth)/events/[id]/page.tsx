import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEvent } from "@/lib/db/events";
import {
  getRegistration,
  listRegistrations,
  countApprovedAttendees,
} from "@/lib/db/event-attendees";
import { getMyListing, listEventListings } from "@/lib/db/event-listings";
import { listOffersForEvent } from "@/lib/db/offers";
import { loadAllCardsCached } from "@/lib/db/cards";
import { canManageEvent } from "@/lib/guards";
import EventDetailClient from "@/components/events/EventDetailClient";
import type { EventAttendee } from "@/lib/types";

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

  // Approved vendors get the marketplace payload; organizers get the inbox.
  const [myListing, myCards, otherListings, offers] = approved
    ? await Promise.all([
        getMyListing(eventId, email),
        loadAllCardsCached(email),
        listEventListings(eventId).then((ls) =>
          ls.filter((l) => l.user_email !== email && l.visibility !== "hidden")
        ),
        listOffersForEvent(eventId, email),
      ])
    : [null, [], [], { incoming: [], outgoing: [] }];

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
      initialOffers={offers}
    />
  );
}
