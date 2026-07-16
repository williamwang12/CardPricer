"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search,
  ChevronRight,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  getModernSetsAction,
  getSetCardsAction,
  getCardHistoryAction,
  getSetHistoryAction,
} from "@/actions/charts";
import { useCurrency } from "@/components/currency-context";
import type { CatalogSet, CatalogCardWithId } from "@/lib/db/catalog";
import type {
  PriceHistoryPoint,
  SetPriceHistoryPoint,
} from "@/lib/db/card-price-history";
import PriceChart from "./PriceChart";

type View = "sets" | "set-detail" | "card-detail";

export default function ChartsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { fmt } = useCurrency();

  // URL params
  const paramSetId = searchParams.get("set");
  const paramCardId = searchParams.get("card");

  // Data state
  const [sets, setSets] = useState<CatalogSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [search, setSearch] = useState("");

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

  // ── Sets list view ──
  if (view === "sets") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-xl font-semibold">Price Charts</h1>

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
