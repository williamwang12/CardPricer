import Papa from "papaparse";
import { extractPokemonName, cleanNumber, normalizeName } from "@/lib/utils";
import type { CardInput } from "@/lib/types";

function parsePrice(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const cleaned = String(raw).replace(/[$,]/g, "").trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : Math.round(n * 100) / 100;
}

/** TCGPlayer Collection export CSV: columns Product Name, Number, TCG Market Price */
export function parseTcgPlayerCsv(csvText: string): CardInput[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const cards: CardInput[] = [];
  for (const row of result.data) {
    const rawName = (row["Product Name"] ?? "").trim();
    if (!rawName) continue;

    // Strip trailing " - 168/142" number suffix
    const parts = rawName.split(" - ");
    const name = parts.length > 1 ? parts.slice(0, -1).join(" - ").trim() : rawName;

    const number = cleanNumber(row["Number"]);
    const market_price = parsePrice(row["TCG Market Price"]);

    cards.push({ name: normalizeName(name), number, quantity: 1, market_price });
  }
  return cards;
}

/** DeckTradr CSV: columns Card Name, Number, Quantity */
export function parseDeckTradrCsv(csvText: string): CardInput[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  const cards: CardInput[] = [];
  for (const row of result.data) {
    const name = (row["Card Name"] ?? "").replace(/"/g, "").trim();
    if (!name) continue;

    const number = cleanNumber((row["Number"] ?? "").replace(/"/g, ""));
    const qty = parseInt((row["Quantity"] ?? "1").trim(), 10);
    const quantity = isNaN(qty) || qty < 1 ? 1 : qty;

    cards.push({ name: normalizeName(name), number, quantity });
  }
  return cards;
}

/** Collectr CSV: columns Product Name, Card Number, Quantity, Market Price (As of YYYY-MM-DD) */
export function parseCollectrCsv(csvText: string): CardInput[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  // Find the Market Price column (name varies with date)
  const priceCol = result.meta.fields?.find((f) => f.startsWith("Market Price"));

  const cards: CardInput[] = [];
  for (const row of result.data) {
    const rawName = (row["Product Name"] ?? "").trim();
    if (!rawName) continue;

    const name = normalizeName(extractPokemonName(rawName));
    const number = cleanNumber(row["Card Number"]);
    const qty = parseInt((row["Quantity"] ?? "1").trim(), 10);
    const quantity = isNaN(qty) || qty < 1 ? 1 : qty;
    const market_price = priceCol ? parsePrice(row[priceCol]) : null;

    cards.push({ name, number, quantity, market_price });
  }
  return cards;
}
