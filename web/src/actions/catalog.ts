"use server";

import {
  getAllSets,
  getSetCards,
  searchCards,
  getCatalogTopMoversCached,
} from "@/lib/db/catalog";
import type {
  CatalogSet,
  CatalogCard,
  CatalogCardSearchResult,
  CatalogMover,
} from "@/lib/db/catalog";

export async function getAllSetsAction(): Promise<CatalogSet[]> {
  return getAllSets();
}

export async function getSetCardsAction(
  groupId: number
): Promise<CatalogCard[]> {
  return getSetCards(groupId);
}

export async function searchCardsAction(
  query: string,
  groupId?: number,
  cardNumber?: string
): Promise<CatalogCardSearchResult[]> {
  return searchCards(query, 60, groupId, cardNumber);
}

export async function getCatalogTopMoversAction(): Promise<{
  gainers: CatalogMover[];
  drops: CatalogMover[];
}> {
  return getCatalogTopMoversCached();
}
