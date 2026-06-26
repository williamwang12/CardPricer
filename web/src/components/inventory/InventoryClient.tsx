"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { toast } from "sonner";
import { ExternalLink, Trash2, RefreshCw, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  updateCardAction,
  deleteCardsAction,
  savePriceAction,
  deleteAllAction,
} from "@/actions/cards";
import type { Card, PriceMover } from "@/lib/types";

interface Props {
  initialCards: Card[];
  lastRefreshed: string | null;
}

function fmt(price: number | null) {
  if (price == null) return "—";
  return `$${price.toFixed(2)}`;
}

function EditableCell({
  value,
  onSave,
  className,
  type = "text",
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  type?: "text" | "number";
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);

  useEffect(() => {
    if (!editing) setLocal(value);
  }, [value, editing]);

  if (!editing) {
    return (
      <span
        className={`cursor-pointer hover:underline hover:decoration-dotted ${className ?? ""}`}
        onClick={() => setEditing(true)}
        title="Click to edit"
      >
        {local || <span className="text-muted-foreground italic">—</span>}
      </span>
    );
  }

  return (
    <input
      autoFocus
      type={type}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (local !== value) onSave(local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setLocal(value);
          setEditing(false);
        }
      }}
      className="w-full bg-transparent border border-ring rounded px-1 focus:outline-none text-sm"
    />
  );
}

