"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  Upload,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/currency-context";
import type { DashboardData } from "@/lib/db/dashboard";

interface Props {
  data: DashboardData;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const TIMEFRAMES = [
  { label: "1M", days: 30 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "All", days: 0 },
] as const;

function formatAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CollectionChart({
  history,
}: {
  history: { date: string; value: number }[];
}) {
  const { fmt } = useCurrency();
  const [timeframe, setTimeframe] = useState<number>(0);

  const filtered = useMemo(() => {
    if (timeframe === 0 || history.length === 0) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeframe);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    return history.filter((h) => h.date >= cutoffStr);
  }, [history, timeframe]);

  if (history.length < 2) {
    return (
      <div>
        <h2 className="font-heading text-base font-semibold">
          Collection value over time
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Daily snapshots after each price refresh
        </p>
        <div className="mt-3 rounded-xl border border-dashed p-8 flex flex-col items-center justify-center text-center gap-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Chart will appear once at least 2 daily snapshots are recorded.
          </p>
          <p className="text-xs text-muted-foreground">
            Snapshots are saved automatically after each price refresh.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading text-base font-semibold">
            Collection value over time
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Daily snapshots after each price refresh
          </p>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setTimeframe(tf.days)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                timeframe === tf.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filtered}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="date"
              tickFormatter={formatAxisDate}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)}`}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as { date: string; value: number };
                return (
                  <div className="rounded-lg border bg-background px-3 py-2 shadow-sm text-sm">
                    <p className="text-muted-foreground">{formatAxisDate(d.date)}</p>
                    <p className="font-medium tabular-nums">{fmt(d.value)}</p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function DashboardClient({ data }: Props) {
  const { fmt } = useCurrency();

  const isPositive = data.netMovement >= 0;
  const hasSnapshot = data.lastSnapshotAt != null;
  const hasCards = data.totalCards > 0;
  const maxSetValue =
    data.valueBySet.length > 0 ? data.valueBySet[0].value : 0;

  if (!hasCards) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <h1 className="font-heading text-xl font-semibold">Your collection</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          Import your inventory to see your collection value, price movements,
          and set breakdown.
        </p>
        <Button asChild>
          <Link href="/add">
            <Upload className="h-4 w-4" />
            Import inventory
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-semibold">
            Your collection
          </h1>
          {data.lastRefreshed && (
            <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Prices refreshed {timeAgo(data.lastRefreshed)}
            </p>
          )}
        </div>
        <Button asChild>
          <Link href="/add">
            <Upload className="h-4 w-4" />
            Import inventory
          </Link>
        </Button>
      </div>

      {/* Hero value card */}
      <div className="rounded-xl bg-muted p-5 sm:p-6">
        <p className="text-sm text-muted-foreground">Total collection value</p>
        <p className="font-heading text-4xl sm:text-[2.75rem] leading-tight tabular-nums mt-1">
          {fmt(data.totalValue)}
        </p>
        {hasSnapshot && (
          <span
            className={`inline-flex items-center gap-1.5 mt-3 text-sm font-medium px-2.5 py-1 rounded-md ${
              isPositive
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {isPositive ? "+" : "\u2212"}
            {fmt(Math.abs(data.netMovement))} ·{" "}
            {Math.abs(data.netMovementPct).toFixed(1)}% since last export
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm text-muted-foreground">Cards tracked</p>
          <p className="text-2xl font-medium tabular-nums mt-1">
            {data.totalCards.toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">
            {data.uniqueCards.toLocaleString()} unique
          </p>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm text-muted-foreground">Net movement</p>
          <p
            className={`text-2xl font-medium tabular-nums mt-1 ${
              hasSnapshot
                ? data.netMovement >= 0
                  ? "text-green-700"
                  : "text-red-700"
                : ""
            }`}
          >
            {hasSnapshot
              ? `${data.netMovement >= 0 ? "+" : "\u2212"}${fmt(Math.abs(data.netMovement))}`
              : "\u2014"}
          </p>
          {hasSnapshot && (
            <p className="text-xs text-muted-foreground">
              {data.priceUps} up · {data.priceDowns} down
            </p>
          )}
        </div>
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm text-muted-foreground">Newcomers</p>
          <p className="text-2xl font-medium tabular-nums mt-1">
            {hasSnapshot ? data.newcomerCount : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">since last export</p>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm text-muted-foreground">Removed</p>
          <p className="text-2xl font-medium tabular-nums mt-1">
            {hasSnapshot ? data.removedCount : "\u2014"}
          </p>
          <p className="text-xs text-muted-foreground">sold or pulled</p>
        </div>
      </div>

      {/* Collection value chart */}
      <CollectionChart history={data.history} />

      {/* Value by set */}
      {data.valueBySet.length > 0 && (
        <div>
          <h2 className="font-heading text-base font-semibold mb-3">
            Value by set
          </h2>
          <div className="flex flex-col gap-2.5">
            {data.valueBySet.map((s) => (
              <div key={s.setName}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground truncate mr-3">
                    {s.setName}
                  </span>
                  <span className="tabular-nums flex-shrink-0">
                    {fmt(s.value)}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{
                      width: `${Math.round((s.value / maxSetValue) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Biggest movers */}
      {hasSnapshot && (data.gainers.length > 0 || data.drops.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-semibold">
              Biggest movers since last export
            </h2>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/export" className="text-xs">
                See all movers
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Gainers */}
            <div className="rounded-lg border overflow-hidden">
              <div className="text-sm text-green-700 px-3.5 py-2.5 border-b flex items-center gap-1.5 font-medium">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Gainers
              </div>
              {data.gainers.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3.5 py-4 text-center">
                  No gainers
                </p>
              ) : (
                data.gainers.map((m, i) => (
                  <div
                    key={`${m.name}-${m.number}`}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      i < data.gainers.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{m.name}</p>
                      {m.setName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {m.setName}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt(m.oldPrice)} → {fmt(m.newPrice)}
                      </p>
                      <p className="text-sm font-medium text-green-700 tabular-nums">
                        +{m.deltaPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drops */}
            <div className="rounded-lg border overflow-hidden">
              <div className="text-sm text-red-700 px-3.5 py-2.5 border-b flex items-center gap-1.5 font-medium">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Drops
              </div>
              {data.drops.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3.5 py-4 text-center">
                  No drops
                </p>
              ) : (
                data.drops.map((m, i) => (
                  <div
                    key={`${m.name}-${m.number}`}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      i < data.drops.length - 1 ? "border-b" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm truncate">{m.name}</p>
                      {m.setName && (
                        <p className="text-xs text-muted-foreground truncate">
                          {m.setName}
                        </p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {fmt(m.oldPrice)} → {fmt(m.newPrice)}
                      </p>
                      <p className="text-sm font-medium text-red-700 tabular-nums">
                        &minus;{m.deltaPct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prompt to export if no snapshot yet */}
      {!hasSnapshot && (
        <div className="rounded-xl border border-dashed p-8 flex flex-col items-center text-center gap-3">
          <p className="text-sm text-muted-foreground max-w-sm">
            Export your price list to start tracking price changes between
            sessions.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/export">Go to Export</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
