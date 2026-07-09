import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listPublishedEvents } from "@/lib/db/events";
import { getMyRsvps } from "@/lib/db/event-attendees";
import EventsClient from "@/components/events/EventsClient";

export default async function EventsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [events, myRsvps] = await Promise.all([
    listPublishedEvents(),
    getMyRsvps(email),
  ]);
  const attendingEventIds = new Set(myRsvps.map((r) => r.event_id));

  return <EventsClient initialEvents={events} attendingEventIds={[...attendingEventIds]} />;
}
