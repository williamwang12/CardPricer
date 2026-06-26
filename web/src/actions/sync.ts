"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncCollectr, upsertCard, removeStaleCards } from "@/lib/db/sync";
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
