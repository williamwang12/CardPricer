import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listShows } from "@/lib/db/shows";
import { loadSnapshotStatuses } from "@/lib/db/show-snapshots";
import ShowsClient from "@/components/shows/ShowsClient";

export default async function ShowsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const shows = await listShows(email);
  const snapshotStatuses = await loadSnapshotStatuses(
    shows.map((s) => s.id),
    email
  );

  // Convert Map to a plain object for serialization
  const statuses: Record<number, { hasPre: boolean; hasPost: boolean }> = {};
  for (const [id, status] of snapshotStatuses) {
    statuses[id] = status;
  }

  return <ShowsClient initialShows={shows} snapshotStatuses={statuses} />;
}
