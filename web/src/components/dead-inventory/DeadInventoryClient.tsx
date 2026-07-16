"use client";

import { useState, useMemo } from "react";
import { PackageX } from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  ReferenceLine,
  Cell,
} from "recharts";
import { useCurrency } from "@/components/currency-context";
import type { StaleCardWithDetails } from "@/actions/shows";

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface Props {
  initialCards: StaleCardWithDetails[];
}

export default function DeadInventoryClient({ initialCards }: Props) {
  const { fmt } = useCurrency();
  const [sortBy, setSortBy] = useState<"shows" | "value">("shows");

  const sorted = useMemo(() => {
    const cards = [...initialCards];
    if (sortBy === "value") {
      cards.sort(
        (a, b) =>
          (b.market_price ?? 0) * b.quantity -
          (a.market_price ?? 0) * a.quantity
      );
    } else {
      cards.sort((a, b) => b.consecutive_shows - a.consecutive_shows);
    }
    return cards;
  }, [initialCards, sortBy]);

  const totalMarketValue = useMemo(
    () =>
      initialCards.reduce(
        (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
        0
      ),
    [initialCards]
  );

  // Cards with cost_basis + frozen_since for counterfactual analysis
  const analysisCards = useMemo(
    () =>
      initialCards
        .filter((c) => c.cost_basis != null && c.frozen_since != null)
        .map((c) => ({
          name: c.name,
          number: c.number,
          consecutive_shows: c.consecutive_shows,
          cardValue: (c.market_price ?? 0) * c.quantity,
          totalBasis: c.cost_basis! * c.quantity,
          frozenAt: new Date(c.frozen_since!).getTime(),
        })),
    [initialCards]
  );

  const hasAnalysisData = analysisCards.length > 0;
  const actualTotal = analysisCards.reduce((s, c) => s + c.cardValue, 0);

  // What cost basis would be worth today if invested in SPY at freeze date
  const sp500Today = useMemo(() => {
    const now = Date.now();
    return analysisCards.reduce((sum, c) => {
      const days = (now - c.frozenAt) / MS_PER_DAY;
      return sum + c.totalBasis * (1 + 0.10 * days / 365);
    }, 0);
  }, [analysisCards]);

  const opportunityCost = sp500Today - actualTotal;

  // ── Counterfactual chart data ──────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!hasAnalysisData) return [];

    const earliest = Math.min(...analysisCards.map((c) => c.frozenAt));
    const now = new Date();
    const points: Array<{
      month: string;
      actual: number;
      sp500: number;
      pokemon: number;
      spGap: number;
    }> = [];

    const cursor = new Date(earliest);
    cursor.setDate(1);

    while (
      cursor.getFullYear() < now.getFullYear() ||
      (cursor.getFullYear() === now.getFullYear() &&
        cursor.getMonth() <= now.getMonth())
    ) {
      const endOfMonth = new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        0
      );
      // Clamp to today for the current month
      const ts = Math.min(endOfMonth.getTime(), now.getTime());
      const label =
        MONTHS[cursor.getMonth()] +
        " \u2019" +
        String(cursor.getFullYear()).slice(2);

      let actual = 0;
      let sp500 = 0;
      let pokemon = 0;

      for (const c of analysisCards) {
        if (ts < c.frozenAt) continue;
        actual += c.cardValue;
        const daysFrozen = (ts - c.frozenAt) / MS_PER_DAY;
        sp500 += c.totalBasis * (1 + 0.10 * daysFrozen / 365);
        pokemon += c.totalBasis * (1 + 0.25 * daysFrozen / 365);
      }

      points.push({
        month: label,
        actual,
        sp500,
        pokemon,
        spGap: Math.max(0, sp500 - actual),
      });

      cursor.setMonth(cursor.getMonth() + 1);
    }

    return points;
  }, [analysisCards, hasAnalysisData]);

  // ── Triage scatter data ────────────────────────────────────────────────────
  const scatterData = useMemo(() => {
    const now = Date.now();
    return analysisCards
      .filter((c) => c.totalBasis > 0)
      .map((c) => {
        const daysFrozen = (now - c.frozenAt) / MS_PER_DAY;
        const yearsFrozen = daysFrozen / 365;
        if (yearsFrozen < 0.01) return null;

        const returnPct = (c.cardValue - c.totalBasis) / c.totalBasis;
        const annualized = returnPct / yearsFrozen;
        const alpha = (annualized - 0.10) * 100;

        return {
          name: c.name,
          number: c.number,
          shows: c.consecutive_shows,
          alpha: Math.round(alpha * 10) / 10,
          basis: c.totalBasis,
          value: c.cardValue,
        };
      })
      .filter(
        (d): d is NonNullable<typeof d> => d !== null
      );
  }, [analysisCards]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Dead Inventory</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "shows" | "value")}
            className="h-8 rounded-md border border-input bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="shows">Shows Unsold</option>
            <option value="value">Value</option>
          </select>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Stale Cards</span>
          <span className="text-2xl font-semibold">{initialCards.length}</span>
        </div>
        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Current Value</span>
          <span className="text-2xl font-semibold">{fmt(totalMarketValue)}</span>
        </div>
        {hasAnalysisData && (
          <>
            <div className="rounded-lg border p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                If in S&P
              </span>
              <span className="text-2xl font-semibold">
                {fmt(sp500Today)}
              </span>
            </div>
            <div className="rounded-lg border p-4 flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">
                Opportunity Cost
              </span>
              <span
                className={`text-2xl font-semibold ${opportunityCost > 0 ? "text-red-600" : "text-green-600"}`}
              >
                {opportunityCost > 0 ? "+" : ""}
                {fmt(opportunityCost)}
              </span>
            </div>
          </>
        )}
      </div>
      <p className="text-xs text-muted-foreground -mt-4">
        Counterfactual: what each card&apos;s cost basis would be worth in S&P
        500 (10% annualized) if invested at the date the card became stale.
      </p>

      {/* ── Counterfactual chart ──────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-4">
            Dead Cohort: Actual vs. Counterfactual
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={chartData}>
              <defs>
                <linearGradient id="gapFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                tickFormatter={(v: number) => fmt(v)}
                width={80}
              />
              <Tooltip
                formatter={(value: any, name: any) => {
                  const labels: Record<string, string> = {
                    actual: "Actual Value",
                    sp500: "If in S&P 500",
                    pokemon: "If in Pokemon Index",
                  };
                  return [fmt(value as number), labels[name as string] ?? name];
                }}
                labelFormatter={(label: any) => String(label)}
                itemSorter={(item: any) => {
                  const order: Record<string, number> = {
                    pokemon: 0,
                    sp500: 1,
                    actual: 2,
                  };
                  return order[item.dataKey as string] ?? 3;
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    actual: "Actual Value",
                    sp500: "If in S&P 500 (10%)",
                    pokemon: "If in Pokemon Index (25%)",
                  };
                  return labels[value] ?? value;
                }}
              />
              {/* Shaded gap: stacked Area = actual (invisible) + gap (blue) */}
              <Area
                dataKey="actual"
                stackId="gap"
                fill="transparent"
                stroke="none"
              />
              <Area
                dataKey="spGap"
                stackId="gap"
                fill="url(#gapFill)"
                stroke="none"
                legendType="none"
                tooltipType="none"
              />
              {/* Visible lines */}
              <Line
                dataKey="actual"
                stroke="#94a3b8"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                legendType="plainline"
              />
              <Line
                dataKey="sp500"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="pokemon"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Triage scatter ────────────────────────────────────────────────── */}
      {scatterData.length > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-1">
            Triage: What to Cut
          </h2>
          <p className="text-xs text-muted-foreground mb-4">
            Bottom-right = held long, underperforming, big money. That&apos;s
            your discount pile.
          </p>
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <XAxis
                dataKey="shows"
                type="number"
                name="Shows Unsold"
                tick={{ fontSize: 11 }}
                tickLine={false}
                label={{
                  value: "Shows Unsold",
                  position: "insideBottom",
                  offset: -10,
                  fontSize: 11,
                  fill: "#94a3b8",
                }}
                allowDecimals={false}
              />
              <YAxis
                dataKey="alpha"
                type="number"
                name="Alpha vs S&P"
                tick={{ fontSize: 11 }}
                tickLine={false}
                unit="%"
                label={{
                  value: "Alpha vs S&P (%)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  fontSize: 11,
                  fill: "#94a3b8",
                }}
              />
              <ZAxis
                dataKey="basis"
                type="number"
                range={[40, 400]}
                name="Cost Basis"
              />
              <ReferenceLine
                y={0}
                stroke="#94a3b8"
                strokeDasharray="4 3"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload as (typeof scatterData)[number];
                  return (
                    <div className="rounded border bg-white px-3 py-2 text-xs shadow-sm">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">{d.number}</p>
                      <p className="mt-1">
                        Alpha:{" "}
                        <span
                          className={
                            d.alpha >= 0 ? "text-green-600" : "text-red-600"
                          }
                        >
                          {d.alpha > 0 ? "+" : ""}
                          {d.alpha.toFixed(1)}%
                        </span>
                      </p>
                      <p>Basis: {fmt(d.basis)}</p>
                      <p>Value: {fmt(d.value)}</p>
                      <p>Shows: {d.shows}</p>
                    </div>
                  );
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.alpha >= 0 ? "#22c55e" : "#ef4444"}
                    fillOpacity={0.7}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-lg border py-12 text-center flex flex-col items-center gap-2">
          <PackageX className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No stale cards yet. Finalize a few shows to start tracking.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left px-4 py-2 font-medium">Name</th>
                <th className="text-left px-4 py-2 font-medium w-20">Number</th>
                <th className="text-right px-4 py-2 font-medium w-16">Qty</th>
                <th className="text-right px-4 py-2 font-medium w-28">Price</th>
                <th className="text-right px-4 py-2 font-medium w-28">Total Value</th>
                <th className="text-right px-4 py-2 font-medium w-28">Shows Unsold</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((card) => (
                <tr
                  key={card.card_key}
                  className="border-b last:border-0 hover:bg-muted/20"
                >
                  <td className="px-4 py-1.5">{card.name}</td>
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {card.number || "\u2014"}
                  </td>
                  <td className="px-4 py-1.5 text-right">{card.quantity}</td>
                  <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                    {fmt(card.market_price)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono">
                    {fmt(
                      card.market_price != null
                        ? card.market_price * card.quantity
                        : null
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-right">
                    <span
                      className={`inline-flex items-center justify-center min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        card.consecutive_shows >= 5
                          ? "bg-red-100 text-red-700"
                          : card.consecutive_shows >= 3
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {card.consecutive_shows}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
