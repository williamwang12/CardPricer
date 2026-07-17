import { supabase } from "@/lib/supabase";

const POKEMONTCG_BASE = "https://api.pokemontcg.io/v2";
const USER_AGENT = "CardPricer/1.0.0";
// pokemontcg.io caps unauthenticated requests at 30/min (see
// https://docs.pokemontcg.io/getting-started/rate-limits/). 2100ms keeps us
// safely under that (~28/min) — a faster delay causes throttling/timeouts.
const DELAY_MS = 2100;

interface PokemonTcgSet {
  id: string;
  name: string;
  series: string;
  releaseDate: string; // "YYYY/MM/DD"
  images: { symbol: string; logo: string };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// TCGPlayer set names often have extra prefixes/suffixes pokemontcg.io
// doesn't use, e.g. "SV10: Destined Rivals" vs "Destined Rivals", or
// "XY - Phantom Forces" vs "Phantom Forces", or "Sword & Shield Base Set"
// vs "Sword & Shield". TCGPlayer also spells out "and" where pokemontcg.io
// uses "&" (e.g. "Diamond and Pearl" vs "Diamond & Pearl"). Normalize all of
// this so the remaining text matches pokemontcg.io's `name` field.
function simplifySetName(name: string): string {
  return name
    .replace(/^[A-Z0-9&]+:\s*/i, "") // leading "SV10: " / "XY: " style prefixes
    .replace(/^[A-Z0-9&]+\s*-\s*/i, "") // leading "XY - " style prefixes
    .replace(/\s*\(.*?\)\s*/g, " ") // parenthetical notes
    .replace(/\s+Base Set$/i, "") // trailing "Base Set" suffix
    .replace(/\band\b/gi, "&") // "and" -> "&" to match pokemontcg.io naming
    .trim();
}

async function searchPokemonTcgSet(
  name: string
): Promise<PokemonTcgSet | null> {
  const query = simplifySetName(name);
  const res = await fetch(
    `${POKEMONTCG_BASE}/sets?q=${encodeURIComponent(`name:"${query}"`)}`,
    { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) }
  );
  if (!res.ok) return null;
  const json = (await res.json()) as { data: PokemonTcgSet[] };
  return json.data?.[0] ?? null;
}

/**
 * Sync official set logo/symbol images from the Pokemon TCG API
 * (pokemontcg.io) into the `set_logos` table, matched to TCGPlayer's
 * group_id/group_name (as seen in `tcg_catalog`) by fuzzy set-name search.
 *
 * Sets that don't find a confident match (typically non-mainline products
 * like "Jumbo Cards", promo boxes, etc.) are simply skipped — they won't
 * have a logo, which is fine since those aren't real "sets" anyway.
 */
export async function syncSetLogos(): Promise<{
  setsChecked: number;
  logosUpserted: number;
}> {
  const PAGE = 1000;
  const uniqueGroups = new Map<number, string>();
  let from = 0;
  while (true) {
    const { data: page, error } = await supabase
      .from("tcg_catalog")
      .select("group_id, group_name")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!page || page.length === 0) break;
    for (const g of page) uniqueGroups.set(g.group_id, g.group_name);
    if (page.length < PAGE) break;
    from += PAGE;
  }

  let setsChecked = 0;
  let logosUpserted = 0;

  for (const [groupId, groupName] of uniqueGroups) {
    setsChecked++;
    try {
      const match = await searchPokemonTcgSet(groupName);
      if (match?.images?.logo) {
        await supabase.from("set_logos").upsert(
          {
            group_id: groupId,
            group_name: groupName,
            logo_url: match.images.logo,
            symbol_url: match.images.symbol ?? null,
            // pokemontcg.io returns "YYYY/MM/DD" — normalize to ISO for
            // Postgres' `date` type.
            release_date: match.releaseDate
              ? match.releaseDate.replaceAll("/", "-")
              : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "group_id" }
        );
        logosUpserted++;
      }
    } catch (err) {
      console.error(`Failed to sync logo for "${groupName}":`, err);
    }
    await delay(DELAY_MS);
  }

  return { setsChecked, logosUpserted };
}
