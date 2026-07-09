import { supabase } from "@/lib/supabase";

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

// Exclude non-mainline sets (promos, special products, etc.)
const EXCLUDE_PATTERNS = [
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
