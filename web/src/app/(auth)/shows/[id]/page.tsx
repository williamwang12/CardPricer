import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getShow } from "@/lib/db/shows";
import { loadShowSnapshots } from "@/lib/db/show-snapshots";
import ShowDetailClient from "@/components/shows/ShowDetailClient";

export default async function ShowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const { id } = await params;
  const showId = parseInt(id, 10);
  if (isNaN(showId)) notFound();

  const show = await getShow(showId, email);
  if (!show) notFound();

  const snapshots = await loadShowSnapshots(showId, email);

  return (
    <ShowDetailClient
      show={show}
      initialPre={snapshots.pre}
      initialPost={snapshots.post}
    />
  );
}
