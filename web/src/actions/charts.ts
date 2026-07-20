"use server";

import { auth } from "@/lib/auth";
import {
  getAllSets,
  getSetCardsWithIds,
  searchCards,
  matchInventoryToCatalog,
} from "@/lib/db/catalog";
import type {
  CatalogSet,
  CatalogCardWithId,
  CatalogCardSearchResult,
  InventoryChartableCard,
} from "@/lib/db/catalog";
import { loadAllCardsCached } from "@/lib/db/cards";
import {
  loadCardPriceHistory,
  loadSetPriceHistory,
  loadPokemonIndexHistory,
  loadPortfolioPriceHistory,
} from "@/lib/db/card-price-history";
import type {
  PriceHistoryPoint,
  SetPriceHistoryPoint,
} from "@/lib/db/card-price-history";
import { getSp500History } from "@/lib/data/sp500";
import type { IndexHistoryPoint } from "@/lib/data/sp500";

export async function getModernSetsAction(): Promise<CatalogSet[]> {
  return getAllSets();
}

export async function getSetCardsAction(
  groupId: number
): Promise<CatalogCardWithId[]> {
  return getSetCardsWithIds(groupId);
}

export async function getCardHistoryAction(
  productId: number,
  days?: number
): Promise<PriceHistoryPoint[]> {
  return loadCardPriceHistory(productId, days);
}

export async function getSetHistoryAction(
  groupId: number,
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  return loadSetPriceHistory(groupId, days);
}

// ── Compare-chart data sources ──────────────────────────────────────────

export async function searchChartCardsAction(
  query: string
): Promise<CatalogCardSearchResult[]> {
  return searchCards(query, 20);
}

export async function searchChartSetsAction(
  query: string
): Promise<CatalogSet[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const sets = await getAllSets();
  return sets.filter((s) => s.group_name.toLowerCase().includes(q)).slice(0, 20);
}

export async function getMyChartableCardsAction(): Promise<
  InventoryChartableCard[]
> {
  const session = await auth();
  if (!session?.user?.email) return [];
  const cards = await loadAllCardsCached(session.user.email);
  return matchInventoryToCatalog(
    cards.map((c) => ({ id: c.id, tcgplayer_url: c.tcgplayer_url }))
  );
}

export async function getMyInventoryHistoryAction(
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  const session = await auth();
  if (!session?.user?.email) return [];
  const cards = await loadAllCardsCached(session.user.email);
  const matched = await matchInventoryToCatalog(
    cards.map((c) => ({ id: c.id, tcgplayer_url: c.tcgplayer_url }))
  );
  const productIds = matched.map((c) => c.productId);
  return loadPortfolioPriceHistory(productIds, days);
}

export async function getSp500HistoryAction(): Promise<IndexHistoryPoint[]> {
  return getSp500History();
}

export async function getPokemonIndexHistoryAction(
  days?: number
): Promise<SetPriceHistoryPoint[]> {
  return loadPokemonIndexHistory(days);
}

