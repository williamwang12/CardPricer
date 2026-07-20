"use client";

import type { ReactNode } from "react";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  ChevronRight,
  ChevronDown,
  Loader2,
  ArrowLeft,
  ExternalLink,
  LineChart,
  ListTree,
  Plus,
  TrendingUp,
  Landmark,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import {
  getModernSetsAction,
  getSetCardsAction,
  getCardHistoryAction,
  getSetHistoryAction,
  searchChartCardsAction,
  searchChartSetsAction,
  getMyChartableCardsAction,
  getMyInventoryHistoryAction,
  getSp500HistoryAction,
  getPokemonIndexHistoryAction,
} from "@/actions/charts";
import { useCurrency } from "@/components/currency-context";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/cn";
import type {
  CatalogSet,
  CatalogCardWithId,
  CatalogCardSearchResult,
  InventoryChartableCard,
} from "@/lib/db/catalog";
import type {
  PriceHistoryPoint,
  SetPriceHistoryPoint,
} from "@/lib/db/card-price-history";
import PriceChart from "./PriceChart";
import CompareChart, { type CompareSeries } from "./CompareChart";

type View = "sets" | "set-detail" | "card-detail";
type Tab = "compare" | "browse";

// ── Session cache helpers ───────────────────────────────────────────────────
// Caches chart data in sessionStorage so revisiting the page within the same
// browser session doesn't re-fetch everything. Each entry has a 10-minute TTL.
const CACHE_TTL_MS = 10 * 60 * 1000;

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(`charts:${key}`);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw) as { data: T; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) {
      sessionStorage.removeItem(`charts:${key}`);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(
      `charts:${key}`,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // Storage full or unavailable — non-critical.
  }
}

// Cycled through as series are added; skips colors already in use so
// distinct series stay visually distinguishable.
const SERIES_COLORS = [
  "#0e7490", // teal
  "#dc2626", // red
  "#7c3aed", // violet
  "#ea580c", // orange
  "#16a34a", // green
  "#db2777", // pink
  "#2563eb", // blue
  "#ca8a04", // amber
];

