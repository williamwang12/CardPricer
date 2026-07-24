import type { CatalogSet } from "@/lib/db/catalog";

// Shared "smart" card-search query parser — turns a free-text query like
// "Charizard 151" into a name + matched set + card number so searches can be
// narrowed. Extracted from the Catalog page so the Trade Calculator (and any
// other card-add search) parse identically.

function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Card-type qualifiers that appear in card names across every set (e.g.
// "Gardevoir ex", "Charizard V", "Pikachu VMAX"). They also happen to appear
// in some set names ("ex Battle Stadium", the EX-era sets, etc.), so a bare
// trailing qualifier would otherwise be mis-read as a set filter and wrongly
// pin the search to that one set. When a trailing phrase is composed ONLY of
// these, it's a card suffix, not a set — leave it in the name part.
const CARD_QUALIFIERS = new Set([
  "ex",
  "gx",
  "v",
  "vmax",
  "vstar",
  "vunion",
  "break",
  "prime",
]);

// Given a token list, finds the longest trailing phrase that whole-word
// matches inside any loaded set's name (e.g. ["Charizard", "151"] matches
// "Scarlet & Violet 151" at splitAt=1). Tries the longest trailing phrase
// first (most specific) down to a single trailing word, and always leaves at
// least one leading token. Returns null if nothing matches.
function matchTrailingSet(
  tokens: string[],
  sets: CatalogSet[]
): { splitAt: number; matchedSet: CatalogSet } | null {
  for (let splitAt = 1; splitAt < tokens.length; splitAt++) {
    const trailingPhrase = normalizeWords(tokens.slice(splitAt).join(" "));
    if (!trailingPhrase) continue;
    // Skip phrases that are purely card qualifiers ("ex", "gx v", …) — those
    // are part of the card name, not a set to filter on.
    if (trailingPhrase.split(" ").every((w) => CARD_QUALIFIERS.has(w))) {
      continue;
    }
    const match = sets.find((s) =>
      ` ${normalizeWords(s.group_name)} `.includes(` ${trailingPhrase} `)
    );
    if (match) return { splitAt, matchedSet: match };
  }
  return null;
}

export interface ParsedCardQuery {
  namePart: string;
  matchedSet: CatalogSet | null;
  numberPart: string | null;
}

// Parses queries like "Charizard 151" into a card-name part ("Charizard")
// plus a matched set ("Scarlet & Violet 151"), and queries like "Charizard 6"
// into a name part plus a card-number part ("6"). Handles the ambiguous case
// where a trailing number could be either a card number OR part of a set's
// name by trying, in order: peel the trailing number as a candidate card
// number then match a set in what's left; else match a set using all tokens;
// else treat the trailing number as a plain card-number filter. Falls back to
// { namePart: query, matchedSet: null, numberPart: null } — plain
// substring-on-name behavior — when nothing matches.
export function parseCatalogQuery(
  query: string,
  sets: CatalogSet[]
): ParsedCardQuery {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { namePart: "", matchedSet: null, numberPart: null };
  }

  const lastToken = tokens[tokens.length - 1];
  const lastIsNumeric =
    tokens.length > 1 && /^\d{1,4}(\/\d{1,4})?$/.test(lastToken);

  if (lastIsNumeric) {
    const remaining = tokens.slice(0, -1);
    const remainingMatch = matchTrailingSet(remaining, sets);
    if (remainingMatch) {
      return {
        namePart: remaining.slice(0, remainingMatch.splitAt).join(" "),
        matchedSet: remainingMatch.matchedSet,
        numberPart: lastToken,
      };
    }
  }

  const fullMatch = matchTrailingSet(tokens, sets);
  if (fullMatch) {
    return {
      namePart: tokens.slice(0, fullMatch.splitAt).join(" "),
      matchedSet: fullMatch.matchedSet,
      numberPart: null,
    };
  }

  if (lastIsNumeric) {
    return {
      namePart: tokens.slice(0, -1).join(" "),
      matchedSet: null,
      numberPart: lastToken,
    };
  }

  return { namePart: query.trim(), matchedSet: null, numberPart: null };
}
