/**
 * Normalize a card name: Title Case, then uppercase EX/VSTAR/VMAX.
 */
export function normalizeName(name: string): string {
  let result = name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  result = result.replace(/\b(ex|vstar|vmax)\b/gi, (m) => m.toUpperCase());
  return result;
}

/**
 * Normalize a card number for comparison.
 * Takes the part before '/' and strips leading zeros from pure numeric strings.
 * e.g. "076/198" -> "76", "TG14/TG30" -> "TG14", "76" -> "76"
 */
export function normalizeNumber(num: string): string {
  const part = num.split("/")[0].trim();
  if (/^\d+$/.test(part)) {
    return part.replace(/^0+/, "") || "0";
  }
  return part;
}

/**
 * Extract the Pokemon name from a Collectr Product Name.
 *
 * Examples:
 *   'Charizard VSTAR (Secret)' -> 'Charizard VSTAR'
 *   'Flareon ex - 014/131 (Prismatic Evolutions Stamp)' -> 'Flareon ex'
 *   'Lugia V (Alternate Full Art)' -> 'Lugia V'
 *   'Mega Gengar ex' -> 'Mega Gengar ex'
 */
export function extractPokemonName(productName: string): string {
  let name = productName.split(" - ")[0].trim();
  name = name.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return name;
}

/**
 * Build a TCGPlayer search query from a card name.
 * Uses name only -- including the card number causes zero results for many sets.
 */
export function searchQuery(name: string): string {
  return name;
}

/**
 * Build a TCGPlayer search URL for a card.
 */
export function searchUrl(name: string): string {
  const query = encodeURIComponent(searchQuery(name));
  return `https://www.tcgplayer.com/search/pokemon/product?q=${query}&productLineName=pokemon`;
}

/**
 * Format a number as a float string, handling Excel-style float numbers.
 * e.g. 107.0 -> "107"
 */
export function cleanNumber(raw: string | number | null | undefined): string {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  // Only convert pure numeric values (handles Excel-style 107.0 → "107")
  // Avoid parseFloat on strings like "284/217" which would truncate to "284"
  if (/^\d+(\.\d+)?$/.test(s)) {
    const f = parseFloat(s);
    if (f === Math.floor(f)) {
      return String(Math.floor(f));
    }
  }
  return s;
}