export default function ChartsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fmt } = useCurrency();

  // URL params
  const paramSetId = searchParams.get("set");
  const paramCardId = searchParams.get("card");

  const [tab, setTab] = useState<Tab>("compare");

  // ── Compare tab state ──
  const [defaultsLoading, setDefaultsLoading] = useState(true);
  const [compareSeries, setCompareSeries] = useState<CompareSeries[]>([]);
  const [compareQuery, setCompareQuery] = useState("");
  const debouncedCompareQuery = useDebounce(compareQuery, 250);
  const [compareCardResults, setCompareCardResults] = useState<
    CatalogCardSearchResult[]
  >([]);
  const [compareSetResults, setCompareSetResults] = useState<CatalogSet[]>([]);
  const [compareSearching, setCompareSearching] = useState(false);
  const [myCards, setMyCards] = useState<InventoryChartableCard[]>([]);
  const [addingSeriesKey, setAddingSeriesKey] = useState<string | null>(null);
  const [setDropdownOpen, setSetDropdownOpen] = useState(false);
  const [setDropdownQuery, setSetDropdownQuery] = useState("");
  const setDropdownRef = useRef<HTMLDivElement>(null);

  const nextColor = useCallback(() => {
    const used = new Set(compareSeries.map((s) => s.color));
    return (
      SERIES_COLORS.find((c) => !used.has(c)) ??
      SERIES_COLORS[compareSeries.length % SERIES_COLORS.length]
    );
  }, [compareSeries]);

  const isCharted = useCallback(
    (id: string) => compareSeries.some((s) => s.id === id),
    [compareSeries]
  );

  const addCompareSeries = useCallback(
    async (
      id: string,
      label: string,
      fetcher: () => Promise<{ captured_at?: string; time?: string; value?: number; total_value?: number; market_price?: number }[]>
    ) => {
      if (isCharted(id)) return;
      setAddingSeriesKey(id);
      try {
        const raw = await fetcher();
        const data = raw
          .map((r) => ({
            time: (r.captured_at ?? r.time) as string,
            value: Number(r.total_value ?? r.market_price ?? r.value ?? 0),
          }))
          .filter((d) => d.time);
        if (data.length === 0) {
          toast.error(`No price history available yet for ${label}`);
          return;
        }
        setCompareSeries((prev) => [
          ...prev,
          { id, label, color: nextColor(), data },
        ]);
      } catch {
        toast.error(`Failed to load history for ${label}`);
      } finally {
        setAddingSeriesKey(null);
      }
    },
    [isCharted, nextColor]
  );

  const removeCompareSeries = useCallback((id: string) => {
    setCompareSeries((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const addSp500 = useCallback(
    () =>
      addCompareSeries("sp500", "S&P 500", async () => {
        const points = await getSp500HistoryAction();
        return points.map((p) => ({ time: p.captured_at, value: p.value }));
      }),
    [addCompareSeries]
  );

  const addPokemonIndex = useCallback(
    () =>
      addCompareSeries("pokemon-index", "Pokémon Index", () =>
        getPokemonIndexHistoryAction()
      ),
    [addCompareSeries]
  );

  const addSetSeries = useCallback(
    (set: CatalogSet) =>
      addCompareSeries(`set-${set.group_id}`, set.group_name, () =>
        getSetHistoryAction(set.group_id)
      ),
    [addCompareSeries]
  );

  const addCardSeries = useCallback(
    (productId: number, label: string) =>
      addCompareSeries(`card-${productId}`, label, () =>
        getCardHistoryAction(productId)
      ),
    [addCompareSeries]
  );

  // Track whether we've already loaded the default series so this runs
  // exactly once, even across re-renders.
  const defaultsLoadedRef = useRef(false);

  // On mount: load inventory cards for the grid, and auto-chart S&P 500
  // + an aggregate "My Inventory" series (total portfolio value per day).
  // Uses sessionStorage cache so revisiting the page is instant.
  useEffect(() => {
    if (defaultsLoadedRef.current) return;
    defaultsLoadedRef.current = true;

    // Check for cached data first
    const cachedSeries = cacheGet<CompareSeries[]>("defaultSeries");
    const cachedCards = cacheGet<InventoryChartableCard[]>("myCards");
    if (cachedSeries && cachedSeries.length > 0) {
      setCompareSeries(cachedSeries);
      if (cachedCards) setMyCards(cachedCards);
      setDefaultsLoading(false);
      return;
    }

    (async () => {
      // Kick off all three requests in parallel
      const [cardsResult, sp500Result, inventoryHistResult] =
        await Promise.allSettled([
          getMyChartableCardsAction(),
          getSp500HistoryAction(),
          getMyInventoryHistoryAction(),
        ]);

      // Populate the card grid
      if (cardsResult.status === "fulfilled") {
        setMyCards(cardsResult.value);
        cacheSet("myCards", cardsResult.value);
      }

      // Build default chart series
      const series: CompareSeries[] = [];
      let colorIdx = 0;

      if (sp500Result.status === "fulfilled" && sp500Result.value.length > 0) {
        series.push({
          id: "sp500",
          label: "S&P 500",
          color: SERIES_COLORS[colorIdx % SERIES_COLORS.length],
          data: sp500Result.value.map((p) => ({
            time: p.captured_at,
            value: p.value,
          })),
        });
        colorIdx++;
      }

      if (
        inventoryHistResult.status === "fulfilled" &&
        inventoryHistResult.value.length > 0
      ) {
        series.push({
          id: "my-inventory",
          label: "My Inventory",
          color: SERIES_COLORS[colorIdx % SERIES_COLORS.length],
          data: inventoryHistResult.value.map((p) => ({
            time: p.captured_at,
            value: p.total_value,
          })),
        });
        colorIdx++;
      }

      if (series.length > 0) {
        setCompareSeries(series);
        cacheSet("defaultSeries", series);
      }
      setDefaultsLoading(false);
    })();
  }, []);

  // Debounced catalog search for the "add to chart" panel.
  useEffect(() => {
    const q = debouncedCompareQuery.trim();
    if (!q) {
      return;
    }
    let cancelled = false;
    // Kicking off a debounced async search is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCompareSearching(true);
    Promise.all([searchChartCardsAction(q), searchChartSetsAction(q)])
      .then(([cardRes, setRes]) => {
        if (cancelled) return;
        setCompareCardResults(cardRes);
        setCompareSetResults(setRes);
      })
      .catch(() => {
        if (!cancelled) toast.error("Search failed");
      })
      .finally(() => {
        if (!cancelled) setCompareSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCompareQuery]);

  const myCardsFiltered = useMemo(() => {
    const q = debouncedCompareQuery.trim().toLowerCase();
    if (!q) return myCards;
    return myCards.filter((c) => c.cleanName.toLowerCase().includes(q));
  }, [myCards, debouncedCompareQuery]);

  // Close set dropdown on click outside
  useEffect(() => {
    if (!setDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        setDropdownRef.current &&
        !setDropdownRef.current.contains(e.target as Node)
      ) {
        setSetDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [setDropdownOpen]);

  // ── Browse tab (existing sets/set-detail/card-detail flow) ──
  const [sets, setSets] = useState<CatalogSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [search, setSearch] = useState("");

  const setDropdownFiltered = useMemo(() => {
    const q = setDropdownQuery.trim().toLowerCase();
    if (!q) return sets;
    return sets.filter((s) => s.group_name.toLowerCase().includes(q));
  }, [sets, setDropdownQuery]);

  // Set detail
  const [selectedSet, setSelectedSet] = useState<CatalogSet | null>(null);
  const [cards, setCards] = useState<CatalogCardWithId[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [setHistory, setSetHistory] = useState<SetPriceHistoryPoint[]>([]);
  const [loadingSetHistory, setLoadingSetHistory] = useState(false);

  // Card detail
  const [selectedCard, setSelectedCard] = useState<CatalogCardWithId | null>(
    null
  );
  const [cardHistory, setCardHistory] = useState<PriceHistoryPoint[]>([]);
  const [loadingCardHistory, setLoadingCardHistory] = useState(false);

  // Determine current view
  const view: View = selectedCard
    ? "card-detail"
    : selectedSet
      ? "set-detail"
      : "sets";

  // Load sets on mount
  useEffect(() => {
    getModernSetsAction()
      .then(setSets)
      .catch(() => toast.error("Failed to load sets"))
      .finally(() => setLoadingSets(false));
  }, []);

  // Handle URL params on load
  useEffect(() => {
    if (!paramSetId || sets.length === 0) return;

    const groupId = Number(paramSetId);
    const set = sets.find((s) => s.group_id === groupId);
    if (!set) return;

    if (!selectedSet || selectedSet.group_id !== groupId) {
      handleSelectSet(set, paramCardId ? Number(paramCardId) : undefined);
    }
    // Only run when sets load or URL changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sets, paramSetId, paramCardId]);

  const updateUrl = useCallback(
    (setId?: number, cardId?: number) => {
      const params = new URLSearchParams();
      if (setId) params.set("set", String(setId));
      if (cardId) params.set("card", String(cardId));
      const query = params.toString();
      router.replace(`/charts${query ? `?${query}` : ""}`, { scroll: false });
    },
    [router]
  );

  const handleSelectSet = async (set: CatalogSet, autoCardId?: number) => {
    setSelectedSet(set);
    setSelectedCard(null);
    setCards([]);
    setCardHistory([]);
    updateUrl(set.group_id);

    setLoadingCards(true);
    setLoadingSetHistory(true);

    try {
      const [fetchedCards, history] = await Promise.all([
        getSetCardsAction(set.group_id),
        getSetHistoryAction(set.group_id),
      ]);
      setCards(fetchedCards);
      setSetHistory(history);

      // Auto-select card if URL param provided
      if (autoCardId) {
        const card = fetchedCards.find((c) => c.product_id === autoCardId);
        if (card) {
          handleSelectCard(card, set.group_id);
        }
      }
    } catch {
      toast.error("Failed to load set data");
    } finally {
      setLoadingCards(false);
      setLoadingSetHistory(false);
    }
  };

  const handleSelectCard = async (
    card: CatalogCardWithId,
    setGroupId?: number
  ) => {
    setSelectedCard(card);
    updateUrl(setGroupId ?? selectedSet?.group_id, card.product_id);

    setLoadingCardHistory(true);
    try {
      const history = await getCardHistoryAction(card.product_id);
      setCardHistory(history);
    } catch {
      toast.error("Failed to load price history");
    } finally {
      setLoadingCardHistory(false);
    }
  };

  const goBackToSets = () => {
    setSelectedSet(null);
    setSelectedCard(null);
    setCards([]);
    setSetHistory([]);
    setCardHistory([]);
    updateUrl();
  };

  const goBackToSet = () => {
    setSelectedCard(null);
    setCardHistory([]);
    updateUrl(selectedSet?.group_id);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sets;
    return sets.filter((s) => s.group_name.toLowerCase().includes(q));
  }, [sets, search]);

  // Compute price stats from card history
  const priceStats = useMemo(() => {
    if (cardHistory.length === 0) return null;
    const prices = cardHistory.map((h) => h.market_price);
    const current = prices[prices.length - 1];
    const allTimeHigh = Math.max(...prices);
    const allTimeLow = Math.min(...prices);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoff = thirtyDaysAgo.toISOString().slice(0, 10);
    const recent = cardHistory.filter((h) => h.captured_at >= cutoff);
    const recentPrices = recent.map((h) => h.market_price);
    const thirtyDayHigh =
      recentPrices.length > 0 ? Math.max(...recentPrices) : null;
    const thirtyDayLow =
      recentPrices.length > 0 ? Math.min(...recentPrices) : null;

    return { current, allTimeHigh, allTimeLow, thirtyDayHigh, thirtyDayLow };
  }, [cardHistory]);

  // ── Breadcrumb ──
  const breadcrumb = (
    <div className="flex items-center gap-1 text-sm text-muted-foreground mb-4">
      <button
        onClick={goBackToSets}
        className="hover:text-foreground transition-colors"
      >
        Charts
      </button>
      {selectedSet && (
        <>
          <ChevronRight className="h-3.5 w-3.5" />
          <button
            onClick={goBackToSet}
            className={
              selectedCard
                ? "hover:text-foreground transition-colors"
                : "text-foreground font-medium"
            }
          >
            {selectedSet.group_name}
          </button>
        </>
      )}
      {selectedCard && (
        <>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">
            {selectedCard.clean_name}
          </span>
        </>
      )}
    </div>
  );

  // ── Tab toggle (shared header) ──
  const tabToggle = (
    <div className="flex w-fit rounded-lg border p-0.5">
      <button
        onClick={() => setTab("compare")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          tab === "compare"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <LineChart className="h-3.5 w-3.5" />
        Compare
      </button>
      <button
        onClick={() => setTab("browse")}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          tab === "browse"
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ListTree className="h-3.5 w-3.5" />
        Browse
      </button>
    </div>
  );

  // ── Compare tab ──
  if (tab === "compare") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-xl font-semibold">Price Charts</h1>
          {tabToggle}
        </div>

        {defaultsLoading && compareSeries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border bg-white py-32 gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading chart data...</p>
          </div>
        ) : (
          <CompareChart series={compareSeries} onRemove={removeCompareSeries} />
        )}

        <div className="flex flex-col gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={compareQuery}
              onChange={(e) => setCompareQuery(e.target.value)}
              placeholder="Search any card or set to add to the chart…"
              className="w-full h-9 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {!compareQuery.trim() && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Indexes
              </h2>
              <div className="flex flex-wrap gap-2">
                <IndexChip
                  icon={<Landmark className="h-3.5 w-3.5" />}
                  label="S&P 500"
                  charted={isCharted("sp500")}
                  loading={addingSeriesKey === "sp500"}
                  onClick={addSp500}
                />
                <IndexChip
                  icon={<Layers className="h-3.5 w-3.5" />}
                  label="Pokémon Index (all cards)"
                  charted={isCharted("pokemon-index")}
                  loading={addingSeriesKey === "pokemon-index"}
                  onClick={addPokemonIndex}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Set Indexes
            </h2>
            <div ref={setDropdownRef} className="relative w-full sm:w-72">
              <button
                onClick={() => {
                  setSetDropdownOpen((o) => !o);
                  setSetDropdownQuery("");
                }}
                className="w-full flex items-center justify-between h-9 rounded-md border border-input bg-white px-3 text-sm hover:bg-muted/30 transition-colors"
              >
                <span className="text-muted-foreground">
                  Add a set index to chart...
                </span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform",
                    setDropdownOpen && "rotate-180"
                  )}
                />
              </button>
              {setDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg flex flex-col max-h-72">
                  <div className="p-2 border-b">
                    <input
                      autoFocus
                      value={setDropdownQuery}
                      onChange={(e) => setSetDropdownQuery(e.target.value)}
                      placeholder="Search sets..."
                      className="w-full h-8 rounded-md border border-input px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {loadingSets ? (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          Loading...
                        </span>
                      </div>
                    ) : setDropdownFiltered.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        No sets match
                      </p>
                    ) : (
                      setDropdownFiltered.map((set) => {
                        const id = `set-${set.group_id}`;
                        const charted = isCharted(id);
                        const loading = addingSeriesKey === id;
                        return (
                          <button
                            key={set.group_id}
                            onClick={() => {
                              addSetSeries(set);
                              setSetDropdownOpen(false);
                            }}
                            disabled={charted || loading}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/40 transition-colors disabled:opacity-60 disabled:cursor-default"
                          >
                            {loading ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                            ) : charted ? (
                              <TrendingUp className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                            ) : (
                              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                            <span className="flex-1 min-w-0 truncate">
                              {set.group_name}
                            </span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {set.card_count} cards
                            </span>
                            {charted && (
                              <span className="text-[10px] text-primary flex-shrink-0">
                                On chart
                              </span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {myCardsFiltered.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your Cards
              </h2>
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(130px, 1fr))",
                }}
              >
                {myCardsFiltered.map((c) => {
                  const id = `card-${c.productId}`;
                  const charted = isCharted(id);
                  const loading = addingSeriesKey === id;
                  return (
                    <button
                      key={`${c.cardId}-${c.productId}`}
                      onClick={() => addCardSeries(c.productId, c.cleanName)}
                      disabled={charted || loading}
                      className={cn(
                        "group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all text-left",
                        charted
                          ? "border-primary/40 opacity-70"
                          : "hover:-translate-y-1 hover:shadow-lg"
                      )}
                    >
                      <div className="relative aspect-[63/88] w-full overflow-hidden bg-muted">
                        {c.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={c.imageUrl}
                            alt={c.cleanName}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                            <span className="text-[11px] text-muted-foreground/70">
                              No image
                            </span>
                          </div>
                        )}
                        {/* Add / loading / charted overlay */}
                        <div
                          className={cn(
                            "absolute inset-0 flex items-center justify-center transition-opacity",
                            charted
                              ? "bg-black/30 opacity-100"
                              : "bg-black/0 opacity-0 group-hover:bg-black/30 group-hover:opacity-100"
                          )}
                        >
                          {loading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                          ) : charted ? (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                              On chart
                            </span>
                          ) : (
                            <Plus className="h-7 w-7 text-white drop-shadow" />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-1 flex-col gap-0.5 p-2">
                        <p
                          className="line-clamp-2 text-xs font-medium leading-snug"
                          title={c.cleanName}
                        >
                          {c.cleanName}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.groupName}
                          {c.number ? ` · #${c.number}` : ""}
                        </p>
                        <div className="mt-auto pt-1">
                          <span className="font-mono text-sm font-semibold">
                            {fmt(c.marketPrice)}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {compareQuery.trim() && (
            <div className="flex flex-col gap-4">
              {compareSearching && (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Searching…
                  </span>
                </div>
              )}

              {!compareSearching &&
                compareSetResults.length === 0 &&
                compareCardResults.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    No matches
                  </p>
                )}

              {compareSetResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Sets
                  </h2>
                  <div className="flex flex-wrap gap-2">
                    {compareSetResults.map((set) => {
                      const id = `set-${set.group_id}`;
                      return (
                        <button
                          key={set.group_id}
                          onClick={() => addSetSeries(set)}
                          disabled={isCharted(id) || addingSeriesKey === id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default",
                            isCharted(id)
                              ? "border-primary/40 text-primary"
                              : "hover:border-primary/40"
                          )}
                        >
                          {addingSeriesKey === id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isCharted(id) ? null : (
                            <TrendingUp className="h-3 w-3" />
                          )}
                          {set.group_name}
                          {isCharted(id) && (
                            <span className="text-[10px]">· charted</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {compareCardResults.length > 0 && (
                <div className="flex flex-col gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Cards
                  </h2>
                  <div className="rounded-lg border divide-y">
                    {compareCardResults.map((card) => {
                      const id = `card-${card.product_id}`;
                      return (
                        <button
                          key={card.product_id}
                          onClick={() =>
                            addCardSeries(card.product_id, card.clean_name)
                          }
                          disabled={isCharted(id) || addingSeriesKey === id}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/30 transition-colors disabled:cursor-default disabled:opacity-60"
                        >
                          <span className="flex-1 min-w-0 truncate text-sm font-medium">
                            {card.clean_name}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {card.number || "\u2014"}
                          </span>
                          <span className="text-xs text-muted-foreground flex-shrink-0 max-w-[140px] truncate">
                            {card.group_name}
                          </span>
                          {addingSeriesKey === id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                          ) : isCharted(id) ? (
                            <span className="text-xs text-primary flex-shrink-0">
                              On chart
                            </span>
                          ) : (
                            <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Sets list view ──
  if (view === "sets") {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-heading text-xl font-semibold">Price Charts</h1>
          {tabToggle}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sets..."
            className="w-full h-9 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="rounded-lg border">
          {loadingSets ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading sets...
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No sets match
            </p>
          ) : (
            filtered.map((set) => (
              <button
                key={set.group_id}
                onClick={() => handleSelectSet(set)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors border-b last:border-0"
              >
                <span className="text-sm font-medium flex-1 min-w-0 truncate">
                  {set.group_name}
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {set.card_count} cards
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Set detail view ──
  if (view === "set-detail") {
    return (
      <div className="flex flex-col gap-6">
        {breadcrumb}

        <div className="flex items-center gap-3">
          <button
            onClick={goBackToSets}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="font-heading text-xl font-semibold">
            {selectedSet!.group_name}
          </h1>
        </div>

        {/* Set value chart */}
        {loadingSetHistory ? (
          <div className="flex items-center justify-center gap-2 py-8 rounded-lg border">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Loading set history...
            </span>
          </div>
        ) : (
          <PriceChart
            title="Set Total Market Value"
            data={setHistory.map((h) => ({
              time: h.captured_at,
              value: h.total_value,
            }))}
            height={300}
          />
        )}

        {/* Cards list */}
        <h2 className="text-sm font-medium text-muted-foreground">
          Cards in set
        </h2>
        <div className="rounded-lg border">
          {loadingCards ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading cards...
              </span>
            </div>
          ) : cards.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cards found
            </p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium w-16" />
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium w-24">
                        Number
                      </th>
                      <th className="text-right px-4 py-2 font-medium w-28">
                        Market Price
                      </th>
                      <th className="px-4 py-2 w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, i) => (
                      <tr
                        key={`${card.product_id}-${i}`}
                        onClick={() => handleSelectCard(card)}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      >
                        <td className="px-4 py-1.5 w-16">
                          {card.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={card.image_url}
                              alt={card.clean_name}
                              className="w-10 h-14 object-contain rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-14 rounded bg-muted/30" />
                          )}
                        </td>
                        <td className="px-4 py-1.5 font-medium">
                          {card.clean_name}
                        </td>
                        <td className="px-4 py-1.5 text-muted-foreground">
                          {card.number || "\u2014"}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                          {fmt(
                            card.market_price != null
                              ? Number(card.market_price)
                              : null
                          )}
                        </td>
                        <td className="px-4 py-1.5">
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card layout */}
              <div className="sm:hidden divide-y">
                {cards.map((card, i) => (
                  <button
                    key={`${card.product_id}-${i}`}
                    onClick={() => handleSelectCard(card)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-muted/20"
                  >
                    {card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.image_url}
                        alt={card.clean_name}
                        className="w-10 h-14 object-contain rounded flex-shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-10 h-14 rounded bg-muted/30 flex-shrink-0" />
                    )}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {card.clean_name}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>#{card.number || "\u2014"}</span>
                        <span className="font-mono">
                          {fmt(
                            card.market_price != null
                              ? Number(card.market_price)
                              : null
                          )}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Card detail view ──
  return (
    <div className="flex flex-col gap-6">
      {breadcrumb}

      <div className="flex items-center gap-3">
        <button
          onClick={goBackToSet}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-heading text-xl font-semibold">
          {selectedCard!.clean_name}
        </h1>
      </div>

      {/* Card info row */}
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Card image */}
        <div className="flex-shrink-0">
          {selectedCard!.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedCard!.image_url}
              alt={selectedCard!.clean_name}
              className="w-48 rounded-lg border shadow-sm"
            />
          ) : (
            <div className="w-48 aspect-[5/7] rounded-lg bg-muted/30 border" />
          )}
        </div>

        {/* Card details */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <div className="text-sm text-muted-foreground">
            {selectedSet?.group_name}
            {selectedCard!.number && (
              <span> &middot; #{selectedCard!.number}</span>
            )}
          </div>

          <div className="text-2xl font-semibold font-mono">
            {fmt(
              selectedCard!.market_price != null
                ? Number(selectedCard!.market_price)
                : null
            )}
          </div>

          {selectedCard!.url && (
            <a
              href={selectedCard!.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800"
            >
              View on TCGPlayer
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}

          {/* Price stats */}
          {priceStats && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              <StatBox
                label="Current"
                value={fmt(priceStats.current)}
              />
              <StatBox
                label="30d High"
                value={
                  priceStats.thirtyDayHigh != null
                    ? fmt(priceStats.thirtyDayHigh)
                    : "\u2014"
                }
              />
              <StatBox
                label="30d Low"
                value={
                  priceStats.thirtyDayLow != null
                    ? fmt(priceStats.thirtyDayLow)
                    : "\u2014"
                }
              />
              <StatBox
                label="All-Time High"
                value={fmt(priceStats.allTimeHigh)}
              />
              <StatBox
                label="All-Time Low"
                value={fmt(priceStats.allTimeLow)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Price chart */}
      {loadingCardHistory ? (
        <div className="flex items-center justify-center gap-2 py-12 rounded-lg border">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Loading price history...
          </span>
        </div>
      ) : (
        <PriceChart
          title="Market Price History"
          data={cardHistory.map((h) => ({
            time: h.captured_at,
            value: h.market_price,
          }))}
        />
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold font-mono mt-0.5">{value}</div>
    </div>
  );
}

function IndexChip({
  icon,
  label,
  charted,
  loading,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  charted: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={charted || loading}
      className={cn(
        "flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-default",
        charted ? "border-primary/40 text-primary" : "hover:border-primary/40"
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {label}
      {charted && <span className="text-[10px]">· charted</span>}
    </button>
  );
}

