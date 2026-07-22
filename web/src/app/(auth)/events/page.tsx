import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listPublishedEvents } from "@/lib/db/events";
import { getMyRegistrations } from "@/lib/db/event-attendees";
import EventsClient from "@/components/events/EventsClient";
import type { RegistrationStatus } from "@/lib/types";

export default async function EventsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [events, myRegs] = await Promise.all([
    listPublishedEvents(),
    getMyRegistrations(email),
  ]);
  // Map event_id -> my registration status (skip cancelled = no active reg).
  const statusByEvent: Record<number, RegistrationStatus> = {};
  for (const r of myRegs) {
    if (r.status !== "cancelled") statusByEvent[r.event_id] = r.status;
  }

  return <EventsClient initialEvents={events} statusByEvent={statusByEvent} />;
}
