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

// A side is only called "even" within this fraction of the larger side.
const EVEN_EPSILON = 0.02;

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
  sideA: TradeSideInput;
  sideB: TradeSideInput;
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
}
export interface TradeSideResult {
  items: TradeItemResult[];
  cash: number;
  cardsValue: number; // condition-adjusted market value of the cards
  total: number; // cardsValue + cash
  weightedLiquidity: number; // value-weighted avg liquidity of the cards (0..1)
}
export interface TradeResult {
  sideA: TradeSideResult;
  sideB: TradeSideResult;
  winner: "A" | "B" | "even";
  winPct: number; // how much more market value the winner receives
  valueDiff: number; // absolute value difference
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
    ...input.sideA.items.map((i) => i.productId),
    ...input.sideB.items.map((i) => i.productId),
  ];

  const [catalog, liquidity] = await Promise.all([
    loadCatalogInfo(productIds),
    getLiquidityScores(productIds),
  ]);

  const sideA = buildSide(input.sideA, catalog, liquidity);
  const sideB = buildSide(input.sideB, catalog, liquidity);

  const hi = Math.max(sideA.total, sideB.total);
  const lo = Math.min(sideA.total, sideB.total);

  let winner: "A" | "B" | "even";
  if (hi <= 0 || hi - lo <= hi * EVEN_EPSILON) {
    winner = "even";
  } else {
    winner = sideA.total > sideB.total ? "A" : "B";
  }
  const winPct = lo > 0 ? ((hi - lo) / lo) * 100 : winner === "even" ? 0 : 100;

  await incrementTradeUsage(email);

  return {
    ok: true,
    result: { sideA, sideB, winner, winPct, valueDiff: hi - lo },
    usage: { used: used + 1, limit: DAILY_TRADE_LIMIT },
  };
}
