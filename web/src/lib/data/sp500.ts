import { unstable_cache } from "next/cache";

export interface IndexHistoryPoint {
  captured_at: string;
  value: number;
}

// Yahoo Finance's public (unauthenticated) chart endpoint — same one used
// by countless finance widgets. No API key required; returns daily OHLC +
// close for a ticker/range. `^GSPC` is the S&P 500 index.
const YAHOO_CHART_URL =
  "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC";

interface YahooChartResponse {
  chart: {
    result: [
      {
        timestamp: number[];
        indicators: { quote: [{ close: (number | null)[] }] };
      },
    ] | null;
    error: unknown;
  };
}

async function fetchSp500HistoryUncached(): Promise<IndexHistoryPoint[]> {
  const res = await fetch(`${YAHOO_CHART_URL}?range=5y&interval=1d`, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`Yahoo Finance request failed: ${res.status}`);

  const json = (await res.json()) as YahooChartResponse;
  const result = json.chart.result?.[0];
  if (!result) throw new Error("Yahoo Finance returned no data");

  const { timestamp, indicators } = result;
  const closes = indicators.quote[0].close;

  const points: IndexHistoryPoint[] = [];
  for (let i = 0; i < timestamp.length; i++) {
    const close = closes[i];
    if (close == null) continue;
    points.push({
      captured_at: new Date(timestamp[i] * 1000).toISOString().slice(0, 10),
      value: close,
    });
  }
  return points;
}

// Cached for 6 hours — this is public market data shared across every
// user/request, not tied to any one account, so a single shared cache
// entry (rather than a per-user tag) is appropriate.
export const getSp500History = unstable_cache(
  fetchSp500HistoryUncached,
  ["sp500-history"],
  { revalidate: 21600 }
);