export default function InventoryClient({ initialCards, lastRefreshed }: Props) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshStatus, setRefreshStatus] = useState("");
  const [movers, setMovers] = useState<PriceMover[]>([]);
  const [moversMinPrice, setMoversMinPrice] = useState(0);
  const [, startTransition] = useTransition();

  // Keep cards in sync when server re-renders pass new initialCards
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);

  const totalValue = cards.reduce(
    (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
    0
  );
  const pricedCount = cards.filter((c) => c.market_price != null).length;

  // ── Selection ──────────────────────────────────────────────────────────────
  const allSelected = cards.length > 0 && selected.size === cards.length;
  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(cards.map((c) => c.id)));
    }
  };
  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── Inline edit ────────────────────────────────────────────────────────────
  const handleUpdate = useCallback(
    (card: Card, field: keyof Card, raw: string) => {
      let value: unknown = raw;
      if (field === "quantity") value = Math.max(0, parseInt(raw, 10) || 0);

      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, [field]: value } : c))
      );
      startTransition(async () => {
        try {
          if (field === "quantity" && Number(value) <= 0) {
            setCards((prev) => prev.filter((c) => c.id !== card.id));
            await deleteCardsAction([card.id]);
            toast.success("Card removed (qty set to 0)");
          } else {
            await updateCardAction(card.id, { [field]: value });
          }
        } catch {
          toast.error("Failed to save");
        }
      });
    },
    []
  );

  const handleManualToggle = useCallback((card: Card, checked: boolean) => {
    setCards((prev) =>
      prev.map((c) =>
        c.id === card.id ? { ...c, manual_price: checked } : c
      )
    );
    startTransition(async () => {
      try {
        await updateCardAction(card.id, { manual_price: checked });
      } catch {
        toast.error("Failed to save");
      }
    });
  }, []);

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDeleteSelected = useCallback(async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} card(s)?`)) return;
    setCards((prev) => prev.filter((c) => !selected.has(c.id)));
    setSelected(new Set());
    try {
      await deleteCardsAction(ids);
      toast.success(`Deleted ${ids.length} card(s)`);
    } catch {
      toast.error("Delete failed");
    }
  }, [selected]);

  const handleDeleteOne = useCallback(async (card: Card) => {
    if (!confirm(`Delete ${card.name}?`)) return;
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(card.id);
      return next;
    });
    try {
      await deleteCardsAction([card.id]);
      toast.success(`Deleted ${card.name}`);
    } catch {
      toast.error("Delete failed");
    }
  }, []);

  // ── Price refresh ──────────────────────────────────────────────────────────
  const handleRefreshPrices = useCallback(
    async (all = false) => {
      const toRefresh = cards.filter(
        (c) => (all || c.market_price == null) && !c.manual_price
      );
      if (!toRefresh.length) {
        toast.info("No cards to refresh");
        return;
      }
      setRefreshing(true);
      setRefreshProgress(0);
      setMovers([]);

      // Snapshot old prices before refresh
      const oldPrices = new Map<number, number | null>(
        toRefresh.map((c) => [c.id, c.market_price])
      );

      let updated = 0;
      const newPriceMap = new Map<number, number | null>();

      for (let i = 0; i < toRefresh.length; i++) {
        const card = toRefresh[i];
        setRefreshStatus(`${card.name} (${i + 1}/${toRefresh.length})`);
        try {
          const res = await fetch("/api/scraper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: card.name, number: card.number }),
          });
          if (res.ok) {
            const data = (await res.json()) as {
              price: number | null;
              url: string | null;
            };
            if (data.price != null || data.url != null) {
              newPriceMap.set(card.id, data.price);
              setCards((prev) =>
                prev.map((c) =>
                  c.id === card.id
                    ? { ...c, market_price: data.price, tcgplayer_url: data.url }
                    : c
                )
              );
              await savePriceAction(card.id, data.price, data.url);
              updated++;
            }
          }
        } catch {
          // continue on individual failure
        }
        setRefreshProgress(((i + 1) / toRefresh.length) * 100);
      }

      // Compute price movers (only for "Refresh All")
      if (all) {
        const computed: PriceMover[] = [];
        for (const card of toRefresh) {
          const oldPrice = oldPrices.get(card.id) ?? null;
          const newPrice = newPriceMap.get(card.id) ?? null;
          if (oldPrice != null && newPrice != null) {
            const change = Math.round((newPrice - oldPrice) * 100) / 100;
            if (Math.abs(change) >= 0.01) {
              computed.push({
                name: card.name,
                number: card.number,
                oldPrice,
                newPrice,
                change,
              });
            }
          }
        }
        // Sort by absolute change descending
        computed.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
        setMovers(computed);
      }

      setRefreshing(false);
      setRefreshStatus("");
      toast.success(`Updated ${updated} price(s)`);
    },
    [cards]
  );

  // ── Delete all ─────────────────────────────────────────────────────────────
  const handleDeleteAll = async () => {
    if (!confirm("Delete ALL cards? This cannot be undone.")) return;
    try {
      await deleteAllAction();
      setCards([]);
      setSelected(new Set());
      toast.success("All cards deleted");
    } catch {
      toast.error("Failed to delete all");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        {/* Title + stats */}
        <div>
          <h1 className="text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-2">
            <span>{cards.length} cards · {pricedCount} priced</span>
            <span className="font-medium text-foreground">Total: {fmt(totalValue)}</span>
            {lastRefreshed && (
              <span className="text-xs">
                · Prices refreshed{" "}
                {(() => {
                  const diff = Date.now() - new Date(lastRefreshed).getTime();
                  const h = Math.floor(diff / 3600000);
                  const d = Math.floor(h / 24);
                  if (d > 0) return `${d}d ago`;
                  if (h > 0) return `${h}h ago`;
                  return "recently";
                })()}
              </span>
            )}
            {!lastRefreshed && (
              <span className="text-xs">· Prices refresh daily</span>
            )}
          </p>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          {selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-4 w-4" />
              Delete {selected.size}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefreshPrices(false)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Missing
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDeleteAll}
            className="text-destructive hover:text-destructive"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {refreshing && (
        <div className="flex flex-col gap-1">
          <Progress value={refreshProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">{refreshStatus}</p>
        </div>
      )}

      {/* Beta reset notice */}
      {cards.length === 0 && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          We recently adjusted our database indexes and had to reset all card data. Please re-import your collection — sorry for the inconvenience!
        </div>
      )}

      {/* Table */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-2">
          <p className="text-lg">No cards yet</p>
          <p className="text-sm">
            Go to{" "}
            <a href="/add" className="underline">
              Add Cards
            </a>{" "}
            to import your collection.
          </p>
        </div>
      ) : (
        <>
          {/* ── Mobile card list ─────────────────────────────────── */}
          <div className="sm:hidden rounded-lg border divide-y">
            {cards.map((card) => (
              <div key={card.id} className="px-3 py-3 flex flex-col gap-1.5">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={selected.has(card.id)}
                    onCheckedChange={() => toggleOne(card.id)}
                    aria-label={`Select ${card.name}`}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-snug break-words">
                      {card.name}
                    </p>
                    {card.number && (
                      <p className="text-xs text-muted-foreground">#{card.number}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteOne(card)}
                    className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                    title="Delete"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-3 pl-6 text-sm flex-wrap">
                  <span className="text-muted-foreground">
                    Qty:{" "}
                    <EditableCell
                      value={String(card.quantity)}
                      onSave={(v) => handleUpdate(card, "quantity", v)}
                      type="number"
                      className="inline w-10"
                    />
                  </span>
                  <span className="font-mono font-medium">
                    {card.market_price ? (
                      card.manual_price ? (
                        <EditableCell
                          value={String(card.market_price)}
                          onSave={(v) => {
                            const p = parseFloat(v);
                            const price = isNaN(p) ? null : Math.round(p * 100) / 100;
                            setCards((prev) =>
                              prev.map((c) =>
                                c.id === card.id ? { ...c, market_price: price } : c
                              )
                            );
                            savePriceAction(card.id, price, card.tcgplayer_url);
                          }}
                          type="number"
                          className="w-16"
                        />
                      ) : (
                        fmt(card.market_price)
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  {card.market_price != null && card.quantity > 1 && (
                    <span className="text-muted-foreground font-mono text-xs">
                      total {fmt(card.market_price * card.quantity)}
                    </span>
                  )}
                  {card.tcgplayer_url && (
                    <a
                      href={card.tcgplayer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800"
                      title="View on TCGPlayer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            ))}
            <div className="px-3 py-2 bg-muted/30 text-sm flex justify-between text-muted-foreground">
              <span>{cards.length} cards</span>
              <span className="font-semibold font-mono text-foreground">{fmt(totalValue)}</span>
            </div>
          </div>

          {/* ── Desktop table ─────────────────────────────────────── */}
          <div className="hidden sm:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-10 px-3 text-left">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="h-10 px-3 text-left font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="h-10 px-3 text-left font-medium text-muted-foreground w-28">
                    Number
                  </th>
                  <th className="h-10 px-3 text-left font-medium text-muted-foreground w-16">
                    Qty
                  </th>
                  <th className="h-10 px-3 text-center font-medium text-muted-foreground w-16">
                    Manual
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    Price
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    Total
                  </th>
                  <th className="h-10 px-3 text-center font-medium text-muted-foreground w-12">
                    Link
                  </th>
                  <th className="h-10 px-3 w-10" />
                </tr>
              </thead>
              <tbody>
                {cards.map((card) => (
                  <tr
                    key={card.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(card.id)}
                        onCheckedChange={() => toggleOne(card.id)}
                        aria-label={`Select ${card.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-xs">
                      <EditableCell
                        value={card.name}
                        onSave={(v) => handleUpdate(card, "name", v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={card.number}
                        onSave={(v) => handleUpdate(card, "number", v)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <EditableCell
                        value={String(card.quantity)}
                        onSave={(v) => handleUpdate(card, "quantity", v)}
                        type="number"
                        className="w-12"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Checkbox
                        checked={card.manual_price}
                        onCheckedChange={(c) =>
                          handleManualToggle(card, c === true)
                        }
                        aria-label="Manual price"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {card.manual_price ? (
                        <EditableCell
                          value={card.market_price != null ? String(card.market_price) : ""}
                          onSave={(v) => {
                            const p = parseFloat(v);
                            const price = isNaN(p) ? null : Math.round(p * 100) / 100;
                            setCards((prev) =>
                              prev.map((c) =>
                                c.id === card.id ? { ...c, market_price: price } : c
                              )
                            );
                            savePriceAction(card.id, price, card.tcgplayer_url);
                          }}
                          type="number"
                          className="text-right w-20"
                        />
                      ) : (
                        <span className={card.market_price == null ? "text-muted-foreground" : ""}>
                          {fmt(card.market_price)}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {card.market_price != null
                        ? fmt(card.market_price * card.quantity)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {card.tcgplayer_url ? (
                        <a
                          href={card.tcgplayer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                          title="View on TCGPlayer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 inline" />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => handleDeleteOne(card)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td colSpan={5} className="px-3 py-2 text-sm text-muted-foreground">
                    {cards.length} cards
                  </td>
                  <td className="px-3 py-2 text-right font-semibold font-mono">
                    {fmt(totalValue)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {/* Price Movers */}
      {movers.length > 0 && (
        <div className="flex flex-col gap-3 mt-2">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-base font-semibold">
              Price Alerts ({movers.length} cards moved)
            </h2>
            <button
              onClick={() => setMovers([])}
              className="text-xs text-muted-foreground hover:text-foreground ml-auto"
            >
              Dismiss
            </button>
          </div>

          {/* Mobile movers cards */}
          <div className="sm:hidden rounded-lg border divide-y">
            {movers.map((m, i) => (
              <div
                key={i}
                className={`px-3 py-2.5 flex items-center justify-between gap-3 ${
                  m.change > 0 ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.number && (
                    <p className="text-xs text-muted-foreground">#{m.number}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`font-mono font-semibold text-sm ${
                      m.change > 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {m.change > 0 ? "+" : ""}
                    {fmt(m.change)}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {fmt(m.oldPrice)} → {fmt(m.newPrice)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop movers table */}
          <div className="hidden sm:block rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-9 px-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="h-9 px-3 text-left font-medium text-muted-foreground w-28">Number</th>
                  <th className="h-9 px-3 text-right font-medium text-muted-foreground w-24">Old Price</th>
                  <th className="h-9 px-3 text-right font-medium text-muted-foreground w-24">New Price</th>
                  <th className="h-9 px-3 text-right font-medium text-muted-foreground w-24">Change</th>
                </tr>
              </thead>
              <tbody>
                {movers.map((m, i) => (
                  <tr
                    key={i}
                    className={`border-b last:border-0 ${
                      m.change > 0 ? "bg-green-50" : "bg-red-50"
                    }`}
                  >
                    <td className="px-3 py-1.5">{m.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{m.number || "—"}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(m.oldPrice)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(m.newPrice)}</td>
                    <td
                      className={`px-3 py-1.5 text-right font-mono font-semibold ${
                        m.change > 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {m.change > 0 ? "+" : ""}
                      {fmt(m.change)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              Min price ($):
              <input
                type="number"
                min="0"
                step="1"
                value={moversMinPrice}
                onChange={(e) => setMoversMinPrice(Math.max(0, Number(e.target.value)))}
                className="w-20 h-8 rounded-md border border-input px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch("/api/export/movers", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ movers, minPrice: moversMinPrice }),
                  });
                  if (!res.ok) throw new Error();
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "price_movers.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast.error("Export failed");
                }
              }}
            >
              <Download className="h-4 w-4" />
              Download price_movers.xlsx
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
