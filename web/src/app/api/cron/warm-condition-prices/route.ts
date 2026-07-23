import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { refreshConditionPrice } from "@/lib/db/condition-prices";
import { DEFAULT_CONDITION } from "@/lib/trade";

export const maxDuration = 300;

const CACHE_TTL_HOURS = 24;
const MAX_REFRESH = 250; // gentle daily cap to avoid rate limits
const DELAY_MS = 200;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const VARIANT_RANK: Record<string, number> = { Holofoil: 3, Normal: 2 };

// Pre-fetches condition-adjusted prices for the (product, condition) pairs
// users actually hold on non-Near-Mint, non-manual cards, so Inventory reads
// warm cache. Rate-limited + capped + deadline-bounded so it never hammers
// TCGplayer or overruns the function budget.
export async function GET() {
  const deadline = Date.now() + 270_000;
  const PAGE = 1000;

  // 1. Held non-NM, non-manual cards (url + condition), paginated.
  const held = new Map<string, string>(); // `${url}|${condition}` -> url (dedupe)
  const pairConditions = new Map<string, { url: string; condition: string }>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("cards")
      .select("tcgplayer_url, condition")
      .eq("manual_price", false)
      .neq("condition", DEFAULT_CONDITION)
      .not("tcgplayer_url", "is", null)
      .range(from, from + PAGE - 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) break;
    for (const r of data) {
      const url = r.tcgplayer_url as string;
      const condition = r.condition as string;
      const k = `${url}|${condition}`;
      if (!held.has(k)) {
        held.set(k, url);
        pairConditions.set(k, { url, condition });
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  if (pairConditions.size === 0) {
    return NextResponse.json({ ok: true, pairs: 0, refreshed: 0 });
  }

  // 2. Resolve each url -> product_id + NM market (best variant).
  const urls = [...new Set([...pairConditions.values()].map((p) => p.url))];
  const urlInfo = new Map<string, { productId: number; nmMarket: number; rank: number }>();
  for (let i = 0; i < urls.length; i += 100) {
    const batch = urls.slice(i, i + 100);
    const { data } = await supabase
      .from("tcg_catalog")
      .select("url, product_id, sub_type_name, market_price")
      .in("url", batch);
    for (const r of data ?? []) {
      const rank = VARIANT_RANK[r.sub_type_name as string] ?? 1;
      const prev = urlInfo.get(r.url);
      if (!prev || rank > prev.rank) {
        urlInfo.set(r.url, {
          productId: r.product_id,
          nmMarket: r.market_price != null ? Number(r.market_price) : 0,
          rank,
        });
      }
    }
  }

  // 3. Distinct (product_id, condition) with NM market.
  const targets = new Map<string, { productId: number; condition: string; nmMarket: number }>();
  for (const { url, condition } of pairConditions.values()) {
    const info = urlInfo.get(url);
    if (!info) continue;
    targets.set(`${info.productId}|${condition}`, {
      productId: info.productId,
      condition,
      nmMarket: info.nmMarket,
    });
  }

  // 4. Skip pairs already fresh in cache.
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 3_600_000).toISOString();
  const productIds = [...new Set([...targets.values()].map((t) => t.productId))];
  const fresh = new Set<string>();
  for (let i = 0; i < productIds.length; i += 200) {
    const batch = productIds.slice(i, i + 200);
    const { data } = await supabase
      .from("card_condition_prices")
      .select("product_id, condition, computed_at")
      .in("product_id", batch)
      .gte("computed_at", cutoff);
    for (const r of data ?? []) fresh.add(`${r.product_id}|${r.condition}`);
  }

  // 5. Refresh stale/missing pairs, rate-limited.
  let refreshed = 0;
  let skippedForBudget = 0;
  for (const [key, t] of targets) {
    if (fresh.has(key)) continue;
    if (refreshed >= MAX_REFRESH || Date.now() > deadline) {
      skippedForBudget++;
      continue;
    }
    if (refreshed > 0) await delay(DELAY_MS);
    await refreshConditionPrice(t.productId, t.condition, t.nmMarket);
    refreshed++;
  }

  return NextResponse.json({
    ok: true,
    pairs: targets.size,
    refreshed,
    skippedForBudget,
    at: new Date().toISOString(),
  });
}
