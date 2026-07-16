export const SUPPORTED_CURRENCIES = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", decimals: 2 },
  EUR: { code: "EUR", symbol: "\u20AC", name: "Euro", decimals: 2 },
  GBP: { code: "GBP", symbol: "\u00A3", name: "British Pound", decimals: 2 },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar", decimals: 2 },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", decimals: 2 },
  JPY: { code: "JPY", symbol: "\u00A5", name: "Japanese Yen", decimals: 0 },
} as const;

export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

export function formatPrice(
  usdPrice: number | null,
  currencyCode: CurrencyCode = "USD",
  rate = 1,
  roundingMode: "round" | "ceil" | "floor" = "round",
  decimalOverride?: number
): string {
  if (usdPrice == null) return "\u2014";

  const info = SUPPORTED_CURRENCIES[currencyCode];
  const converted = usdPrice * rate;
  const decimals = decimalOverride ?? info.decimals;
  const factor = Math.pow(10, decimals);

  let rounded: number;
  switch (roundingMode) {
    case "ceil":
      rounded = Math.ceil(converted * factor) / factor;
      break;
    case "floor":
      rounded = Math.floor(converted * factor) / factor;
      break;
    default:
      rounded = Math.round(converted * factor) / factor;
  }

  return `${info.symbol}${rounded.toFixed(decimals)}`;
}
