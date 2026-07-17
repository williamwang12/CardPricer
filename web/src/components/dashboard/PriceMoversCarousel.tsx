"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useCurrency } from "@/components/currency-context";
import type { Mover } from "@/lib/db/dashboard";

interface MoverWithDirection extends Mover {
  direction: "up" | "down";
}

interface Props {
  gainers: Mover[];
  drops: Mover[];
}

export default function PriceMoversCarousel({ gainers, drops }: Props) {
  const { fmt } = useCurrency();

  const movers: MoverWithDirection[] = [
    ...gainers.map((m) => ({ ...m, direction: "up" as const })),
    ...drops.map((m) => ({ ...m, direction: "down" as const })),
  ].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  if (movers.length === 0) return null;

  // Roughly 4s per card so the loop speed feels consistent regardless of count.
  const duration = `${Math.max(movers.length * 8, 24)}s`;

  const renderCard = (m: MoverWithDirection, key: string) => {
    const isUp = m.direction === "up";
    return (
      <div
        key={key}
        className="flex-shrink-0 w-52 rounded-lg border bg-card p-3.5 flex flex-col gap-2"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{m.name}</p>
            {m.setName && (
              <p className="text-xs text-muted-foreground truncate">{m.setName}</p>
            )}
          </div>
          {isUp ? (
            <ArrowUpRight className="h-4 w-4 text-green-600 flex-shrink-0" />
          ) : (
            <ArrowDownRight className="h-4 w-4 text-red-600 flex-shrink-0" />
          )}
        </div>
        <div className="mt-auto flex items-end justify-between gap-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {fmt(m.oldPrice)} → {fmt(m.newPrice)}
          </p>
          <p
            className={`text-sm font-semibold tabular-nums ${
              isUp ? "text-green-700" : "text-red-700"
            }`}
          >
            {isUp ? "+" : "\u2212"}
            {m.deltaPct.toFixed(1)}%
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="group relative overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_2rem,black_calc(100%-2rem),transparent)]">
      <div
        className="flex gap-3 w-max animate-marquee group-hover:[animation-play-state:paused]"
        style={{ "--marquee-duration": duration } as React.CSSProperties}
      >
        {movers.map((m) => renderCard(m, `a-${m.direction}-${m.name}-${m.number}`))}
        {/* Duplicate track for a seamless, infinite loop */}
        {movers.map((m) => renderCard(m, `b-${m.direction}-${m.name}-${m.number}`))}
      </div>
    </div>
  );
}
