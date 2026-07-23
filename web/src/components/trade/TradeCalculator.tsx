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
  Check,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { useCurrency } from "@/components/currency-context";
import { searchCardsAction, getAllSetsAction } from "@/actions/catalog";
import { signInWithGoogle } from "@/actions/auth";
import { parseCatalogQuery } from "@/lib/catalog-search";
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
import type { CatalogCardSearchResult, CatalogSet } from "@/lib/db/catalog";

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
const DEFAULT_RATE = "80";

function scoreColor(score: number): string {
  if (score >= 0.66) return "bg-emerald-500";
  if (score >= 0.4) return "bg-amber-500";
  return "bg-red-500";
}

function SidePanel({
  label,
  hint,
  side,
  setSide,
  accent,
  sets,
}: {
  label: string;
  hint: string;
  side: SideState;
  setSide: (updater: (s: SideState) => SideState) => void;
  accent: string;
  sets: CatalogSet[];
}) {
  const { fmt } = useCurrency();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogCardSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const debounced = useDebounce(query, 300);

  useEffect(() => {
    const q = debounced.trim();
    if (q.length < 2) return;
    // Smart parse — "Charizard 151" narrows to the set, "Pikachu 58" filters by
    // card number, same as the Catalog search.
    const { namePart, matchedSet, numberPart } = parseCatalogQuery(q, sets);
    if (namePart.trim().length < 2) return;
    let cancelled = false;
    searchCardsAction(namePart, matchedSet?.group_id, numberPart ?? undefined)
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
  }, [debounced, sets]);

  const searching = query.trim().length >= 2 && query !== debounced;
  const showResults = open && query.trim().length >= 2 && results.length > 0;

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
        <div className="min-w-0">
          <h2 className="font-heading font-semibold leading-tight">{label}</h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
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
  atRate,
}: {
  label: string;
  side: TradeSideResult;
  atRate?: number; // trade-rate value of the cards, if this is the intake side
}) {
  const { fmt } = useCurrency();
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-sm font-medium mb-2">{label}</p>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <dt>Cards (market)</dt>
          <dd>{fmt(side.cardsValue)}</dd>
        </div>
        {atRate != null && (
          <div className="flex justify-between text-muted-foreground">
            <dt>Cards (at rate)</dt>
            <dd>{fmt(atRate)}</dd>
          </div>
        )}
        <div className="flex justify-between text-muted-foreground">
          <dt>Cash</dt>
          <dd>{fmt(side.cash)}</dd>
        </div>
        <div className="flex justify-between font-semibold pt-1 border-t border-border">
          <dt>{atRate != null ? "Value to you" : "Total"}</dt>
          <dd>{fmt(atRate != null ? atRate + side.cash : side.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Decision({ result }: { result: TradeResult }) {
  const { fmt } = useCurrency();
  const { shouldDo, margin, tradeRate, effectiveRate } = result;
  const ratePct = Math.round(tradeRate * 100);
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <div
        className={`flex items-center gap-2 text-2xl font-heading font-bold ${
          shouldDo ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {shouldDo ? (
          <Check className="h-6 w-6" />
        ) : (
          <Ban className="h-6 w-6" />
        )}
        {shouldDo ? "Take the trade" : "Pass on this trade"}
      </div>
      <p className="text-sm text-muted-foreground">
        At a {ratePct}% trade rate, you{" "}
        {shouldDo ? "come out ahead by " : "would overpay by "}
        <span
          className={`font-semibold ${
            shouldDo ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {fmt(Math.abs(margin))}
        </span>
        .
      </p>
      {effectiveRate != null && (
        <p className="text-sm text-muted-foreground">
          You&apos;d be paying{" "}
          <span className="font-medium text-foreground">
            {Math.round(effectiveRate * 100)}%
          </span>{" "}
          of market on their cards (your target is {ratePct}%).
        </p>
      )}
      {result.get.cardsValue > 0 &&
        (() => {
          const tier = liquidityTier(result.get.weightedLiquidity);
          const text =
            tier === "liquid"
              ? "The cards you'd take in sell readily — easy to move."
              : tier === "moderate"
              ? "The cards you'd take in have moderate liquidity — expect some time to resell."
              : "Heads up: the cards you'd take in are slow movers, so even at this margin they may sit in your case — factor in resale risk.";
          return (
            <p
              className={`text-sm ${
                tier === "illiquid" ? "text-amber-600" : "text-muted-foreground"
              }`}
            >
              {text}
            </p>
          );
        })()}
    </div>
  );
}

export default function TradeCalculator() {
  const [give, setGive] = useState<SideState>(emptySide);
  const [get, setGet] = useState<SideState>(emptySide);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [response, setResponse] = useState<TradeResponse | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [sets, setSets] = useState<CatalogSet[]>([]);

  // Loaded once so the search can parse "<card> <set>" / "<card> <number>".
  useEffect(() => {
    let cancelled = false;
    getAllSetsAction()
      .then((s) => {
        if (!cancelled) setSets(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const canCalculate =
    give.items.length + (parseFloat(give.cash || "0") || 0) > 0 &&
    get.items.length + (parseFloat(get.cash || "0") || 0) > 0;

  const calculate = async () => {
    setCalculating(true);
    setResponse(null);
    try {
      const res = await calculateTradeAction({
        vendorGives: {
          items: give.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            condition: i.condition,
          })),
          cash: parseFloat(give.cash) || 0,
        },
        customerGives: {
          items: get.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            condition: i.condition,
          })),
          cash: parseFloat(get.cash) || 0,
        },
        tradeRate: (parseFloat(rate) || 0) / 100,
      });
      setResponse(res);
    } catch {
      setResponse({ ok: false, reason: "error" });
    } finally {
      setCalculating(false);
    }
  };

  const reset = () => {
    setGive(emptySide());
    setGet(emptySide());
    setResponse(null);
  };

  const result = response?.ok ? response.result : null;
  const allItems = result ? [...result.give.items, ...result.get.items] : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Scale className="h-5 w-5 text-primary" />
        <h1 className="font-heading text-xl font-semibold">Trade Calculator</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Tells you whether to take a trade at your buy rate: their cards count at
        the trade rate (condition-adjusted), your cards and everyone&apos;s cash
        count at full value.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <SidePanel
          label="You give"
          hint="Your cards + cash (valued at market)"
          side={give}
          setSide={setGive}
          accent="bg-blue-500"
          sets={sets}
        />
        <SidePanel
          label="You get"
          hint="Their cards (at your rate) + cash"
          side={get}
          setSide={setGet}
          accent="bg-purple-500"
          sets={sets}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Trade rate</span>
          <div className="relative w-20">
            <Input
              type="number"
              min={1}
              max={100}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="pr-6"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              %
            </span>
          </div>
        </label>
        <Button onClick={calculate} disabled={!canCalculate || calculating}>
          {calculating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking sales volume…
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-4 w-4" />
              Evaluate trade
            </>
          )}
        </Button>
        {(response || give.items.length > 0 || get.items.length > 0) && (
          <Button variant="ghost" onClick={reset} disabled={calculating}>
            Reset
          </Button>
        )}
        {response?.ok && (
          <span className="text-sm text-muted-foreground">
            {response.usage.limit - response.usage.used} of{" "}
            {response.usage.limit} left today
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
            You&apos;ve used all {response.limit} trade evaluations for today.
            Check back tomorrow.
          </p>
        </div>
      )}

      {/* Error */}
      {response && !response.ok && response.reason === "error" && (
        <p className="text-sm text-red-500">
          Could not evaluate the trade. Please try again.
        </p>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-xl border p-5 flex flex-col gap-4 ${
            result.shouldDo
              ? "border-emerald-500/40 bg-emerald-500/5"
              : "border-red-500/40 bg-red-500/5"
          }`}
        >
          <Decision result={result} />

          <div className="grid gap-3 sm:grid-cols-2">
            <SideTotals label="You give" side={result.give} />
            <SideTotals
              label="You get"
              side={result.get}
              atRate={result.tradeRate * result.get.cardsValue}
            />
          </div>

          {/* Per-card liquidity + the sales sample behind it */}
          {allItems.length > 0 && (
            <div className="pt-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Liquidity &amp; recent sales
              </p>
              <div className="rounded-lg border border-border divide-y divide-border/60">
                {allItems.map((i, idx) => (
                  <div
                    key={`${i.productId}-${idx}`}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
                  >
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${scoreColor(
                        i.score
                      )}`}
                    />
                    <span className="truncate flex-1 min-w-0">
                      {i.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {conditionShort(i.condition)}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground text-right flex-shrink-0">
                      {i.source === "sales" && i.salesPerDay != null ? (
                        <>
                          {i.salesPerDay.toFixed(1)}/day · {i.totalQuantity} sold
                          in {i.windowDays?.toFixed(1)}d
                        </>
                      ) : (
                        <>no recent sales · est.</>
                      )}
                    </span>
                    <span className="w-11 text-right font-medium flex-shrink-0">
                      {Math.round(i.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Liquidity = recent TCGplayer sales velocity — a check on whether
                you can actually move the cards you take in.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
