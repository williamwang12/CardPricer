"use client";

import { useState, useMemo } from "react";
import { PackageX } from "lucide-react";
import { useCurrency } from "@/lib/currency-context";
import type { StaleCardWithDetails } from "@/actions/shows";

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

  const totalFrozen = useMemo(
    () =>
      initialCards.reduce(
        (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
        0
      ),
    [initialCards]
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dead Inventory</h1>
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
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Stale Cards</span>
          <span className="text-2xl font-semibold">{initialCards.length}</span>
        </div>
        <div className="rounded-lg border p-4 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Frozen Cash</span>
          <span className="text-2xl font-semibold">{fmt(totalFrozen)}</span>
        </div>
      </div>

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
                    {card.number || "—"}
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
