import { supabase } from "@/lib/supabase";
import { EXCLUDE_PATTERNS } from "@/lib/db/catalog";
import { deriveCleanName } from "@/lib/utils";

const CATEGORY_ID = "3"; // Pokemon
const BASE_URL = "https://tcgcsv.com/tcgplayer";
const USER_AGENT = "CardPricer/1.0.0";
const DELAY_MS = 100;

const MODERN_ERA_PREFIXES = [
  "Black & White",
  "BW",
  "XY",
  "Sun & Moon",
  "SM",
  "Sword & Shield",
  "SWSH",
  "Scarlet & Violet",
  "SV",
  "Detective Pikachu",
  "Generations",
  "Dragon Majesty",
  "Shining Legends",
  "Hidden Fates",
  "Champion",
  "Astral",
  "Brilliant Stars",
  "Lost Origin",
  "Silver Tempest",
  "Crown Zenith",
  "Paldea",
  "Obsidian",
  "151",
  "Temporal Forces",
  "Twilight Masquerade",
  "Shrouded Fable",
  "Stellar Crown",
  "Surging Sparks",
  "Prismatic",
  "Journey Together",
];

export function isModernMainlineSet(groupName: string): boolean {
  const lower = groupName.toLowerCase();
  const exclude = EXCLUDE_PATTERNS.map((p) =>
    p.replaceAll("%", "").toLowerCase()
  );
  if (exclude.some((kw) => lower.includes(kw))) return false;
  return MODERN_ERA_PREFIXES.some((prefix) =>
    lower.includes(prefix.toLowerCase())
  );
}

interface TcgGroup {
  groupId: number;
  name: string;
}

interface TcgProduct {
  productId: number;
  name: string;
  cleanName: string;
  groupId: number;
  url: string;
  imageUrl: string;
  extendedData: { name: string; value: string }[];
}

interface TcgPrice {
  productId: number;
  marketPrice: number | null;
  lowPrice: number | null;
  subTypeName: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}/${path}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`TCGCSV ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchGroups(): Promise<TcgGroup[]> {
  const data = await fetchJson<{ results: TcgGroup[] }>(
    `${CATEGORY_ID}/groups`
  );
  return data.results;
}

export async function fetchProducts(groupId: number): Promise<TcgProduct[]> {
  const data = await fetchJson<{ results: TcgProduct[] }>(
    `${CATEGORY_ID}/${groupId}/products`
  );
  return data.results;
}

export async function fetchPrices(groupId: number): Promise<TcgPrice[]> {
  const data = await fetchJson<{ results: TcgPrice[] }>(
    `${CATEGORY_ID}/${groupId}/prices`
  );
  return data.results;
}

function getCardNumber(product: TcgProduct): string | null {
  const entry = product.extendedData?.find((d) => d.name === "Number");
  return entry?.value ?? null;
}

export async function syncGroup(
  groupId: number,
  groupName: string
): Promise<number> {
  const [products, prices] = await Promise.all([
    fetchProducts(groupId),
    fetchPrices(groupId),
  ]);

  // Index prices by productId
  const priceMap = new Map<number, TcgPrice[]>();
  for (const p of prices) {
    const arr = priceMap.get(p.productId) ?? [];
    arr.push(p);
    priceMap.set(p.productId, arr);
  }

  // Build rows: one per (productId, subTypeName)
  const rows: {
    product_id: number;
    sub_type_name: string;
    name: string;
    clean_name: string;
    number: string | null;
    group_id: number;
    group_name: string;
    market_price: number | null;
    low_price: number | null;
    url: string | null;
    image_url: string | null;
    updated_at: string;
  }[] = [];

  const now = new Date().toISOString();

  for (const product of products) {
    const number = getCardNumber(product);
    const priceEntries = priceMap.get(product.productId);

    if (priceEntries && priceEntries.length > 0) {
      for (const price of priceEntries) {
        rows.push({
          product_id: product.productId,
          sub_type_name: price.subTypeName || "Normal",
          name: product.name,
          clean_name: deriveCleanName(product.name),
          number,
          group_id: groupId,
          group_name: groupName,
          market_price: price.marketPrice,
          low_price: price.lowPrice,
          url: product.url,
          image_url: product.imageUrl,
          updated_at: now,
        });
      }
    } else {
      // Product with no price data — store with defaults
      rows.push({
        product_id: product.productId,
        sub_type_name: "Normal",
        name: product.name,
        clean_name: deriveCleanName(product.name),
        number,
        group_id: groupId,
        group_name: groupName,
        market_price: null,
        low_price: null,
        url: product.url,
        image_url: product.imageUrl,
        updated_at: now,
      });
    }
  }

  // Delete stale rows for this group, then upsert new data
  await supabase.from("tcg_catalog").delete().eq("group_id", groupId);

  // Upsert in batches of 500 to avoid payload limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from("tcg_catalog").upsert(batch, {
      onConflict: "product_id,sub_type_name",
    });
    if (error) {
      throw new Error(
        `Upsert failed for group ${groupId} batch ${i}: ${error.message}`
      );
    }
  }

  // Save price history for modern mainline sets
  if (isModernMainlineSet(groupName)) {
    const today = new Date().toISOString().slice(0, 10);
    const historyRows = rows
      .filter((r) => r.market_price != null)
      .map((r) => ({
        product_id: r.product_id,
        sub_type_name: r.sub_type_name,
        captured_at: today,
        market_price: r.market_price,
        low_price: r.low_price,
      }));

    for (let i = 0; i < historyRows.length; i += BATCH_SIZE) {
      const batch = historyRows.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("card_price_history")
        .upsert(batch, {
          onConflict: "product_id,sub_type_name,captured_at",
        });
      if (error) {
        console.error(
          `Price history upsert failed for group ${groupId} batch ${i}: ${error.message}`
        );
      }
    }
  }

  return rows.length;
}

export async function syncAllGroups(): Promise<{
  groupsSynced: number;
  productsUpserted: number;
}> {
  const groups = await fetchGroups();
  let groupsSynced = 0;
  let productsUpserted = 0;

  for (const group of groups) {
    try {
      const count = await syncGroup(group.groupId, group.name);
      productsUpserted += count;
      groupsSynced++;
    } catch (err) {
      console.error(
        `Failed to sync group ${group.groupId} (${group.name}):`,
        err
      );
    }
    await delay(DELAY_MS);
  }

  return { groupsSynced, productsUpserted };
}
