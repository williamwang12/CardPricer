import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { cardsTag } from "@/lib/db/cards";

const TABLE = "tcg_catalog";

export interface CatalogSet {
  group_id: number;
  group_name: string;
  card_count: number;
  logo_url: string | null;
  symbol_url: string | null;
  release_date: string | null;
}

export interface CatalogCard {
  product_id: number;
  clean_name: string;
  number: string | null;
  market_price: number | null;
  url: string | null;
  image_url: string | null;
}

export interface CatalogCardWithId extends CatalogCard {
  product_id: number;
}

export interface CatalogCardSearchResult extends CatalogCard {
  group_id: number;
  group_name: string;
}

export interface CatalogMover {
  product_id: number;
  clean_name: string;
  number: string | null;
  group_name: string;
  group_id: number;
  image_url: string | null;
  url: string | null;
  oldPrice: number;
  newPrice: number;
  deltaDollars: number;
}

// Exclude non-mainline sets (promos, special products, etc.)
export const EXCLUDE_PATTERNS = [
  "%Promo%",
  "%McDonald%",
  "%Trick or Trade%",
  "%Build & Battle%",
  "%Battle Academy%",
  "%Trainer Kit%",
  "%Theme Deck%",
  "%Oversized%",
  "%Jumbo%",
  "%Prize Pack%",
  "%My First Battle%",
  "%Deck Exclus%",
  "%Best of Game%",
  "%POP Series%",
  "%Starter Deck%",
];

export interface CardImageInfo {
  image_url: string | null;
  setName: string;
  product_id: number | null;
}

// Look up catalog images (+ set name) for a user's inventory cards, matched
// by their saved tcgplayer_url. Cards without a tcgplayer_url (never synced /
// priced) simply won't have an entry in the returned map.
export async function loadCardImages(
  cards: { id: number; tcgplayer_url: string | null }[]
): Promise<Record<number, CardImageInfo>> {
  const result: Record<number, CardImageInfo> = {};
  const urlToIds = new Map<string, number[]>();

  for (const c of cards) {
    if (c.tcgplayer_url) {
      const ids = urlToIds.get(c.tcgplayer_url) ?? [];
      ids.push(c.id);
      urlToIds.set(c.tcgplayer_url, ids);
    }
  }

  const urls = [...urlToIds.keys()];
  const BATCH = 100;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const { data } = await supabase
      .from(TABLE)
      .select("url, image_url, group_name, product_id")
      .in("url", batch);

    if (data) {
      for (const row of data) {
        const ids = urlToIds.get(row.url);
        if (ids) {
          for (const id of ids) {
            result[id] = { image_url: row.image_url, setName: row.group_name, product_id: row.product_id };
          }
        }
      }
    }
  }

  return result;
}

// Cached wrapper for page reads — keyed by userEmail and tagged with the
// same `cards:${userEmail}` tag as loadAllCardsCached, so both invalidate
// together whenever the user's cards change.
export async function loadCardImagesCached(
  userEmail: string,
  cards: { id: number; tcgplayer_url: string | null }[]
): Promise<Record<number, CardImageInfo>> {
  return unstable_cache(
    () => loadCardImages(cards),
    ["load-card-images", userEmail],
    { tags: [cardsTag(userEmail)], revalidate: 60 }
  )();
}

export interface InventoryChartableCard {
  cardId: number;
  productId: number;
  cleanName: string;
  groupId: number;
  groupName: string;
  imageUrl: string | null;
  number: string | null;
  marketPrice: number | null;
}

