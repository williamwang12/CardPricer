"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  addCard as dbAddCard,
  saveEdits as dbSaveEdits,
  replaceAllCards,
  deleteCards,
  updateCard,
  massageNames,
  rollbackImport,
} from "@/lib/db/cards";
import type { Card, CardInput } from "@/lib/types";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export async function addCardAction(card: CardInput) {
  const email = await getUserEmail();
  await dbAddCard(card, email);
  revalidatePath("/inventory");
}

export async function saveEditsAction(
  editedRows: Record<string, Record<string, unknown>>,
  deletedIndices: number[],
  originalCards: Card[]
) {
  await dbSaveEdits(editedRows, deletedIndices, originalCards);
  revalidatePath("/inventory");
}

export async function deleteAllAction() {
  const email = await getUserEmail();
  await replaceAllCards([], email);
  revalidatePath("/inventory");
}

export async function replaceAllAction(cards: CardInput[]) {
  const email = await getUserEmail();
  const count = await replaceAllCards(cards, email);
  revalidatePath("/inventory");
  return count;
}

export async function updateCardAction(
  cardId: number,
  fields: Record<string, unknown>
) {
  await updateCard(cardId, fields);
  revalidatePath("/inventory");
}

export async function deleteCardsAction(cardIds: number[]) {
  await deleteCards(cardIds);
  revalidatePath("/inventory");
}

export async function savePriceAction(
  cardId: number,
  marketPrice: number | null,
  tcgplayerUrl: string | null
) {
  await updateCard(cardId, {
    market_price: marketPrice,
    tcgplayer_url: tcgplayerUrl,
  });
}

export async function saveCostBasisAction(
  cardId: number,
  costBasis: number | null
): Promise<void> {
  await getUserEmail();
  await updateCard(cardId, { cost_basis: costBasis });
  revalidatePath("/inventory");
}

export async function massageNamesAction() {
  const email = await getUserEmail();
  const count = await massageNames(email);
  revalidatePath("/inventory");
  return count;
}

export async function rollbackImportAction(
  imported: { name: string; number: string; quantity: number }[]
) {
  const email = await getUserEmail();
  const count = await rollbackImport(imported, email);
  revalidatePath("/inventory");
  return count;
}
