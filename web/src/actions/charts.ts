"use server";

import { getAllSets, getSetCardsWithIds } from "@/lib/db/catalog";
import type { CatalogSet, CatalogCardWithId } from "@/lib/db/catalog";
import { isModernMainlineSet } from "@/lib/data/tcgcsv";
import {
  loadCardPriceHistory,
  loadSetPriceHistory,
} from "@/lib/db/card-price-history";
import type {
  PriceHistoryPoint,
  SetPriceHistoryPoint,
} from "@/lib/db/card-price-history";

export async function getModernSetsAction(): Promise<CatalogSet[]> {
  const sets = await getAllSets();
  return sets.filter((s) => isModernMainlineSet(s.group_name));
}

export async function getSetCardsAction(
  groupId: number
): Promise<CatalogCardWithId[]> {
  return getSetCardsWithIds(groupId);
}

export async function getCardHistoryAction(
  productId: number,
  subTypeName: string = "Normal",
  days?: number
): Promise<PriceHistoryPoint[]> {
  return loadCardPriceHistory(productId, subTypeName, days);
}

export async function getSetHistoryAction(
  groupId: number,
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  return loadSetPriceHistory(groupId, days);
}
