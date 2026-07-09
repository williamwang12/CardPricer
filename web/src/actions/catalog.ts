"use server";

import { getAllSets, getSetCards } from "@/lib/db/catalog";
import type { CatalogSet, CatalogCard } from "@/lib/db/catalog";

export async function getAllSetsAction(): Promise<CatalogSet[]> {
  return getAllSets();
}

export async function getSetCardsAction(
  groupId: number
): Promise<CatalogCard[]> {
  return getSetCards(groupId);
}
