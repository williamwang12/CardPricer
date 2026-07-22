import { supabase } from "@/lib/supabase";
import { getSalesVelocity, velocityToScore } from "@/lib/data/tcg-sales";

export interface Liquidity {
  score: number; // 0..1
  salesPerDay: number | null; // null when from proxy
  source: "sales" | "proxy";
}

const CACHE_TTL_HOURS = 24;
// Bound how many live TCGplayer lookups a single request can trigger, so an
// oversized trade can't hammer the endpoint / block the request for too long.
const MAX_LIVE_FETCHES = 40;
const FETCH_DELAY_MS = 150;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Reads fresh cache rows. Wrapped so a missing card_liquidity table (migration
// not yet run) degrades to "no cache" rather than throwing.
async function readCache(
  productIds: number[]
): Promise<Map<number, Liquidity>> {
  const out = new Map<number, Liquidity>();
  try {
    const cutoff = new Date(
      Date.now() - CACHE_TTL_HOURS * 3_600_000
    ).toISOString();
    const { data, error } = await supabase
      .from("card_liquidity")
      .select("product_id, sales_per_day, score, source, computed_at")
      .in("product_id", productIds)
      .gte("computed_at", cutoff);
    if (error) return out;
    for (const r of data ?? []) {
      out.set(r.product_id, {
        score: Number(r.score),
        salesPerDay: r.sales_per_day != null ? Number(r.sales_per_day) : null,
        source: r.source === "proxy" ? "proxy" : "sales",
      });
    }
  } catch {
    /* table missing — treat as empty cache */
  }
  return out;
}

async function writeCache(
  rows: {
    product_id: number;
    sales_per_day: number | null;
    score: number;
    source: "sales" | "proxy";
    window_days: number | null;
  }[]
): Promise<void> {
  if (rows.length === 0) return;
  try {
    await supabase.from("card_liquidity").upsert(
      rows.map((r) => ({ ...r, computed_at: new Date().toISOString() })),
      { onConflict: "product_id" }
    );
  } catch {
    /* table missing — skip caching */
  }
}

// Proxy liquidity from price stability: cards whose daily market price is
// volatile are treated as less liquid. Coefficient of variation over the last
// ~3 weeks of card_price_history, mapped into a capped 0.2..0.85 band (kept
// below 1 since it's an estimate, not observed sales).
async function proxyScores(
  productIds: number[]
): Promise<Map<number, number>> {
  const out = new Map<number, number>();
  if (productIds.length === 0) return out;

  const since = new Date(Date.now() - 21 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const byProduct = new Map<number, Map<string, number>>(); // pid -> date -> max price
  try {
    const { data } = await supabase
      .from("card_price_history")
      .select("product_id, captured_at, market_price")
      .in("product_id", productIds)
      .gte("captured_at", since);
    for (const r of data ?? []) {
      if (r.market_price == null) continue;
      const price = Number(r.market_price);
      let dates = byProduct.get(r.product_id);
      if (!dates) {
        dates = new Map();
        byProduct.set(r.product_id, dates);
      }
      const prev = dates.get(r.captured_at);
      if (prev == null || price > prev) dates.set(r.captured_at, price);
    }
  } catch {
    /* fall through to defaults below */
  }

  for (const pid of productIds) {
    const dates = byProduct.get(pid);
    if (!dates || dates.size < 3) {
      out.set(pid, 0.4); // not enough history to judge — middling
      continue;
    }
    const values = [...dates.values()];
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    if (mean <= 0) {
      out.set(pid, 0.4);
      continue;
    }
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const cv = Math.sqrt(variance) / mean;
    const score = Math.max(0.2, Math.min(0.85, 0.85 - cv * 4));
    out.set(pid, score);
  }
  return out;
}

// Liquidity for a set of products: fresh cache first, then live sales velocity,
// then the price-stability proxy for anything sales data can't cover.
export async function getLiquidityScores(
  productIds: number[]
): Promise<Map<number, Liquidity>> {
  const unique = [...new Set(productIds)];
  const result = await readCache(unique);

  const missing = unique.filter((id) => !result.has(id));
  if (missing.length === 0) return result;

  const toWrite: Parameters<typeof writeCache>[0] = [];
  const needProxy: number[] = [];
  let liveFetches = 0;

  for (const pid of missing) {
    if (liveFetches >= MAX_LIVE_FETCHES) {
      needProxy.push(pid);
      continue;
    }
    liveFetches++;
    if (liveFetches > 1) await delay(FETCH_DELAY_MS);

    const velocity = await getSalesVelocity(pid);
    if (velocity) {
      const score = velocityToScore(velocity.salesPerDay);
      result.set(pid, {
        score,
        salesPerDay: velocity.salesPerDay,
        source: "sales",
      });
      toWrite.push({
        product_id: pid,
        sales_per_day: velocity.salesPerDay,
        score,
        source: "sales",
        window_days: velocity.windowDays,
      });
    } else {
      needProxy.push(pid);
    }
  }

  if (needProxy.length > 0) {
    const proxies = await proxyScores(needProxy);
    for (const pid of needProxy) {
      const score = proxies.get(pid) ?? 0.4;
      result.set(pid, { score, salesPerDay: null, source: "proxy" });
      toWrite.push({
        product_id: pid,
        sales_per_day: null,
        score,
        source: "proxy",
        window_days: null,
      });
    }
  }

  await writeCache(toWrite);
  return result;
}
