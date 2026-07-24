import type { Card } from "@/lib/types";
import { DEFAULT_CONDITION } from "@/lib/trade";
import { matchInventoryToCatalog } from "@/lib/db/catalog";
import { getConditionedValues } from "@/lib/db/condition-prices";

// Returns copies of the cards with `market_price` replaced by their
// condition-adjusted unit price — the exact value the Inventory page shows.
// Near Mint, manual-price, and unpriced cards are returned unchanged.
//
// WHY: exports (labels / stickers / inventory spreadsheet) read
// `card.market_price`, which is always the base Near Mint price. Changing a
// card's condition only ever updated a separate condition-price cache, so the
// exported files kept showing NM prices. This resolves prices the same way the
// Inventory page does (matchInventoryToCatalog -> getConditionedValues) so
// what you export matches what you see.
export async function applyConditionAdjustedPrices(
  cards: Card[]
): Promise<Card[]> {
  const nonNm = cards.filter(
    (c) =>
      !c.manual_price &&
      c.market_price != null &&
      (c.condition ?? DEFAULT_CONDITION) !== DEFAULT_CONDITION
  );
  if (nonNm.length === 0) return cards;

  const matched = await matchInventoryToCatalog(
    nonNm.map((c) => ({ id: c.id, tcgplayer_url: c.tcgplayer_url }))
  );
  const cardToProduct = new Map<number, number>();
  for (const m of matched) {
    if (!cardToProduct.has(m.cardId)) cardToProduct.set(m.cardId, m.productId);
  }

  const items = nonNm
    .filter((c) => cardToProduct.has(c.id))
    .map((c) => ({
      cardId: c.id,
      productId: cardToProduct.get(c.id)!,
      condition: c.condition ?? DEFAULT_CONDITION,
      nmMarket: c.market_price!,
    }));

  const values = await getConditionedValues(
    items.map((i) => ({
      productId: i.productId,
      condition: i.condition,
      nmMarket: i.nmMarket,
    }))
  );

  const priceByCard = new Map<number, number>();
  for (const i of items) {
    const cp = values.get(`${i.productId}|${i.condition}`);
    if (cp) priceByCard.set(i.cardId, cp.price);
  }

  return cards.map((c) => {
    const adjusted = priceByCard.get(c.id);
    return adjusted != null ? { ...c, market_price: adjusted } : c;
  });
}
