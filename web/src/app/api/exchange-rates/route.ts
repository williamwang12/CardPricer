import { NextResponse } from "next/server";

let cachedRates: Record<string, number> | null = null;
let cachedAt = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET() {
  const now = Date.now();
  if (cachedRates && now - cachedAt < CACHE_TTL) {
    return NextResponse.json({ rates: cachedRates });
  }

  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("Exchange rate API error");
    const data = await res.json();
    const rates: Record<string, number> = {};
    for (const code of ["EUR", "GBP", "CAD", "AUD", "JPY"]) {
      if (data.rates?.[code]) rates[code] = data.rates[code];
    }
    cachedRates = rates;
    cachedAt = now;
    return NextResponse.json({ rates });
  } catch {
    // Return stale cache if available, otherwise empty
    return NextResponse.json({ rates: cachedRates ?? {} });
  }
}
