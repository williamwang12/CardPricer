import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCards } from "@/lib/db/cards";
import { loadSnapshot } from "@/lib/db/label-snapshot";
import { getLastRefreshed } from "@/lib/db/refresh-log";
import { loadSnapshots } from "@/lib/db/collection-snapshots";
import { loadDashboardData } from "@/lib/db/dashboard";
import DashboardClient from "@/components/dashboard/DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [cards, snapshot, lastRefreshed, snapshots] = await Promise.all([
    loadAllCards(email),
    loadSnapshot(email),
    getLastRefreshed(email),
    loadSnapshots(email),
  ]);

  const data = await loadDashboardData(cards, snapshot, lastRefreshed, snapshots);

  return <DashboardClient data={data} />;
}
