"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncCollectr, upsertCard, removeStaleCards } from "@/lib/db/sync";
import { loadAllCards, updatePrices } from "@/lib/db/cards";
import { bulkSearchTcgplayer, loadCatalogIndex } from "@/lib/data/scraper";
import type { CardInput } from "@/lib/types";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export async function syncCollectrAction(
  cards: CardInput[],
  addOnly: boolean
) {
  const email = await getUserEmail();
  const result = await syncCollectr(cards, email, addOnly);
  revalidatePath("/inventory");
  return result;
}

export async function upsertCardAction(card: CardInput) {
  const email = await getUserEmail();
  return upsertCard(card, email);
}

export async function removeStaleCardsAction(importedNames: string[]) {
  const email = await getUserEmail();
  const removed = await removeStaleCards(importedNames, email);
  revalidatePath("/inventory");
  return removed;
}

export async function refreshPricesAction() {
  const email = await getUserEmail();
  const allCards = await loadAllCards(email);
  const nonManual = allCards.filter((c) => !c.manual_price);
  if (nonManual.length === 0) return 0;

  const catalogIndex = await loadCatalogIndex();
  const updates = await bulkSearchTcgplayer(
    nonManual.map((c) => ({ id: c.id, name: c.name, number: c.number })),
    catalogIndex
  );

  if (updates.length > 0) {
    await updatePrices(updates);
  }

  revalidatePath("/inventory");
  return updates.length;
}
