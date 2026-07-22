"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Plus,
  X,
  Loader2,
  ArrowLeftRight,
  Scale,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useCurrency } from "@/components/currency-context";
import { searchCardsAction } from "@/actions/catalog";
import { signInWithGoogle } from "@/actions/auth";
import {
  calculateTradeAction,
  type TradeResponse,
  type TradeResult,
  type TradeSideResult,
} from "@/actions/trade";
import {
  CONDITIONS,
  DEFAULT_CONDITION,
  conditionMultiplier,
  conditionShort,
  liquidityTier,
  type Condition,
} from "@/lib/trade";
import type { CatalogCardSearchResult } from "@/lib/db/catalog";

interface SideItem {
  productId: number;
  name: string;
  number: string | null;
  imageUrl: string | null;
  marketPrice: number;
  condition: Condition;
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

function tierLabel(score: number): string {
  const t = liquidityTier(score);
  return t === "liquid" ? "Liquid" : t === "moderate" ? "Moderate" : "Illiquid";
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
              condition: DEFAULT_CONDITION,
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

  const setCondition = (productId: number, condition: Condition) =>
    setSide((s) => ({
      ...s,
      items: s.items.map((i) =>
        i.productId === productId ? { ...i, condition } : i
      ),
    }));

  const removeCard = (productId: number) =>
    setSide((s) => ({
      ...s,
      items: s.items.filter((i) => i.productId !== productId),
    }));

  const cardsTotal = side.items.reduce(
    (sum, i) =>
      sum + i.marketPrice * conditionMultiplier(i.condition) * i.quantity,
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
                {fmt(i.marketPrice * conditionMultiplier(i.condition))} ea
              </p>
            </div>
            <select
              value={i.condition}
              onChange={(e) =>
                setCondition(i.productId, e.target.value as Condition)
              }
              className="h-7 rounded border border-border bg-transparent px-1 text-xs flex-shrink-0"
              aria-label="Condition"
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.short}
                </option>
              ))}
            </select>
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
            onChange={(e) => setSide((s) => ({ ...s, cash: e.target.value }))}
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
          <dd>{fmt(side.cardsValue)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>Cash</dt>
          <dd>{fmt(side.cash)}</dd>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t border-border">
          <dt>Total</dt>
          <dd>{fmt(side.total)}</dd>
        </div>
        {side.items.length > 0 && (
          <div className="flex justify-between text-xs text-muted-foreground pt-0.5">
            <dt>Card liquidity</dt>
            <dd className="flex items-center gap-1">
              <span
                className={`h-2 w-2 rounded-full ${scoreColor(
                  side.weightedLiquidity
                )}`}
              />
              {tierLabel(side.weightedLiquidity)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

function Verdict({ result }: { result: TradeResult }) {
  const { fmt } = useCurrency();
  const { winner, winPct, valueDiff, sideA, sideB } = result;

  let headline: string;
  let note: string;

  if (winner === "even") {
    headline = "This looks like an even trade.";
    const minLiq = Math.min(sideA.weightedLiquidity, sideB.weightedLiquidity);
    note =
      minLiq >= 0.66
        ? "Both sides' cards move quickly, so it's a clean swap."
        : "Values line up, but check the liquidity flags — some cards may be slower to move.";
  } else {
    // The winner receives the other side's cards.
    const receivedLiq =
      winner === "A" ? sideB.weightedLiquidity : sideA.weightedLiquidity;
    const tier = liquidityTier(receivedLiq);
    headline = `Side ${winner} comes out ahead by ${winPct.toFixed(
      1
    )}% (${fmt(valueDiff)}) on market value.`;
    note =
      tier === "illiquid"
        ? `But much of what Side ${winner} receives is in slow-moving cards, so that edge may be hard to cash out — weigh whether you can actually move them before accepting.`
        : tier === "moderate"
        ? `The cards Side ${winner} receives have moderate liquidity, so realizing the full value may take some time.`
        : `And the cards Side ${winner} receives sell readily, so the advantage is real and easy to realize.`;
  }

  return (
    <div className="text-center">
      <p className="text-lg font-heading font-semibold">
        {winner === "even" ? (
          headline
        ) : (
          <>
            <span
              className={
                winner === "A" ? "text-blue-600" : "text-purple-600"
              }
            >
              Side {winner}
            </span>{" "}
            comes out ahead by {winPct.toFixed(1)}% ({fmt(valueDiff)})
          </>
        )}
      </p>
      <p className="text-sm text-muted-foreground mt-1">{note}</p>
    </div>
  );
}

export default function TradeCalculator() {
  const { fmt } = useCurrency();
  const [sideA, setSideA] = useState<SideState>(emptySide);
  const [sideB, setSideB] = useState<SideState>(emptySide);
  const [response, setResponse] = useState<TradeResponse | null>(null);
  const [calculating, setCalculating] = useState(false);

  const canCalculate =
    sideA.items.length + (parseFloat(sideA.cash || "0") || 0) > 0 &&
    sideB.items.length + (parseFloat(sideB.cash || "0") || 0) > 0;

  const calculate = async () => {
    setCalculating(true);
    setResponse(null);
    try {
      const res = await calculateTradeAction({
        sideA: {
          items: sideA.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            condition: i.condition,
          })),
          cash: parseFloat(sideA.cash) || 0,
        },
        sideB: {
          items: sideB.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            condition: i.condition,
          })),
          cash: parseFloat(sideB.cash) || 0,
        },
      });
      setResponse(res);
    } catch {
      setResponse({ ok: false, reason: "error" });
    } finally {
      setCalculating(false);
    }
  };

  const reset = () => {
    setSideA(emptySide());
    setSideB(emptySide());
    setResponse(null);
  };

  const result = response?.ok ? response.result : null;
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
        Compares both sides on market value (adjusted for each card&apos;s
        condition), then flags how liquid the cards are so you know whether that
        value is easy to realize.
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
        {(response || sideA.items.length > 0 || sideB.items.length > 0) && (
          <Button variant="ghost" onClick={reset} disabled={calculating}>
            Reset
          </Button>
        )}
        {response?.ok && (
          <span className="text-sm text-muted-foreground">
            {response.usage.limit - response.usage.used} of{" "}
            {response.usage.limit} calculations left today
          </span>
        )}
      </div>

      {/* Guest gate */}
      {response && !response.ok && response.reason === "guest" && (
        <div className="rounded-xl border border-border bg-card p-6 text-center flex flex-col items-center gap-3">
          <Lock className="h-6 w-6 text-muted-foreground" />
          <div>
            <p className="font-heading font-semibold">
              Sign up to use the Trade Calculator
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a free account to run trade calculations.
            </p>
          </div>
          <form action={signInWithGoogle}>
            <Button type="submit">Sign up with Google</Button>
          </form>
        </div>
      )}

      {/* Rate limit */}
      {response && !response.ok && response.reason === "limit" && (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-heading font-semibold">Daily limit reached</p>
          <p className="text-sm text-muted-foreground mt-1">
            You&apos;ve used all {response.limit} trade calculations for today.
            Check back tomorrow.
          </p>
        </div>
      )}

      {/* Error */}
      {response && !response.ok && response.reason === "error" && (
        <p className="text-sm text-red-500">
          Could not calculate the trade. Please try again.
        </p>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <Verdict result={result} />

          {/* Fairness meter */}
          <div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="bg-blue-500"
                style={{
                  width: `${
                    (result.sideA.total /
                      (result.sideA.total + result.sideB.total || 1)) *
                    100
                  }%`,
                }}
              />
              <div
                className="bg-purple-500"
                style={{
                  width: `${
                    (result.sideB.total /
                      (result.sideA.total + result.sideB.total || 1)) *
                    100
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>A · {fmt(result.sideA.total)}</span>
              <span>B · {fmt(result.sideB.total)}</span>
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

          {/* Per-card liquidity */}
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
                      {conditionShort(i.condition)} · {Math.round(i.score * 100)}
                      %{i.source === "proxy" ? " est." : ""}
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
