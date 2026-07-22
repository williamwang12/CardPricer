"use server";

import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { getLiquidityScores } from "@/lib/db/liquidity";

// An illiquid card counts 50% toward a trade; a perfectly liquid one 100%.
// effectiveValue = market × (HAIRCUT_FLOOR + (1 - HAIRCUT_FLOOR) × score)
const HAIRCUT_FLOOR = 0.5;

// A side is only called "even" within this fraction of the larger side.
const EVEN_EPSILON = 0.02;

export interface TradeItemInput {
  productId: number;
  quantity: number;
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
  marketPrice: number;
  score: number;
  source: "sales" | "proxy";
  salesPerDay: number | null;
  effectiveEach: number;
}
export interface TradeSideResult {
  items: TradeItemResult[];
  cash: number;
  cardsMarket: number;
  cardsEffective: number;
  totalEffective: number;
}
export interface TradeResult {
  sideA: TradeSideResult;
  sideB: TradeSideResult;
  winner: "A" | "B" | "even";
  winPct: number; // how much more effective value the winner receives
}

interface CatalogInfo {
  marketPrice: number;
  name: string;
  imageUrl: string | null;
}

const VARIANT_RANK: Record<string, number> = { Holofoil: 3, Normal: 2 };

// Authoritative market price (best variant) + display info per product_id,
// mirroring loadAllCards' Holofoil > Normal > first preference.
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
  let cardsMarket = 0;
  let cardsEffective = 0;

  for (const item of side.items) {
    const info = catalog.get(item.productId);
    const liq = liquidity.get(item.productId);
    const marketPrice = info?.marketPrice ?? 0;
    const score = liq?.score ?? 0.4;
    const qty = Math.max(0, Math.floor(item.quantity));
    const effectiveEach =
      marketPrice * (HAIRCUT_FLOOR + (1 - HAIRCUT_FLOOR) * score);

    cardsMarket += marketPrice * qty;
    cardsEffective += effectiveEach * qty;

    items.push({
      productId: item.productId,
      name: info?.name ?? `#${item.productId}`,
      imageUrl: info?.imageUrl ?? null,
      quantity: qty,
      marketPrice,
      score,
      source: liq?.source ?? "proxy",
      salesPerDay: liq?.salesPerDay ?? null,
      effectiveEach,
    });
  }

  const cash = Math.max(0, side.cash || 0);
  return {
    items,
    cash,
    cardsMarket,
    cardsEffective,
    totalEffective: cardsEffective + cash,
  };
}

export async function calculateTradeAction(
  input: TradeInput
): Promise<TradeResult> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Unauthorized");

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

  const hi = Math.max(sideA.totalEffective, sideB.totalEffective);
  const lo = Math.min(sideA.totalEffective, sideB.totalEffective);

  let winner: "A" | "B" | "even";
  if (hi <= 0 || hi - lo <= hi * EVEN_EPSILON) {
    winner = "even";
  } else {
    winner = sideA.totalEffective > sideB.totalEffective ? "A" : "B";
  }
  // The winner receives this much more effective value than they give up.
  const winPct = lo > 0 ? ((hi - lo) / lo) * 100 : winner === "even" ? 0 : 100;

  return { sideA, sideB, winner, winPct };
}
