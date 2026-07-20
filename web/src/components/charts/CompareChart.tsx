"use client";

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { cn } from "@/lib/cn";

export interface CompareSeries {
  id: string;
  label: string;
  color: string;
  data: { time: string; value: number }[];
}

interface CompareChartProps {
  series: CompareSeries[];
  onRemove: (id: string) => void;
  height?: number;
}

type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";
const TIMEFRAMES: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];

function filterByTimeframe(
  data: { time: string; value: number }[],
  tf: Timeframe
): { time: string; value: number }[] {
  if (tf === "ALL" || data.length === 0) return data;
  const days = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[tf];
  const cutoff = new Date(Date.now() - days * 86400000)
    .toISOString()
    .slice(0, 10);
  return data.filter((d) => d.time >= cutoff);
}

// Normalizes a series to "% change from the first point in range" so
// wildly different scales (card prices in dollars vs. an index in the
// thousands) can be compared meaningfully on one shared axis.
function toPctChange(
  data: { time: string; value: number }[]
): { time: string; value: number }[] {
  if (data.length === 0) return data;
  const base = data[0].value;
  if (!base) return data.map((d) => ({ time: d.time, value: 0 }));
  return data.map((d) => ({
    time: d.time,
    value: ((d.value - base) / base) * 100,
  }));
}

export default function CompareChart({
  series,
  onRemove,
  height = 460,
}: CompareChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesApisRef = useRef<Map<string, ISeriesApi<"Line">>>(new Map());
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("6M");

  const processed = useMemo(
    () =>
      series.map((s) => ({
        ...s,
        points: toPctChange(filterByTimeframe(s.data, timeframe)),
      })),
    [series, timeframe]
  );

  const handleCrosshairMove = useCallback(
    (param: { time?: Time; seriesData?: Map<unknown, unknown> }) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      if (!param.time || !param.seriesData || param.seriesData.size === 0) {
        tooltip.style.display = "none";
        return;
      }

      const rows: string[] = [];
      for (const s of processed) {
        const api = seriesApisRef.current.get(s.id);
        if (!api) continue;
        const entry = param.seriesData.get(api) as
          | { value?: number }
          | undefined;
        if (!entry || entry.value == null) continue;
        const sign = entry.value >= 0 ? "+" : "";
        rows.push(
          `<div class="flex items-center gap-1.5"><span class="inline-block h-2 w-2 rounded-full" style="background:${s.color}"></span><span class="text-muted-foreground">${s.label}</span><span class="font-mono font-semibold ml-auto">${sign}${entry.value.toFixed(1)}%</span></div>`
        );
      }
      if (rows.length === 0) {
        tooltip.style.display = "none";
        return;
      }
      tooltip.style.display = "block";
      tooltip.innerHTML = `<div class="text-xs text-muted-foreground mb-1">${String(param.time)}</div><div class="flex flex-col gap-1 min-w-[160px]">${rows.join("")}</div>`;
    },
    [processed]
  );

  // Create chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748b",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: "#f1f5f9" },
        horzLines: { color: "#f1f5f9" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: "#e2e8f0",
      },
      timeScale: {
        borderColor: "#e2e8f0",
        timeVisible: false,
      },
      localization: {
        priceFormatter: (p: number) => `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`,
      },
    });

    chart.subscribeCrosshairMove(handleCrosshairMove);
    chartRef.current = chart;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(container);

    const seriesApis = seriesApisRef.current;
    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesApis.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // Re-subscribe crosshair handler whenever it changes (captures fresh `processed`)
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => chart.unsubscribeCrosshairMove(handleCrosshairMove);
  }, [handleCrosshairMove]);

  // Sync series (add/remove/update) whenever `processed` changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const apis = seriesApisRef.current;

    const activeIds = new Set(processed.map((s) => s.id));
    for (const [id, api] of apis) {
      if (!activeIds.has(id)) {
        chart.removeSeries(api);
        apis.delete(id);
      }
    }

    for (const s of processed) {
      let api = apis.get(s.id);
      if (!api) {
        api = chart.addSeries(LineSeries, {
          color: s.color,
          lineWidth: 2,
          crosshairMarkerVisible: true,
          crosshairMarkerRadius: 4,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        apis.set(s.id, api);
      }
      api.setData(s.points.map((p) => ({ time: p.time as Time, value: p.value })));
    }

    chart.timeScale().fitContent();
  }, [processed]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          Comparison (% change)
        </h3>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                timeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-lg border bg-white p-2">
        <div
          ref={tooltipRef}
          className="absolute top-3 left-3 z-10 pointer-events-none bg-white/90 backdrop-blur-sm rounded px-2.5 py-2 border border-border shadow-sm"
          style={{ display: "none" }}
        />
        {/* Chart container is always mounted (never conditionally
            rendered) so `createChart` always has a real DOM node to
            attach to — swapping it in/out based on `series.length` would
            leave the chart permanently uninitialized whenever the first
            series is added after mount. The empty-state message is
            layered on top instead. */}
        <div ref={containerRef} style={series.length === 0 ? { height } : undefined} />
        {series.length === 0 && (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-muted-foreground"
            style={{ height }}
          >
            <p className="text-sm">Nothing charted yet</p>
            <p className="text-xs mt-1">
              Add a card, set, or index below to start comparing
            </p>
          </div>
        )}
      </div>

      {series.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {series.map((s) => (
            <button
              key={s.id}
              onClick={() => onRemove(s.id)}
              title="Remove from chart"
              className="group flex items-center gap-1.5 rounded-full border bg-card pl-2.5 pr-1.5 py-1 text-xs font-medium transition-colors hover:border-destructive/50 hover:bg-destructive/5"
            >
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="max-w-[160px] truncate">{s.label}</span>
              <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground group-hover:text-destructive">
                ×
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
