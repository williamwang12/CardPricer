import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCardsCached } from "@/lib/db/cards";
import { loadCardImagesCached } from "@/lib/db/catalog";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const cards = await loadAllCardsCached(email);
  const cardImages = await loadCardImagesCached(email, cards);

  return (
    <InventoryClient
      initialCards={cards}
      cardImages={cardImages}
    />
  );
}
