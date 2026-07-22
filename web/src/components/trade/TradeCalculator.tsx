"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  ArrowLeftRight,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useCurrency } from "@/components/currency-context";
import { searchCardsAction } from "@/actions/catalog";
import {
  calculateTradeAction,
  type TradeResult,
  type TradeSideResult,
} from "@/actions/trade";
import type { CatalogCardSearchResult } from "@/lib/db/catalog";

interface SideItem {
  productId: number;
  name: string;
  number: string | null;
  imageUrl: string | null;
  marketPrice: number;
  quantity: number;
}
interface SideState {
  items: SideItem[];
  cash: string;
}

const emptySide = (): SideState => ({ items: [], cash: "" });

function scoreColor(score: number): string {
  if (score >= 0.66) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

function SidePanel({
  label,
  side,
  setSide,
  accent,
}: {
  label: string;
  side: SideState;
  setSide: (updater: (s: SideState) => SideState) => void;
  accent: string;
}) {
  const { fmt } = useCurrency();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCardSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) return;
    let cancelled = false;
    // setState only in the async callback (never synchronously in the effect
    // body) so search results stay in sync without cascading renders.
    searchCardsAction(q)
      .then((r) => {
        if (!cancelled) {
          setResults(r.slice(0, 12));
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  // A search is pending while the debounced query is catching up to the input.
  const searching = query.trim().length >= 2 && query !== debounced;
  const showResults =
    open && query.trim().length >= 2 && results.length > 0;

  const addCard = useCallback(
    (c: CatalogCardSearchResult) => {
      setSide((s) => {
        const existing = s.items.find((i) => i.productId === c.product_id);
        if (existing) {
          return {
            ...s,
            items: s.items.map((i) =>
              i.productId === c.product_id
                ? { ...i, quantity: i.quantity + 1 }
                : i
            ),
          };
        }
        return {
          ...s,
          items: [
            ...s.items,
            {
              productId: c.product_id,
              name: c.clean_name,
              number: c.number,
              imageUrl: c.image_url,
              marketPrice: c.market_price ?? 0,
              quantity: 1,
            },
          ],
        };
      });
      setQuery("");
      setResults([]);
      setOpen(false);
    },
    [setSide]
  );

  const setQty = (productId: number, qty: number) =>
    setSide((s) => ({
      ...s,
      items: s.items
        .map((i) => (i.productId === productId ? { ...i, quantity: qty } : i))
        .filter((i) => i.quantity > 0),
    }));

  const removeCard = (productId: number) =>
    setSide((s) => ({
      ...s,
      items: s.items.filter((i) => i.productId !== productId),
    }));

  const cardsTotal = side.items.reduce(
    (sum, i) => sum + i.marketPrice * i.quantity,
    0
  );
  const cash = parseFloat(side.cash) || 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent}`} />
        <h2 className="font-heading font-semibold">{label}</h2>
        <span className="ml-auto text-sm text-muted-foreground">
          {fmt(cardsTotal + cash)}
        </span>
      </div>

      {/* Search */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder="Search cards to add…"
            className="pl-8"
          />
          {searching && (
            <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        {showResults && (
          <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-lg border border-border bg-popover shadow-lg">
            {results.map((c) => (
              <button
                key={c.product_id}
                onClick={() => addCard(c)}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left hover:bg-muted transition-colors"
              >
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt=""
                    className="h-9 w-9 rounded object-contain flex-shrink-0"
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-muted flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.clean_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.group_name}
                    {c.number ? ` · #${c.number}` : ""}
                  </p>
                </div>
                <span className="text-sm text-muted-foreground flex-shrink-0">
                  {c.market_price != null ? fmt(c.market_price) : "—"}
                </span>
                <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="flex flex-col gap-1.5">
        {side.items.length === 0 && (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No cards yet
          </p>
        )}
        {side.items.map((i) => (
          <div
            key={i.productId}
            className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted-foreground">
                {fmt(i.marketPrice)} ea
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setQty(i.productId, i.quantity - 1)}
                className="h-6 w-6 rounded border border-border text-muted-foreground hover:bg-muted"
                aria-label="Decrease"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                value={i.quantity}
                onChange={(e) =>
                  setQty(i.productId, Math.max(1, parseInt(e.target.value) || 1))
                }
                className="h-6 w-10 rounded border border-border bg-transparent text-center text-sm"
              />
              <button
                onClick={() => setQty(i.productId, i.quantity + 1)}
                className="h-6 w-6 rounded border border-border text-muted-foreground hover:bg-muted"
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <button
              onClick={() => removeCard(i.productId)}
              className="h-6 w-6 rounded text-muted-foreground hover:bg-muted flex items-center justify-center flex-shrink-0"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Cash */}
      <div className="flex items-center gap-2 pt-1">
        <label className="text-sm text-muted-foreground">Cash</label>
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input
            type="number"
            min={0}
            value={side.cash}
            onChange={(e) =>
              setSide((s) => ({ ...s, cash: e.target.value }))
            }
            placeholder="0"
            className="pl-6"
          />
        </div>
      </div>
    </div>
  );
}

function SideTotals({
  label,
  side,
  highlight,
}: {
  label: string;
  side: TradeSideResult;
  highlight: boolean;
}) {
  const { fmt } = useCurrency();
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-primary bg-primary/5" : "border-border"
      }`}
    >
      <p className="text-sm font-medium mb-2">{label}</p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Cards (market)</dt>
          <dd>{fmt(side.cardsMarket)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Cards (liquidity-adj.)</dt>
          <dd>{fmt(side.cardsEffective)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Cash</dt>
          <dd>{fmt(side.cash)}</dd>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t border-border">
          <dt>Effective total</dt>
          <dd>{fmt(side.totalEffective)}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function TradeCalculator() {
  const { fmt } = useCurrency();
  const [sideA, setSideA] = useState<SideState>(emptySide);
  const [sideB, setSideB] = useState<SideState>(emptySide);
  const [result, setResult] = useState<TradeResult | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCalculate =
    sideA.items.length + parseFloat(sideA.cash || "0") > 0 &&
    sideB.items.length + parseFloat(sideB.cash || "0") > 0;

  const calculate = async () => {
    setCalculating(true);
    setError(null);
    try {
      const res = await calculateTradeAction({
        sideA: {
          items: sideA.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          cash: parseFloat(sideA.cash) || 0,
        },
        sideB: {
          items: sideB.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
          cash: parseFloat(sideB.cash) || 0,
        },
      });
      setResult(res);
    } catch {
      setError("Could not calculate the trade. Please try again.");
    } finally {
      setCalculating(false);
    }
  };

  // Result changes invalidate stale display
  const reset = () => {
    setSideA(emptySide());
    setSideB(emptySide());
    setResult(null);
    setError(null);
  };

  const allItems = result
    ? [...result.sideA.items, ...result.sideB.items]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        <h1 className="font-heading text-xl font-semibold">Trade Calculator</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Values are adjusted for each card&apos;s liquidity (how actively it
        sells) — an illiquid card counts less than its sticker price, cash
        counts fully.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <SidePanel
          label="Side A"
          side={sideA}
          setSide={setSideA}
          accent="bg-blue-500"
        />
        <SidePanel
          label="Side B"
          side={sideB}
          setSide={setSideB}
          accent="bg-purple-500"
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={calculate} disabled={!canCalculate || calculating}>
          {calculating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking sales volume…
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4" />
              Calculate
            </>
          )}
        </Button>
        {(result || sideA.items.length > 0 || sideB.items.length > 0) && (
          <Button variant="ghost" onClick={reset} disabled={calculating}>
            Reset
          </Button>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          {/* Headline */}
          <div className="text-center">
            {result.winner === "even" ? (
              <p className="text-lg font-heading font-semibold">
                Even trade — within a couple percent
              </p>
            ) : (
              <p className="text-lg font-heading font-semibold">
                <span
                  className={
                    result.winner === "A" ? "text-blue-600" : "text-purple-600"
                  }
                >
                  Side {result.winner}
                </span>{" "}
                is winning by {result.winPct.toFixed(1)}%
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-0.5">
              on liquidity-adjusted value
            </p>
          </div>

          {/* Fairness meter */}
          <div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-blue-500"
                style={{
                  width: `${
                    (result.sideA.totalEffective /
                      (result.sideA.totalEffective +
                        result.sideB.totalEffective || 1)) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-purple-500"
                style={{
                  width: `${
                    (result.sideB.totalEffective /
                      (result.sideA.totalEffective +
                        result.sideB.totalEffective || 1)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>A · {fmt(result.sideA.totalEffective)}</span>
              <span>B · {fmt(result.sideB.totalEffective)}</span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SideTotals
              label="Side A"
              side={result.sideA}
              highlight={result.winner === "A"}
            />
            <SideTotals
              label="Side B"
              side={result.sideB}
              highlight={result.winner === "B"}
            />
          </div>

          {/* Liquidity legend for the cards in the trade */}
          {allItems.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">
                Card liquidity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allItems.map((i, idx) => (
                  <span
                    key={`${i.productId}-${idx}`}
                    title={
                      i.source === "sales"
                        ? `${i.salesPerDay?.toFixed(1)} sales/day`
                        : "estimated from price stability"
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${scoreColor(i.score)}`}
                    />
                    <span className="truncate max-w-[9rem]">{i.name}</span>
                    <span className="text-muted-foreground">
                      {Math.round(i.score * 100)}%
                      {i.source === "proxy" ? " est." : ""}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
