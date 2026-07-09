import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { listShows } from "@/lib/db/shows";
import ShowsClient from "@/components/shows/ShowsClient";

export default async function ShowsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const shows = await listShows(email);

  return <ShowsClient initialShows={shows} />;
}
