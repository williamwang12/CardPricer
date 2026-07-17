import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCardsCached } from "@/lib/db/cards";
import { getLastRefreshed } from "@/lib/db/refresh-log";
import { loadCardImagesCached } from "@/lib/db/catalog";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const [cards, lastRefreshed] = await Promise.all([
    loadAllCardsCached(email),
    getLastRefreshed(email),
  ]);
  const cardImages = await loadCardImagesCached(email, cards);

  return (
    <InventoryClient
      initialCards={cards}
      lastRefreshed={lastRefreshed?.toISOString() ?? null}
      cardImages={cardImages}
    />
  );
}
