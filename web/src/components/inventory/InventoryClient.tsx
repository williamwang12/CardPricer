"use client";

import { useState, useCallback, useTransition, useEffect } from "react";
import { toast } from "sonner";
import {
  ExternalLink,
  Trash2,
  X,
  LayoutGrid,
  Rows3,
  ImageOff,
  Download,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  updateCardAction,
  deleteCardsAction,
  savePriceAction,
  saveCostBasisAction,
  setCardConditionAction,
  deleteAllAction,
} from "@/actions/cards";
import { useCurrency } from "@/components/currency-context";
import CardDetailModal from "@/components/catalog/CardDetailModal";
import type { CardDetailInfo } from "@/components/catalog/CardDetailModal";
import type { Card } from "@/lib/types";
import {
  CONDITIONS,
  DEFAULT_CONDITION,
  conditionShort,
  conditionMultiplier,
} from "@/lib/trade";

interface CardImageInfo {
  image_url: string | null;
  setName: string;
  product_id: number | null;
}

interface Props {
  initialCards: Card[];
  cardImages: Record<number, CardImageInfo>;
  /** Condition-adjusted unit prices for non-NM cards, keyed by card id. */
  conditionedPrices?: Record<number, { price: number; source: string }>;
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

export default function InventoryClient({
  initialCards,
  cardImages,
  conditionedPrices = {},
}: Props) {
  const { fmt } = useCurrency();
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [condPrices, setCondPrices] =
    useState<Record<number, { price: number; source: string }>>(
      conditionedPrices
    );
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [view, setView] = useState<"table" | "grid">("table");
  const [detailCard, setDetailCard] = useState<CardDetailInfo | null>(null);
  const [, startTransition] = useTransition();

  // Keep cards in sync when server re-renders pass new initialCards
  useEffect(() => {
    setCards(initialCards);
  }, [initialCards]);
  useEffect(() => {
    setCondPrices(conditionedPrices);
  }, [conditionedPrices]);

  // Condition-adjusted unit price. Manual-price and Near Mint cards keep their
  // market price; other conditions use the cached listings price (or a flat
  // multiplier fallback). This is contained to Inventory — it does not change
  // market_price, so dashboard/snapshots are unaffected.
  const unitPrice = useCallback(
    (card: Card): number | null => {
      const cond = card.condition ?? DEFAULT_CONDITION;
      if (card.market_price == null) return null;
      if (card.manual_price || cond === DEFAULT_CONDITION) {
        return card.market_price;
      }
      const cached = condPrices[card.id];
      if (cached) return cached.price;
      return Math.round(card.market_price * conditionMultiplier(cond) * 100) / 100;
    },
    [condPrices]
  );

  const totalValue = cards.reduce(
    (sum, c) => sum + (unitPrice(c) ?? 0) * c.quantity,
    0
  );
  const pricedCount = cards.filter((c) => c.market_price != null).length;

  const totalCost = cards.reduce(
    (sum, c) => sum + (c.cost_basis != null ? c.cost_basis * c.quantity : 0),
    0
  );
  const totalPL = cards.reduce((sum, c) => {
    const up = unitPrice(c);
    if (up != null && c.cost_basis != null) {
      return sum + (up - c.cost_basis) * c.quantity;
    }
    return sum;
  }, 0);
  const hasCostData = cards.some((c) => c.cost_basis != null);

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

  // Set a card's condition, then fetch its condition-adjusted price on demand.
  const handleConditionChange = useCallback(
    (card: Card, condition: string) => {
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, condition } : c))
      );
      startTransition(async () => {
        try {
          const res = await setCardConditionAction(card.id, condition);
          if (res.price != null) {
            const price = res.price;
            setCondPrices((prev) => ({
              ...prev,
              [card.id]: { price, source: res.source },
            }));
          }
          if (res.limited) {
            toast(
              "Daily price-lookup limit reached (10/day) — showing an estimate. The real price updates overnight."
            );
          }
        } catch {
          toast.error("Failed to save condition");
        }
      });
    },
    []
  );

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

  // ── Card detail popup ────────────────────────────────────────────────────
  const openCardDetail = useCallback(
    (card: Card) => {
      const info = cardImages[card.id];
      if (!info?.product_id) return; // can't show detail without catalog match
      setDetailCard({
        product_id: info.product_id,
        clean_name: card.name,
        number: card.number || null,
        group_name: info.setName,
        image_url: info.image_url,
        url: card.tcgplayer_url,
        market_price: card.market_price,
      });
    },
    [cardImages]
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
        {/* Title + stats + export */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-semibold">Inventory</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap items-baseline gap-x-2">
            <span>{cards.length} cards · {pricedCount} priced</span>
            <span className="font-medium text-foreground">Total: {fmt(totalValue)}</span>
            {hasCostData && (
              <>
                <span className="text-muted-foreground">Cost: {fmt(totalCost)}</span>
                <span className={`font-medium ${totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>
                  P/L: {totalPL >= 0 ? "+" : ""}{fmt(totalPL)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="outline" asChild>
            <Link href="/import">
              <Upload className="h-4 w-4" />
              Update Inventory
            </Link>
          </Button>
          <Button asChild>
            <Link href="/export">
              <Download className="h-4 w-4" />
              Export Labels
            </Link>
          </Button>
        </div>
        </div>
        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setView("table")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                view === "table"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Table view"
            >
              <Rows3 className="h-4 w-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setView("grid")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                view === "grid"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title="Card view"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
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
            variant="ghost"
            size="sm"
            onClick={handleDeleteAll}
            className="text-destructive hover:text-destructive"
          >
            Clear All
          </Button>
        </div>
      </div>

      {/* Table */}
      {cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <p className="font-heading text-lg font-semibold text-foreground">No cards yet</p>
          <p className="text-sm text-muted-foreground">
            Import a CSV from Collectr, TCGPlayer, or DeckTradr to get started.
          </p>
          <a
            href="/import"
            className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Import cards
          </a>
        </div>
      ) : view === "grid" ? (
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          }}
        >
          {cards.map((card) => {
            const info = cardImages[card.id];
            const up = unitPrice(card);
            const cond = card.condition ?? DEFAULT_CONDITION;
            const totalCardValue = up != null ? up * card.quantity : null;
            return (
              <div
                key={card.id}
                onClick={() => openCardDetail(card)}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer"
              >
                <div className="relative aspect-[63/88] w-full overflow-hidden bg-muted">
                  {info?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={info.image_url}
                      alt={card.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 p-3 text-center">
                      <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                      <span className="text-[11px] leading-tight text-muted-foreground/70">
                        Not synced yet
                      </span>
                    </div>
                  )}
                  {card.quantity > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded-full bg-black/70 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                      ×{card.quantity}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteOne(card); }}
                    className="absolute left-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-destructive group-hover:opacity-100"
                    title="Delete"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex flex-1 flex-col gap-0.5 p-2">
                  <p
                    className="line-clamp-2 text-xs font-medium leading-snug"
                    title={card.name}
                  >
                    {card.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {info?.setName ?? "Unsynced"}
                    {card.number ? ` · #${card.number}` : ""}
                  </p>
                  <div className="mt-auto flex items-baseline justify-between pt-1">
                    <span className="font-mono text-sm font-semibold">
                      {up != null ? fmt(up) : "—"}
                      {cond !== DEFAULT_CONDITION && (
                        <span className="ml-1 font-sans text-[10px] font-normal text-muted-foreground">
                          {conditionShort(cond)}
                        </span>
                      )}
                    </span>
                    {totalCardValue != null && card.quantity > 1 && (
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {fmt(totalCardValue)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
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
                        <>
                          {fmt(unitPrice(card) ?? card.market_price)}
                          {(card.condition ?? DEFAULT_CONDITION) !==
                            DEFAULT_CONDITION && (
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              {conditionShort(
                                card.condition ?? DEFAULT_CONDITION
                              )}
                            </span>
                          )}
                        </>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                  {card.market_price != null && card.quantity > 1 && (
                    <span className="text-muted-foreground font-mono text-xs">
                      total{" "}
                      {fmt((unitPrice(card) ?? card.market_price) * card.quantity)}
                    </span>
                  )}
                  {!card.manual_price && (
                    <select
                      value={card.condition ?? DEFAULT_CONDITION}
                      onChange={(e) =>
                        handleConditionChange(card, e.target.value)
                      }
                      className="h-6 rounded border border-border bg-transparent px-1 text-xs"
                      aria-label="Condition"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value}>
                          {c.short}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="text-muted-foreground">
                    Cost:{" "}
                    <EditableCell
                      value={card.cost_basis != null ? String(card.cost_basis) : ""}
                      onSave={(v) => {
                        const p = parseFloat(v);
                        const cost = v === "" ? null : isNaN(p) ? null : Math.round(p * 100) / 100;
                        setCards((prev) =>
                          prev.map((c) =>
                            c.id === card.id ? { ...c, cost_basis: cost } : c
                          )
                        );
                        saveCostBasisAction(card.id, cost);
                      }}
                      type="number"
                      className="inline w-16"
                    />
                  </span>
                  {card.market_price != null && card.cost_basis != null && (() => {
                    const pl = (card.market_price - card.cost_basis) * card.quantity;
                    return (
                      <span className={`font-mono text-xs font-medium ${pl >= 0 ? "text-green-600" : "text-red-600"}`}>
                        P/L: {pl >= 0 ? "+" : ""}{fmt(pl)}
                      </span>
                    );
                  })()}
                  {card.tcgplayer_url && (
                    <a
                      href={card.tcgplayer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80"
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
                  <th className="h-10 px-3 text-left font-medium text-muted-foreground w-24">
                    Condition
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    Price
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    Cost
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    Total
                  </th>
                  <th className="h-10 px-3 text-right font-medium text-muted-foreground w-24">
                    P/L
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
                    onClick={() => openCardDetail(card)}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                  >
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(card.id)}
                        onCheckedChange={() => toggleOne(card.id)}
                        aria-label={`Select ${card.name}`}
                      />
                    </td>
                    <td className="px-3 py-2 max-w-xs" onClick={(e) => e.stopPropagation()}>
                      <EditableCell
                        value={card.name}
                        onSave={(v) => handleUpdate(card, "name", v)}
                      />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <EditableCell
                        value={card.number}
                        onSave={(v) => handleUpdate(card, "number", v)}
                      />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <EditableCell
                        value={String(card.quantity)}
                        onSave={(v) => handleUpdate(card, "quantity", v)}
                        type="number"
                        className="w-12"
                      />
                    </td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={card.manual_price}
                        onCheckedChange={(c) =>
                          handleManualToggle(card, c === true)
                        }
                        aria-label="Manual price"
                      />
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      {card.manual_price ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <select
                          value={card.condition ?? DEFAULT_CONDITION}
                          onChange={(e) =>
                            handleConditionChange(card, e.target.value)
                          }
                          className="h-7 rounded border border-border bg-transparent px-1 text-xs"
                          aria-label="Condition"
                        >
                          {CONDITIONS.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.short}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" onClick={(e) => e.stopPropagation()}>
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
                          {fmt(unitPrice(card))}
                          {card.market_price != null &&
                            (card.condition ?? DEFAULT_CONDITION) !==
                              DEFAULT_CONDITION && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                {conditionShort(
                                  card.condition ?? DEFAULT_CONDITION
                                )}
                              </span>
                            )}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono" onClick={(e) => e.stopPropagation()}>
                      <EditableCell
                        value={card.cost_basis != null ? String(card.cost_basis) : ""}
                        onSave={(v) => {
                          const p = parseFloat(v);
                          const cost = v === "" ? null : isNaN(p) ? null : Math.round(p * 100) / 100;
                          setCards((prev) =>
                            prev.map((c) =>
                              c.id === card.id ? { ...c, cost_basis: cost } : c
                            )
                          );
                          saveCostBasisAction(card.id, cost);
                        }}
                        type="number"
                        className="text-right w-20"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {card.market_price != null
                        ? fmt((unitPrice(card) ?? card.market_price) * card.quantity)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {card.market_price != null && card.cost_basis != null ? (() => {
                        const pl = ((unitPrice(card) ?? card.market_price) - card.cost_basis) * card.quantity;
                        return (
                          <span className={`font-medium ${pl >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {pl >= 0 ? "+" : ""}{fmt(pl)}
                          </span>
                        );
                      })() : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                      {card.tcgplayer_url ? (
                        <a
                          href={card.tcgplayer_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80"
                          title="View on TCGPlayer"
                        >
                          <ExternalLink className="h-3.5 w-3.5 inline" />
                        </a>
                      ) : null}
                    </td>
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
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
                  <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                    {hasCostData ? fmt(totalCost) : ""}
                  </td>
                  <td />
                  <td className="px-3 py-2 text-right font-mono">
                    {hasCostData ? (
                      <span className={`font-semibold ${totalPL >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {totalPL >= 0 ? "+" : ""}{fmt(totalPL)}
                      </span>
                    ) : ""}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}
    </div>
  );
}
