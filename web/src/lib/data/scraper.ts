import { supabase } from "@/lib/supabase";
import { normalizeNumber } from "@/lib/utils";

/**
 * Look up a card's market price and URL from the local tcg_catalog table.
 * Replaces the old TCGPlayer search API scraper with instant DB queries.
 */
export async function searchTcgplayer(
  cardName: string,
  cardNumber: string
): Promise<{ price: number | null; url: string | null }> {
  const nameLower = cardName.toLowerCase();
  const num = cardNumber?.trim() ?? "";
  const numNormalized = num ? normalizeNumber(num) : "";

  // Pass 1: Exact name match (uses idx_tcg_catalog_name_number index)
  const { data: exactRows } = await supabase
    .from("tcg_catalog")
    .select("market_price, url, sub_type_name, number")
    .ilike("clean_name", nameLower)
    .limit(50);

  if (exactRows && exactRows.length > 0) {
    const result = matchFromRows(exactRows, numNormalized);
    if (result) return result;
  }

  // Pass 2: Fuzzy name match (fallback for name mismatches)
  if (numNormalized) {
    const { data: fuzzyRows } = await supabase
      .from("tcg_catalog")
      .select("market_price, url, sub_type_name, number")
      .ilike("clean_name", `%${nameLower}%`)
      .limit(100);

    if (fuzzyRows && fuzzyRows.length > 0) {
      const result = matchFromRows(fuzzyRows, numNormalized);
      if (result) return result;
    }
  }

  return { price: null, url: null };
}

type CatalogRow = {
  market_price: number | null;
  url: string | null;
  sub_type_name: string;
  number: string | null;
};

/**
 * From a set of catalog rows, find the best match considering card number.
 */
export function matchFromRows(
  rows: CatalogRow[],
  numNormalized: string
): { price: number | null; url: string | null } | null {
  if (numNormalized) {
    // Filter to rows whose normalized number matches
    const numberMatches = rows.filter(
      (r) => normalizeNumber(r.number ?? "") === numNormalized
    );
    if (numberMatches.length > 0) {
      return formatResult(pickBestVariant(numberMatches));
    }
    // Number was provided but no match — don't fall back to name-only
    return null;
  }

  // No number provided — pick best from all name matches
  return formatResult(pickBestVariant(rows));
}

function formatResult(row: {
  market_price: number | null;
  url: string | null;
}): { price: number | null; url: string | null } {
  return {
    price:
      row.market_price != null
        ? Math.round(Number(row.market_price) * 100) / 100
        : null,
    url: row.url ?? null,
  };
}

/**
 * Pick the best variant from matching rows.
 * Prefer Holofoil > Normal > any other sub_type_name.
 */
export function pickBestVariant(
  rows: CatalogRow[]
): { market_price: number | null; url: string | null } {
  const holofoil = rows.find((r) => r.sub_type_name === "Holofoil");
  if (holofoil) return holofoil;

  const normal = rows.find((r) => r.sub_type_name === "Normal");
  if (normal) return normal;

  return rows[0];
}

// ── Bulk lookup for cron jobs ────────────────────────────────────────────────

type CatalogIndex = {
  byName: Map<string, CatalogRow[]>;
};

async function loadCatalogIndex(): Promise<CatalogIndex> {
  const byName = new Map<string, CatalogRow[]>();

  // Load entire catalog in pages of 1000
  const PAGE_SIZE = 1000;
  let offset = 0;
  let total = 0;

  while (true) {
    const { data, error } = await supabase
      .from("tcg_catalog")
      .select("market_price, url, sub_type_name, number, clean_name")
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(`Catalog load failed: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      const key = (row.clean_name ?? "").toLowerCase();
      const arr = byName.get(key) ?? [];
      arr.push(row);
      byName.set(key, arr);
    }

    total += data.length;
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  console.log(`Loaded ${total} catalog rows into ${byName.size} name groups`);
  return { byName };
}

function lookupFromIndex(
  index: CatalogIndex,
  cardName: string,
  cardNumber: string
): { price: number | null; url: string | null } {
  const nameLower = cardName.toLowerCase();
  const num = cardNumber?.trim() ?? "";
  const numNormalized = num ? normalizeNumber(num) : "";

  // Pass 1: Exact name match
  const exactRows = index.byName.get(nameLower);
  if (exactRows && exactRows.length > 0) {
    const result = matchFromRows(exactRows, numNormalized);
    if (result) return result;
  }

  // Pass 2: Fuzzy name match (contains) — only if number provided
  if (numNormalized) {
    for (const [key, rows] of index.byName) {
      if (key !== nameLower && key.includes(nameLower)) {
        const numberMatches = rows.filter(
          (r) => normalizeNumber(r.number ?? "") === numNormalized
        );
        if (numberMatches.length > 0) {
          return formatResult(pickBestVariant(numberMatches));
        }
      }
    }
  }

  return { price: null, url: null };
}

/**
 * Load the catalog index. Call once and pass to bulkSearchTcgplayer
 * to avoid re-loading for each user batch.
 */
export { loadCatalogIndex };
export type { CatalogIndex };

/**
 * Bulk price lookup for cron jobs. Pass a pre-loaded catalog index
 * to avoid re-fetching it for each call.
 */
export async function bulkSearchTcgplayer(
  cards: { id: number; name: string; number: string }[],
  preloadedIndex?: CatalogIndex
): Promise<{ id: number; market_price: number | null; tcgplayer_url: string | null }[]> {
  const index = preloadedIndex ?? (await loadCatalogIndex());
  const results: { id: number; market_price: number | null; tcgplayer_url: string | null }[] = [];

  for (const card of cards) {
    const match = lookupFromIndex(index, card.name, card.number);
    if (match.price != null || match.url != null) {
      results.push({
        id: card.id,
        market_price: match.price,
        tcgplayer_url: match.url,
      });
    }
  }

  return results;
}
