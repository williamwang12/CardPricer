import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getEvent } from "@/lib/db/events";
import { isAttendee, listAttendees } from "@/lib/db/event-attendees";
import { getMyListing, listEventListings } from "@/lib/db/event-listings";
import { listOffersForEvent } from "@/lib/db/offers";
import { loadAllCards } from "@/lib/db/cards";
import EventDetailClient from "@/components/events/EventDetailClient";

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

  const attending = await isAttendee(eventId, email);

  // Only fetch attendee-gated data once the vendor has actually RSVP'd.
  const [attendees, myListing, myCards, otherListings, offers] = attending
    ? await Promise.all([
        listAttendees(eventId),
        getMyListing(eventId, email),
        loadAllCards(email),
        listEventListings(eventId).then((ls) =>
          ls.filter((l) => l.user_email !== email)
        ),
        listOffersForEvent(eventId, email),
      ])
    : [await listAttendees(eventId), null, [], [], { incoming: [], outgoing: [] }];

  return (
    <EventDetailClient
      event={event}
      attending={attending}
      attendeeCount={attendees.length}
      myListing={myListing}
      myCards={myCards}
      otherListings={otherListings}
      initialOffers={offers}
    />
  );
}
