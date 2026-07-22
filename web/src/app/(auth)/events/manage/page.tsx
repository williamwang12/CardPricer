import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { getProfile } from "@/lib/db/profiles";
import { listShowsByCreator, listPendingShows } from "@/lib/db/events";
import ManageShowsClient from "@/components/events/ManageShowsClient";
import type { Event } from "@/lib/types";

export default async function ManageShowsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const admin = isAdmin(email);
  const profile = admin ? null : await getProfile(email);
  const canOrganize = admin || !!profile?.is_organizer;
  if (!canOrganize) redirect("/events");

  const [myShows, pendingShows] = await Promise.all([
    listShowsByCreator(email),
    admin ? listPendingShows() : Promise.resolve<Event[]>([]),
  ]);

  return (
    <ManageShowsClient
      isAdmin={admin}
      initialMyShows={myShows}
      initialPending={pendingShows}
    />
  );
}
