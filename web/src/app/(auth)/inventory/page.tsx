import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCards } from "@/lib/db/cards";
import { getLastRefreshed } from "@/lib/db/refresh-log";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [cards, lastRefreshed] = await Promise.all([
    loadAllCards(email),
    getLastRefreshed(email),
  ]);

  return (
    <InventoryClient
      initialCards={cards}
      lastRefreshed={lastRefreshed?.toISOString() ?? null}
    />
  );
}
