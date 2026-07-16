"use client";

import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import { useCurrency } from "@/components/currency-context";
import { cn } from "@/lib/cn";

interface DataPoint {
  time: string;
  value: number;
}

interface PriceChartProps {
  data: DataPoint[];
  title?: string;
  height?: number;
}

type Timeframe = "1M" | "3M" | "6M" | "1Y" | "ALL";

function filterByTimeframe(data: DataPoint[], tf: Timeframe): DataPoint[] {
  if (tf === "ALL" || data.length === 0) return data;

  const now = new Date();
  const days = { "1M": 30, "3M": 90, "6M": 180, "1Y": 365 }[tf];
  const cutoff = new Date(now.getTime() - days * 86400000);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  return data.filter((d) => d.time >= cutoffStr);
}

export default function PriceChart({
  data,
  title,
  height = 400,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("ALL");
  const { fmt } = useCurrency();

  const filteredData = useMemo(
    () => filterByTimeframe(data, timeframe),
    [data, timeframe]
  );

  const handleCrosshairMove = useCallback(
    (param: { time?: Time; seriesData?: Map<unknown, unknown> }) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;

      if (
        !param.time ||
        !param.seriesData ||
        param.seriesData.size === 0
      ) {
        tooltip.style.display = "none";
        return;
      }

      const entry = param.seriesData.values().next().value as
        | { value?: number }
        | undefined;
      if (!entry || entry.value == null) {
        tooltip.style.display = "none";
        return;
      }

      tooltip.style.display = "block";
      const dateStr = String(param.time);
      tooltip.innerHTML = `<div class="text-xs text-muted-foreground">${dateStr}</div><div class="text-sm font-semibold">${fmt(entry.value)}</div>`;
    },
    [fmt]
  );

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
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: "#0e7490",
      lineWidth: 2,
      topColor: "rgba(14, 116, 144, 0.28)",
      bottomColor: "rgba(14, 116, 144, 0.02)",
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: "#0e7490",
      crosshairMarkerBackgroundColor: "#ffffff",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    chart.subscribeCrosshairMove(handleCrosshairMove);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [height, handleCrosshairMove]);

  // Update data when filteredData changes
  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;

    const chartData = filteredData.map((d) => ({
      time: d.time as Time,
      value: d.value,
    }));

    series.setData(chartData);
    chart.timeScale().fitContent();
  }, [filteredData]);

  const timeframes: Timeframe[] = ["1M", "3M", "6M", "1Y", "ALL"];

  if (data.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-lg border border-dashed text-muted-foreground"
        style={{ height }}
      >
        <p className="text-sm">No price history available yet</p>
        <p className="text-xs mt-1">
          Data will appear after the next catalog sync
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        {title && (
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        )}
        <div className="flex gap-1 ml-auto">
          {timeframes.map((tf) => (
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
          className="absolute top-3 left-3 z-10 pointer-events-none bg-white/90 backdrop-blur-sm rounded px-2 py-1 border border-border shadow-sm"
          style={{ display: "none" }}
        />
        <div ref={containerRef} />
      </div>
    </div>
  );
}
