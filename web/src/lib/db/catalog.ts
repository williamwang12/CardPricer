import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import { cardsTag } from "@/lib/db/cards";

const TABLE = "tcg_catalog";

export interface CatalogSet {
  group_id: number;
  group_name: string;
  card_count: number;
}

export interface CatalogCard {
  clean_name: string;
  number: string | null;
  market_price: number | null;
  url: string | null;
  image_url: string | null;
}

export interface CatalogCardWithId extends CatalogCard {
  product_id: number;
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
      .select("url, image_url, group_name")
      .in("url", batch);

    if (data) {
      for (const row of data) {
        const ids = urlToIds.get(row.url);
        if (ids) {
          for (const id of ids) {
            result[id] = { image_url: row.image_url, setName: row.group_name };
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

export async function getAllSets(): Promise<CatalogSet[]> {
  const { data, error } = await supabase.rpc("get_catalog_sets");
  if (error) throw error;

  const exclude = EXCLUDE_PATTERNS.map((p) =>
    p.replaceAll("%", "").toLowerCase()
  );

  return (data as CatalogSet[]).filter(
    (s) => !exclude.some((kw) => s.group_name.toLowerCase().includes(kw))
  );
}

export async function getSetCards(groupId: number): Promise<CatalogCard[]> {
  const PAGE = 1000;
  const rows: CatalogCard[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("clean_name, number, market_price, url, image_url")
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
