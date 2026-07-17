/**
 * Normalize a card name: Title Case, then uppercase EX/VSTAR/VMAX.
 * Also strips apostrophes since our catalog (sourced from TCGPlayer's
 * "clean name") never contains them, e.g. "Lillie's Determination" ->
 * "Lillies Determination". Without this, names never match the catalog
 * and cards can't sync prices/images.
 */
export function normalizeName(name: string): string {
  let result = name
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  result = result.replace(/\b(ex|vstar|vmax)\b/gi, (m) => m.toUpperCase());
  result = result.replace(/['\u2018\u2019]/g, "");
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
 * Derive a catalog "clean name" from a raw TCGPlayer product name, stripping
 * the " - <number>" suffix, any trailing "(variant)" annotation, and
 * apostrophes. We compute this ourselves instead of trusting TCGPlayer's own
 * `cleanName` field, since it sometimes includes the card number suffix
 * verbatim (e.g. "Ethan's Typhlosion - 190/182" -> "Ethans Typhlosion 190
 * 182" instead of just "Ethans Typhlosion").
 */
export function deriveCleanName(rawName: string): string {
  return extractPokemonName(rawName).replace(/['\u2018\u2019]/g, "");
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
