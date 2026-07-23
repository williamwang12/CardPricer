import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCardsCached } from "@/lib/db/cards";
import { loadCardImagesCached, matchInventoryToCatalog } from "@/lib/db/catalog";
import { getConditionedValues } from "@/lib/db/condition-prices";
import { DEFAULT_CONDITION } from "@/lib/trade";
import InventoryClient from "@/components/inventory/InventoryClient";

export default async function InventoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const cards = await loadAllCardsCached(email);
  const cardImages = await loadCardImagesCached(email, cards);

  // Condition-adjusted prices for non-Near-Mint cards (cache-only, so the page
  // never blocks on a live fetch — the background warmer + on-demand set fill
  // the cache). Contained to Inventory: market_price is untouched.
  const conditionedPrices: Record<number, { price: number; source: string }> =
    {};
  const nonNm = cards.filter(
    (c) =>
      !c.manual_price &&
      c.market_price != null &&
      (c.condition ?? DEFAULT_CONDITION) !== DEFAULT_CONDITION
  );
  if (nonNm.length > 0) {
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
        condition: c.condition,
        nmMarket: c.market_price!,
      }));
    const values = await getConditionedValues(
      items.map((i) => ({
        productId: i.productId,
        condition: i.condition,
        nmMarket: i.nmMarket,
      }))
    );
    for (const i of items) {
      const cp = values.get(`${i.productId}|${i.condition}`);
      if (cp) conditionedPrices[i.cardId] = { price: cp.price, source: cp.source };
    }
  }

  return (
    <InventoryClient
      initialCards={cards}
      cardImages={cardImages}
      conditionedPrices={conditionedPrices}
    />
  );
}
