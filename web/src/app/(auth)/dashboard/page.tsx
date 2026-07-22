import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCardsCached } from "@/lib/db/cards";
import { loadSnapshot } from "@/lib/db/label-snapshot";
import { loadSnapshots } from "@/lib/db/collection-snapshots";
import { listShows } from "@/lib/db/shows";
import { loadDashboardData } from "@/lib/db/dashboard";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [cards, snapshot, snapshots, shows] = await Promise.all([
    loadAllCardsCached(email),
    loadSnapshot(email),
    loadSnapshots(email),
    listShows(email),
  ]);

  const data = await loadDashboardData(cards, snapshot, snapshots, shows);

  return <DashboardClient data={data} />;
}