// Matches a user's inventory rows to their catalog product_id (via the
// saved tcgplayer_url, same key used by loadCardImages) so the Charts
// "Compare" view can offer "cards you own" as addable series. Cards
// without a tcgplayer_url (never synced/priced) are simply omitted.
export async function matchInventoryToCatalog(
  cards: { id: number; tcgplayer_url: string | null }[]
): Promise<InventoryChartableCard[]> {
  const urlToIds = new Map<string, number[]>();
  for (const c of cards) {
    if (c.tcgplayer_url) {
      const ids = urlToIds.get(c.tcgplayer_url) ?? [];
      ids.push(c.id);
      urlToIds.set(c.tcgplayer_url, ids);
    }
  }

  const urls = [...urlToIds.keys()];
  const BATCH = 100;
  const results: InventoryChartableCard[] = [];
  // A single url can have multiple tcg_catalog rows (e.g. Normal/Holofoil
  // sub_type_name variants sharing the same product_id), which would
  // otherwise produce duplicate (cardId, productId) entries — dedupe here.
  const seen = new Set<string>();

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const { data } = await supabase
      .from(TABLE)
      .select("url, product_id, clean_name, group_id, group_name, image_url, number, market_price")
      .in("url", batch);

    if (data) {
      for (const row of data) {
        const ids = urlToIds.get(row.url);
        if (ids) {
          for (const id of ids) {
            const key = `${id}-${row.product_id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            results.push({
              cardId: id,
              productId: row.product_id,
              cleanName: row.clean_name,
              groupId: row.group_id,
              groupName: row.group_name,
              imageUrl: row.image_url ?? null,
              number: row.number ?? null,
              marketPrice: row.market_price != null ? Number(row.market_price) : null,
            });
          }
        }
      }
    }
  }

  return results;
}

export async function getAllSets(): Promise<CatalogSet[]> {
  const { data, error } = await supabase.rpc("get_catalog_sets");
  if (error) throw error;

  const exclude = EXCLUDE_PATTERNS.map((p) =>
    p.replaceAll("%", "").toLowerCase()
  );

  const sets = (
    data as Omit<CatalogSet, "logo_url" | "symbol_url" | "release_date">[]
  ).filter((s) => !exclude.some((kw) => s.group_name.toLowerCase().includes(kw)));

  const { data: logos } = await supabase
    .from("set_logos")
    .select("group_id, logo_url, symbol_url, release_date");
  const logoMap = new Map((logos ?? []).map((l) => [l.group_id, l]));

  const merged = sets.map((s) => ({
    ...s,
    logo_url: logoMap.get(s.group_id)?.logo_url ?? null,
    symbol_url: logoMap.get(s.group_id)?.symbol_url ?? null,
    release_date: logoMap.get(s.group_id)?.release_date ?? null,
  }));

  // Most recently released sets first; sets without a known release date
  // (no logo match yet) sort to the end.
  merged.sort((a, b) => {
    if (a.release_date && b.release_date) {
      return b.release_date.localeCompare(a.release_date);
    }
    if (a.release_date) return -1;
    if (b.release_date) return 1;
    return a.group_name.localeCompare(b.group_name);
  });

  return merged;
}

// Search cards by name across the entire catalog (all sets), used by the
// Catalog page's "Cards" tab. Matches are ordered by market price (desc) so
// the most notable/valuable printings surface first, and are capped at
// `limit` rows since a broad query (e.g. "Pikachu") can match thousands.
// Card numbers are stored like "006/165" — parses out the leading numeral so
// "6", "06", and "006" all match the same card regardless of how it's
// zero-padded or how many total cards are in the set.
function parseCardNumberPrefix(numStr: string): number | null {
  const m = numStr.match(/^0*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export async function searchCards(
  query: string,
  limit = 60,
  groupId?: number,
  cardNumber?: string
): Promise<CatalogCardSearchResult[]> {
  // clean_name is sourced from TCGPlayer's own "clean name", which never
  // contains apostrophes (e.g. "Misty's Psyduck" is stored as "Mistys
  // Psyduck"). Strip straight/curly apostrophes from the search query so
  // searching either form still matches.
  const q = query.trim().replace(/['\u2018\u2019]/g, "");
  if (!q) return [];

  let builder = supabase
    .from(TABLE)
    .select("group_id, group_name, product_id, clean_name, number, market_price, url, image_url")
    .ilike("clean_name", `%${q}%`);

  // Narrow to a specific set when the caller has already parsed a set name
  // out of the query (e.g. "Charizard 151" -> name "Charizard" + the
  // "Scarlet & Violet 151" set), so results aren't diluted by same-named
  // cards from other sets.
  if (groupId != null) {
    builder = builder.eq("group_id", groupId);
  }

  for (const pattern of EXCLUDE_PATTERNS) {
    builder = builder.not("group_name", "ilike", pattern);
  }

  const { data, error } = await builder
    .order("market_price", { ascending: false, nullsFirst: false })
    .limit(limit * 3); // over-fetch to allow for dedupe below
  if (error) throw error;

  // Deduplicate by (group_id, clean_name, number) to collapse sub_type
  // variants (Normal / Holofoil / Reverse Holofoil, etc.)
  const seen = new Map<string, CatalogCardSearchResult>();
  for (const row of data ?? []) {
    const num = row.number ?? "";
    const price = row.market_price != null ? Number(row.market_price) : null;
    const card: CatalogCardSearchResult = { ...row, number: num, market_price: price };
    const key = `${card.group_id}||${card.clean_name}||${card.number}`;
    if (!seen.has(key)) {
      seen.set(key, card);
    }
  }

  let results = Array.from(seen.values());

  // Filter by parsed card number (e.g. "Charizard 6" -> only cards whose
  // number is "6/xxx", "006/xxx", etc. — compares the numeral itself so
  // zero-padding differences don't matter).
  if (cardNumber) {
    const target = parseCardNumberPrefix(cardNumber);
    if (target != null) {
      results = results.filter(
        (c) => c.number != null && parseCardNumberPrefix(c.number) === target
      );
    }
  }

  return results.slice(0, limit);
}

// Computes today's biggest catalog-wide gainers/drops from `card_price_history`
// and writes them to the `catalog_top_movers` snapshot table. Called by the
// sync-catalog cron after it finishes writing price history, so the Catalog
// page can read pre-computed movers instantly instead of paging through the
// full history table on every request.
export async function computeAndStoreMovers(limit = 8): Promise<void> {
  const { data: latestRow, error: latestErr } = await supabase
    .from("card_price_history")
    .select("captured_at")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestErr) throw latestErr;
  if (!latestRow) return;
  const latestDate = latestRow.captured_at as string;

  const { data: prevRow, error: prevErr } = await supabase
    .from("card_price_history")
    .select("captured_at")
    .lt("captured_at", latestDate)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (prevErr) throw prevErr;
  if (!prevRow) return;
  const prevDate = prevRow.captured_at as string;

  const PAGE = 1000;
  async function loadPrices(date: string): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("card_price_history")
        .select("product_id, market_price")
        .eq("captured_at", date)
        .eq("sub_type_name", "Normal")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        if (row.market_price != null) {
          map.set(row.product_id, Number(row.market_price));
        }
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return map;
  }

  const [latestPrices, prevPrices] = await Promise.all([
    loadPrices(latestDate),
    loadPrices(prevDate),
  ]);

  type Delta = { product_id: number; oldPrice: number; newPrice: number; deltaDollars: number };
  const deltas: Delta[] = [];
  for (const [productId, newPrice] of latestPrices) {
    const oldPrice = prevPrices.get(productId);
    if (oldPrice == null || oldPrice <= 0) continue;
    const diff = newPrice - oldPrice;
    if (Math.abs(diff) < 0.01) continue;
    deltas.push({
      product_id: productId,
      oldPrice,
      newPrice,
      deltaDollars: diff,
    });
  }

  // Sort by absolute dollar change descending
  deltas.sort((a, b) => Math.abs(b.deltaDollars) - Math.abs(a.deltaDollars));
  const gainerDeltas = deltas.filter((d) => d.deltaDollars > 0).slice(0, limit);
  const dropDeltas = deltas.filter((d) => d.deltaDollars < 0).slice(0, limit);

  // Filter out promo/excluded sets
  const ids = [...gainerDeltas, ...dropDeltas].map((d) => d.product_id);
  if (ids.length === 0) {
    await supabase.from("catalog_top_movers").delete().gte("id", 0);
    return;
  }

  const { data: meta, error: metaErr } = await supabase
    .from(TABLE)
    .select("product_id, group_name")
    .in("product_id", ids)
    .eq("sub_type_name", "Normal");
  if (metaErr) throw metaErr;

  const exclude = EXCLUDE_PATTERNS.map((p) => p.replaceAll("%", "").toLowerCase());
  const metaMap = new Map((meta ?? []).map((m) => [m.product_id, m]));

  function filterDeltas(list: Delta[], direction: "gainer" | "drop") {
    const rows: { product_id: number; direction: string; old_price: number; new_price: number; delta_dollars: number }[] = [];
    for (const d of list) {
      const m = metaMap.get(d.product_id);
      if (!m) continue;
      if (exclude.some((kw) => m.group_name.toLowerCase().includes(kw))) continue;
      rows.push({
        product_id: d.product_id,
        direction,
        old_price: d.oldPrice,
        new_price: d.newPrice,
        delta_dollars: d.deltaDollars,
      });
    }
    return rows;
  }

  const rows = [
    ...filterDeltas(gainerDeltas, "gainer"),
    ...filterDeltas(dropDeltas, "drop"),
  ];

  // Replace all existing rows
  await supabase.from("catalog_top_movers").delete().gte("id", 0);
  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from("catalog_top_movers").insert(rows);
    if (insertErr) throw insertErr;
  }
}

// Today's biggest catalog-wide gainers/drops, read from the pre-computed
// `catalog_top_movers` snapshot table (populated by `computeAndStoreMovers`
// at the end of each sync-catalog cron run). If the table is empty (first
// deploy before cron has run), eagerly populates it so the page works
// immediately.
export async function getCatalogTopMovers(): Promise<{
  gainers: CatalogMover[];
  drops: CatalogMover[];
}> {
  const empty = { gainers: [], drops: [] };

  const initial = await supabase
    .from("catalog_top_movers")
    .select("product_id, direction, old_price, new_price, delta_dollars");
  if (initial.error) throw initial.error;
  let moverRows = initial.data;

  // First request after deploy — table is empty, seed it now
  if (!moverRows || moverRows.length === 0) {
    await computeAndStoreMovers();
    const refetch = await supabase
      .from("catalog_top_movers")
      .select("product_id, direction, old_price, new_price, delta_dollars");
    if (refetch.error) throw refetch.error;
    moverRows = refetch.data;
    if (!moverRows || moverRows.length === 0) return empty;
  }

  const ids = moverRows.map((r) => r.product_id);
  const { data: meta, error: metaErr } = await supabase
    .from(TABLE)
    .select("product_id, clean_name, number, group_id, group_name, image_url, url")
    .in("product_id", ids)
    .eq("sub_type_name", "Normal");
  if (metaErr) throw metaErr;

  const metaMap = new Map((meta ?? []).map((m) => [m.product_id, m]));

  const gainers: CatalogMover[] = [];
  const drops: CatalogMover[] = [];

  for (const row of moverRows) {
    const m = metaMap.get(row.product_id);
    if (!m) continue;
    const mover: CatalogMover = {
      product_id: row.product_id,
      clean_name: m.clean_name,
      number: m.number,
      group_id: m.group_id,
      group_name: m.group_name,
      image_url: m.image_url,
      url: m.url,
      oldPrice: Number(row.old_price),
      newPrice: Number(row.new_price),
      deltaDollars: Number(row.delta_dollars),
    };
    if (row.direction === "gainer") gainers.push(mover);
    else drops.push(mover);
  }

  // Sort gainers by deltaDollars desc, drops by deltaDollars asc (most negative first)
  gainers.sort((a, b) => b.deltaDollars - a.deltaDollars);
  drops.sort((a, b) => a.deltaDollars - b.deltaDollars);

  return { gainers, drops };
}

// Cache tag for the top-movers computation. This is a global (non-per-user)
// tag since movers are catalog-wide, not scoped to a user's inventory. The
// sync-catalog cron calls `revalidateTag(catalogMoversTag())` right after it
// finishes writing a new day's `card_price_history` rows, so the cache is
// busted exactly when new data actually lands. The `revalidate: 3600` is
// just a safety net (movers only ever change once/day) in case that call is
// ever missed.
export function catalogMoversTag(): string {
  return "catalog:movers";
}

// Cached wrapper for the Catalog page's "Today's Top Movers" section. The
// underlying read from `catalog_top_movers` is already fast, but caching
// avoids hitting Supabase on every navigation back to the Cards tab.
export async function getCatalogTopMoversCached(): Promise<{
  gainers: CatalogMover[];
  drops: CatalogMover[];
}> {
  return unstable_cache(
    () => getCatalogTopMovers(),
    ["catalog-top-movers"],
    { tags: [catalogMoversTag()], revalidate: 3600 }
  )();
}

export async function getSetCards(groupId: number): Promise<CatalogCard[]> {
  const PAGE = 1000;
  const rows: CatalogCard[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("product_id, clean_name, number, market_price, url, image_url")
      .eq("group_id", groupId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Deduplicate by (clean_name, number) to collapse sub_type variants
  const seen = new Map<string, CatalogCard>();
  for (const row of rows) {
    const num = row.number ?? "";
    const price = row.market_price != null ? Number(row.market_price) : null;
    const card: CatalogCard = { ...row, number: num, market_price: price };
    const key = `${card.clean_name}||${card.number}`;
    if (!seen.has(key)) {
      seen.set(key, card);
    }
  }

  const cards = Array.from(seen.values());
  cards.sort((a, b) => {
    const numA = parseInt(a.number ?? "", 10);
    const numB = parseInt(b.number ?? "", 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a.number ?? "").localeCompare(b.number ?? "");
  });

  return cards;
}

export async function getSetCardsWithIds(
  groupId: number
): Promise<CatalogCardWithId[]> {
  const PAGE = 1000;
  const rows: CatalogCardWithId[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("product_id, clean_name, number, market_price, url, image_url")
      .eq("group_id", groupId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as CatalogCardWithId[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Deduplicate by (clean_name, number), keeping first (Normal sub_type)
  const seen = new Map<string, CatalogCardWithId>();
  for (const row of rows) {
    const num = row.number ?? "";
    const price = row.market_price != null ? Number(row.market_price) : null;
    const card: CatalogCardWithId = { ...row, number: num, market_price: price };
    const key = `${card.clean_name}||${card.number}`;
    if (!seen.has(key)) {
      seen.set(key, card);
    }
  }

  const cards = Array.from(seen.values());
  cards.sort((a, b) => {
    const numA = parseInt(a.number ?? "", 10);
    const numB = parseInt(b.number ?? "", 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return (a.number ?? "").localeCompare(b.number ?? "");
  });

  return cards;
}
