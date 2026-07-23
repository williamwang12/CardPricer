"use server";

import { revalidatePath, updateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  addCard as dbAddCard,
  saveEdits as dbSaveEdits,
  replaceAllCards,
  deleteCards,
  updateCard,
  massageNames,
  rollbackImport,
  cardsTag,
} from "@/lib/db/cards";
import {
  refreshConditionPrice,
  getCachedConditionPrice,
} from "@/lib/db/condition-prices";
import { getUsageToday, incrementUsage } from "@/lib/db/daily-usage";
import {
  conditionMultiplier,
  DEFAULT_CONDITION,
  DAILY_CONDITION_PRICE_LIMIT,
} from "@/lib/trade";
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
  updateTag(cardsTag(email));
}

export async function saveEditsAction(
  editedRows: Record<string, Record<string, unknown>>,
  deletedIndices: number[],
  originalCards: Card[]
) {
  const email = await getUserEmail();
  await dbSaveEdits(editedRows, deletedIndices, originalCards);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
}

export async function deleteAllAction() {
  const email = await getUserEmail();
  await replaceAllCards([], email);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
}

export async function replaceAllAction(cards: CardInput[]) {
  const email = await getUserEmail();
  const count = await replaceAllCards(cards, email);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
  return count;
}

export async function updateCardAction(
  cardId: number,
  fields: Record<string, unknown>
) {
  const email = await getUserEmail();
  await updateCard(cardId, fields);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
}

// Sets a card's condition and returns its condition-adjusted price. Near Mint
// keeps the NM market price; other conditions fetch (and cache) the average of
// the cheapest live TCGplayer listings for that condition, falling back to a
// flat multiplier when the catalog/listings can't be resolved.
export async function setCardConditionAction(
  cardId: number,
  condition: string
): Promise<{ price: number | null; source: string; limited: boolean }> {
  const email = await getUserEmail();

  const { data: card } = await supabase
    .from("cards")
    .select("market_price, tcgplayer_url")
    .eq("id", cardId)
    .eq("user_email", email)
    .maybeSingle();

  // The condition itself always saves — only the live price lookup is capped.
  await updateCard(cardId, { condition });
  revalidatePath("/inventory");
  updateTag(cardsTag(email));

  const nmMarket = card?.market_price != null ? Number(card.market_price) : 0;
  if (condition === DEFAULT_CONDITION) {
    return { price: nmMarket || null, source: "nm", limited: false };
  }
  if (!card?.tcgplayer_url) {
    return {
      price: nmMarket * conditionMultiplier(condition),
      source: "multiplier",
      limited: false,
    };
  }

  const { data: cat } = await supabase
    .from("tcg_catalog")
    .select("product_id")
    .eq("url", card.tcgplayer_url)
    .limit(1)
    .maybeSingle();
  if (!cat) {
    return {
      price: nmMarket * conditionMultiplier(condition),
      source: "multiplier",
      limited: false,
    };
  }

  // A fresh cached price is free — don't spend the daily quota on it.
  const cached = await getCachedConditionPrice(cat.product_id, condition);
  if (cached) {
    return { price: cached.price, source: cached.source, limited: false };
  }

  // A cache miss needs a live TCGplayer fetch — capped per user per day. Over
  // the cap we return the multiplier estimate (and don't cache it); the nightly
  // warmer will fetch the real price without counting against the user.
  const used = await getUsageToday("condition_usage", email);
  if (used >= DAILY_CONDITION_PRICE_LIMIT) {
    return {
      price: nmMarket * conditionMultiplier(condition),
      source: "multiplier",
      limited: true,
    };
  }

  const cp = await refreshConditionPrice(cat.product_id, condition, nmMarket);
  await incrementUsage("condition_usage", email);
  return { price: cp.price, source: cp.source, limited: false };
}

export async function deleteCardsAction(cardIds: number[]) {
  const email = await getUserEmail();
  await deleteCards(cardIds);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
}

export async function savePriceAction(
  cardId: number,
  marketPrice: number | null,
  tcgplayerUrl: string | null
) {
  const email = await getUserEmail();
  await updateCard(cardId, {
    market_price: marketPrice,
    tcgplayer_url: tcgplayerUrl,
  });
  updateTag(cardsTag(email));
}

export async function saveCostBasisAction(
  cardId: number,
  costBasis: number | null
): Promise<void> {
  const email = await getUserEmail();
  await updateCard(cardId, { cost_basis: costBasis });
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
}

export async function massageNamesAction() {
  const email = await getUserEmail();
  const count = await massageNames(email);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
  return count;
}

export async function rollbackImportAction(
  imported: { name: string; number: string; quantity: number }[]
) {
  const email = await getUserEmail();
  const count = await rollbackImport(imported, email);
  revalidatePath("/inventory");
  updateTag(cardsTag(email));
  return count;
}
