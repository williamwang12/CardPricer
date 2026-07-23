"use server";

import { auth } from "@/lib/auth";
import { isGuestEmail } from "@/lib/guards";
import { supabase } from "@/lib/supabase";
import { getLiquidityScores } from "@/lib/db/liquidity";
import {
  getTradeUsageToday,
  incrementTradeUsage,
} from "@/lib/db/trade-usage";
import { conditionMultiplier, DAILY_TRADE_LIMIT } from "@/lib/trade";

export interface TradeItemInput {
  productId: number;
  quantity: number;
  condition: string;
}
export interface TradeSideInput {
  items: TradeItemInput[];
  cash: number;
}
export interface TradeInput {
  // What the vendor hands over — valued at full market (their cost).
  vendorGives: TradeSideInput;
  // What the vendor receives — cards discounted to the trade rate, cash at face.
  customerGives: TradeSideInput;
  // Fraction of market the vendor credits for incoming cards (e.g. 0.8 = 80%).
  tradeRate: number;
}

export interface TradeItemResult {
  productId: number;
  name: string;
  imageUrl: string | null;
  quantity: number;
  condition: string;
  marketPrice: number; // Near Mint market
  conditionedPrice: number; // adjusted for condition
  score: number; // 0..1 liquidity
  source: "sales" | "proxy";
  salesPerDay: number | null;
  salesCount: number | null;
  totalQuantity: number | null;
  windowDays: number | null;
}
export interface TradeSideResult {
  items: TradeItemResult[];
  cash: number;
  cardsValue: number; // condition-adjusted market value of the cards
  total: number; // cardsValue + cash
  weightedLiquidity: number; // value-weighted avg liquidity of the cards (0..1)
}
export interface TradeResult {
  give: TradeSideResult; // vendor's outgoing (market)
  get: TradeSideResult; // vendor's incoming (customer's cards + cash)
  tradeRate: number;
  giveValue: number; // market cost of what the vendor gives
  getMarketValue: number; // market value of what the vendor receives
  getAtRate: number; // that intake at the trade rate (cards discounted, cash at face)
  margin: number; // getAtRate - giveValue; >= 0 → take it
  shouldDo: boolean;
  effectiveRate: number | null; // fraction of card market the vendor is paying
}

export type TradeResponse =
  | { ok: true; result: TradeResult; usage: { used: number; limit: number } }
  | { ok: false; reason: "guest" }
  | { ok: false; reason: "limit"; limit: number }
  | { ok: false; reason: "error" };

interface CatalogInfo {
  marketPrice: number;
  name: string;
  imageUrl: string | null;
}

const VARIANT_RANK: Record<string, number> = { Holofoil: 3, Normal: 2 };

// Authoritative Near Mint market price (best variant) + display info per
// product_id, mirroring loadAllCards' Holofoil > Normal > first preference.
async function loadCatalogInfo(
  productIds: number[]
): Promise<Map<number, CatalogInfo>> {
  const out = new Map<number, CatalogInfo>();
  if (productIds.length === 0) return out;

  const { data } = await supabase
    .from("tcg_catalog")
    .select("product_id, sub_type_name, market_price, clean_name, image_url")
    .in("product_id", productIds);

  const best = new Map<
    number,
    { rank: number; price: number; name: string; imageUrl: string | null }
  >();
  for (const r of data ?? []) {
    const rank = VARIANT_RANK[r.sub_type_name as string] ?? 1;
    const prev = best.get(r.product_id);
    if (!prev || rank > prev.rank) {
      best.set(r.product_id, {
        rank,
        price: r.market_price != null ? Number(r.market_price) : 0,
        name: r.clean_name ?? `#${r.product_id}`,
        imageUrl: r.image_url ?? null,
      });
    }
  }
  for (const [pid, b] of best) {
    out.set(pid, { marketPrice: b.price, name: b.name, imageUrl: b.imageUrl });
  }
  return out;
}

function buildSide(
  side: TradeSideInput,
  catalog: Map<number, CatalogInfo>,
  liquidity: Awaited<ReturnType<typeof getLiquidityScores>>
): TradeSideResult {
  const items: TradeItemResult[] = [];
  let cardsValue = 0;
  let weightedScoreSum = 0;

  for (const item of side.items) {
    const info = catalog.get(item.productId);
    const liq = liquidity.get(item.productId);
    const marketPrice = info?.marketPrice ?? 0;
    const conditionedPrice = marketPrice * conditionMultiplier(item.condition);
    const score = liq?.score ?? 0.4;
    const qty = Math.max(0, Math.floor(item.quantity));
    const lineValue = conditionedPrice * qty;

    cardsValue += lineValue;
    weightedScoreSum += lineValue * score;

    items.push({
      productId: item.productId,
      name: info?.name ?? `#${item.productId}`,
      imageUrl: info?.imageUrl ?? null,
      quantity: qty,
      condition: item.condition,
      marketPrice,
      conditionedPrice,
      score,
      source: liq?.source ?? "proxy",
      salesPerDay: liq?.salesPerDay ?? null,
      salesCount: liq?.salesCount ?? null,
      totalQuantity: liq?.totalQuantity ?? null,
      windowDays: liq?.windowDays ?? null,
    });
  }

  const cash = Math.max(0, side.cash || 0);
  return {
    items,
    cash,
    cardsValue,
    total: cardsValue + cash,
    weightedLiquidity: cardsValue > 0 ? weightedScoreSum / cardsValue : 1,
  };
}

export async function calculateTradeAction(
  input: TradeInput
): Promise<TradeResponse> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return { ok: false, reason: "error" };

  // Guests must sign up with a real account to use the calculator.
  if (isGuestEmail(email)) return { ok: false, reason: "guest" };

  // Daily rate limit.
  const used = await getTradeUsageToday(email);
  if (used >= DAILY_TRADE_LIMIT) {
    return { ok: false, reason: "limit", limit: DAILY_TRADE_LIMIT };
  }

  const productIds = [
    ...input.vendorGives.items.map((i) => i.productId),
    ...input.customerGives.items.map((i) => i.productId),
  ];

  const [catalog, liquidity] = await Promise.all([
    loadCatalogInfo(productIds),
    getLiquidityScores(productIds),
  ]);

  const give = buildSide(input.vendorGives, catalog, liquidity);
  const get = buildSide(input.customerGives, catalog, liquidity);

  const tradeRate = Math.min(1, Math.max(0, input.tradeRate || 0));

  // Vendor's cost is full market; intake is the customer's cards at the trade
  // rate plus their cash at face. Take the trade when intake ≥ cost.
  const giveValue = give.total;
  const getMarketValue = get.total;
  const getAtRate = tradeRate * get.cardsValue + get.cash;
  const margin = getAtRate - giveValue;
  const shouldDo = margin >= 0;
  // What fraction of the incoming cards' market value the vendor actually pays
  // (net of any cash the customer adds).
  const effectiveRate =
    get.cardsValue > 0 ? (giveValue - get.cash) / get.cardsValue : null;

  await incrementTradeUsage(email);

  return {
    ok: true,
    result: {
      give,
      get,
      tradeRate,
      giveValue,
      getMarketValue,
      getAtRate,
      margin,
      shouldDo,
      effectiveRate,
    },
    usage: { used: used + 1, limit: DAILY_TRADE_LIMIT },
  };
}
