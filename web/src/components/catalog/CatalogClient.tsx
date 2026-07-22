"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Loader2,
  ExternalLink,
  Plus,
  Check,
  ArrowLeft,
  ImageOff,
  LayoutGrid,
  Rows3,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getAllSetsAction,
  getSetCardsAction,
  searchCardsAction,
  getCatalogTopMoversAction,
} from "@/actions/catalog";
import { addCardAction } from "@/actions/cards";
import { useCurrency } from "@/components/currency-context";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/cn";
import type {
  CatalogSet,
  CatalogCard,
  CatalogCardSearchResult,
  CatalogMover,
} from "@/lib/db/catalog";
import CardDetailModal, {
  type CardDetailInfo,
} from "@/components/catalog/CardDetailModal";

// Bolds the portion of `text` that matches `query` (case-insensitive), used
// to give search results a bit of polish by showing exactly what matched.
function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 text-inherit">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// Lowercases and strips punctuation so "Scarlet & Violet 151" and "scarlet
// violet 151" compare equal, and individual words (incl. bare numbers like
// "151") can be matched as whole words rather than arbitrary substrings.
function normalizeWords(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Given a token list, finds the longest trailing phrase that whole-word
// matches inside any loaded set's name (e.g. ["Charizard", "151"] matches
// "Scarlet & Violet 151" at splitAt=1). Tries the longest trailing phrase
// first (most specific) down to a single trailing word, and always leaves
// at least one leading token. Returns null if nothing matches.
function matchTrailingSet(
  tokens: string[],
  sets: CatalogSet[]
): { splitAt: number; matchedSet: CatalogSet } | null {
  for (let splitAt = 1; splitAt < tokens.length; splitAt++) {
    const trailingPhrase = normalizeWords(tokens.slice(splitAt).join(" "));
    if (!trailingPhrase) continue;
    const match = sets.find((s) =>
      ` ${normalizeWords(s.group_name)} `.includes(` ${trailingPhrase} `)
    );
    if (match) return { splitAt, matchedSet: match };
  }
  return null;
}

// Parses queries like "Charizard 151" into a card-name part ("Charizard")
// plus a matched set ("Scarlet & Violet 151"), and queries like "Charizard 6"
// into a name part plus a card-number part ("6"). Handles the ambiguous case
// where a trailing number could be either a card number OR part of a set's
// name (e.g. "151" in "Scarlet & Violet 151") by trying, in order:
//   1. Peel the trailing number off as a *candidate* card number, then look
//      for a set match in what's left (handles "Charizard 151 6": "6" is
//      the card number, "151" completes the set name).
//   2. If that fails, look for a set match using the full token list
//      including the trailing number (handles "Charizard 151": "151" is
//      part of the set name, not a card number).
//   3. If that also fails, fall back to treating the trailing number as a
//      plain card-number filter with no matched set (handles "Charizard 6"
//      where no set name contains "6").
// Falls back to { namePart: query, matchedSet: null, numberPart: null } when
// nothing matches at all, i.e. today's plain substring-on-name behavior.
function parseCatalogQuery(
  query: string,
  sets: CatalogSet[]
): { namePart: string; matchedSet: CatalogSet | null; numberPart: string | null } {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return { namePart: "", matchedSet: null, numberPart: null };
  }

  const lastToken = tokens[tokens.length - 1];
  const lastIsNumeric = tokens.length > 1 && /^\d{1,4}(\/\d{1,4})?$/.test(lastToken);

  if (lastIsNumeric) {
    const remaining = tokens.slice(0, -1);
    const remainingMatch = matchTrailingSet(remaining, sets);
    if (remainingMatch) {
      return {
        namePart: remaining.slice(0, remainingMatch.splitAt).join(" "),
        matchedSet: remainingMatch.matchedSet,
        numberPart: lastToken,
      };
    }
  }

  const fullMatch = matchTrailingSet(tokens, sets);
  if (fullMatch) {
    return {
      namePart: tokens.slice(0, fullMatch.splitAt).join(" "),
      matchedSet: fullMatch.matchedSet,
      numberPart: null,
    };
  }

  if (lastIsNumeric) {
    return {
      namePart: tokens.slice(0, -1).join(" "),
      matchedSet: null,
      numberPart: lastToken,
    };
  }

  return { namePart: query.trim(), matchedSet: null, numberPart: null };
}

export default function CatalogClient() {
  const { fmt } = useCurrency();
  const [tab, setTab] = useState<"sets" | "cards">("cards");
  const [sets, setSets] = useState<CatalogSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedSet, setSelectedSet] = useState<CatalogSet | null>(null);
  const [loadingSet, setLoadingSet] = useState<number | null>(null);
  const [cardsMap, setCardsMap] = useState<Record<number, CatalogCard[]>>({});
  const [errorSet, setErrorSet] = useState<number | null>(null);
  const [addingCard, setAddingCard] = useState<string | null>(null);
  const [addedCard, setAddedCard] = useState<string | null>(null);
  const [cardView, setCardView] = useState<"grid" | "table">("grid");

  // Global card search (across all sets), used by the "Cards" tab.
  const [cardSearch, setCardSearch] = useState("");
  const debouncedCardSearch = useDebounce(cardSearch, 350);
  const [cardResults, setCardResults] = useState<CatalogCardSearchResult[]>([]);
  const [searchingCards, setSearchingCards] = useState(false);
  // Sealed products (booster boxes, ETBs, tins, etc.) have no card number in
  // tcg_catalog, unlike singles which always have one (e.g. "067/147"). Hide
  // them from card search results when this is on.
  const [hideSealed, setHideSealed] = useState(false);

  // Today's top movers, shown on the Cards tab before a search is typed.
  const [movers, setMovers] = useState<{
    gainers: CatalogMover[];
    drops: CatalogMover[];
  } | null>(null);
  const [loadingMovers, setLoadingMovers] = useState(true);

  // Card detail modal (opened by clicking a card's artwork anywhere in the
  // catalog: set-detail grid/table/mobile views, search results, movers).
  const [detailCard, setDetailCard] = useState<CardDetailInfo | null>(null);

  useEffect(() => {
    getAllSetsAction()
      .then(setSets)
      .catch(() => toast.error("Failed to load sets"))
      .finally(() => setLoadingSets(false));
  }, []);

  useEffect(() => {
    getCatalogTopMoversAction()
      .then(setMovers)
      .catch(() => toast.error("Failed to load today's movers"))
      .finally(() => setLoadingMovers(false));
  }, []);

  useEffect(() => {
    const q = debouncedCardSearch.trim();
    if (!q) {
      return;
    }
    // Parse out a trailing set name (e.g. "Charizard 151" -> name
    // "Charizard" restricted to the "Scarlet & Violet 151" set) and/or a
    // trailing card number (e.g. "Charizard 6") so compound queries actually
    // narrow results instead of matching nothing.
    const { namePart, matchedSet, numberPart } = parseCatalogQuery(q, sets);
    let cancelled = false;
    // Kicking off a debounced async search is the point of this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearchingCards(true);
    searchCardsAction(namePart, matchedSet?.group_id, numberPart ?? undefined)
      .then((results) => {
        if (!cancelled) setCardResults(results);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to search cards");
      })
      .finally(() => {
        if (!cancelled) setSearchingCards(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedCardSearch, sets]);

  // Same parse as above, memoized for rendering (highlighting the matched
  // name portion, and showing a "in <Set>" badge next to the search box).
  const parsedSearch = useMemo(
    () => parseCatalogQuery(debouncedCardSearch, sets),
    [debouncedCardSearch, sets]
  );

  // Sealed products come back from searchCards() with an empty `number`
  // (singles always have one), so that's what we filter on.
  const filteredCardResults = useMemo(
    () => (hideSealed ? cardResults.filter((c) => c.number) : cardResults),
    [cardResults, hideSealed]
  );

  const sealedCount = useMemo(
    () => cardResults.filter((c) => !c.number).length,
    [cardResults]
  );

  // Group results by set so a broad search (e.g. "Charizard" across every
  // set) reads as organized sections instead of one big undifferentiated
  // grid. Preserves the price-desc ordering from the query by keeping each
  // set's first-seen position.
  const groupedCardResults = useMemo(() => {
    const groups = new Map<
      number,
      { group_id: number; group_name: string; cards: CatalogCardSearchResult[] }
    >();
    for (const card of filteredCardResults) {
      let group = groups.get(card.group_id);
      if (!group) {
        group = { group_id: card.group_id, group_name: card.group_name, cards: [] };
        groups.set(card.group_id, group);
      }
      group.cards.push(card);
    }
    return Array.from(groups.values());
  }, [filteredCardResults]);

  const handleAdd = async (card: CatalogCard) => {
    const key = `${card.clean_name}-${card.number}`;
    setAddingCard(key);
    try {
      await addCardAction({
        name: card.clean_name,
        number: card.number ?? "",
        quantity: 1,
        market_price: card.market_price != null ? Number(card.market_price) : null,
        tcgplayer_url: card.url ?? null,
      });
      setAddedCard(key);
      toast.success(`Added ${card.clean_name} to inventory`);
      setTimeout(() => setAddedCard(null), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add card";
      if (msg.includes("Not authenticated")) {
        toast.error("Sign in to add cards to your inventory");
      } else {
        toast.error(msg);
      }
    } finally {
      setAddingCard(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return sets;
    return sets.filter((s) => s.group_name.toLowerCase().includes(q));
  }, [sets, search]);

  // Sets whose name matches the universal card-search query, so a search for
  // e.g. "Prismatic" or "Charizard" surfaces the relevant set(s) too, not
  // just individual cards. Stripped of apostrophes to match the same
  // normalization the card-name search on the server applies.
  const matchingSets = useMemo(() => {
    const q = cardSearch
      .replace(/['\u2018\u2019]/g, "")
      .toLowerCase()
      .trim();
    if (!q) return [];

    // Compound queries like "Charizard 151" parse out a trailing set name
    // ("151" -> Scarlet & Violet 151) — surface just that specific set
    // rather than every set whose name loosely contains the raw string.
    const parsed = parseCatalogQuery(cardSearch, sets);
    if (parsed.matchedSet) return [parsed.matchedSet];

    return sets
      .filter((s) => s.group_name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [sets, cardSearch]);

  const openSet = async (set: CatalogSet) => {
    setSelectedSet(set);
    setErrorSet(null);

    if (!cardsMap[set.group_id]) {
      setLoadingSet(set.group_id);
      try {
        const cards = await getSetCardsAction(set.group_id);
        setCardsMap((prev) => ({ ...prev, [set.group_id]: cards }));
      } catch (err) {
        console.error("Failed to load cards for set", set.group_id, err);
        setErrorSet(set.group_id);
      }
      setLoadingSet(null);
    }
  };

  // Jump from a card search result (or mover) into that card's set detail view.
  const openSetFromCard = async (result: { group_id: number }) => {
    const set = sets.find((s) => s.group_id === result.group_id);
    if (set) {
      await openSet(set);
    }
  };

  const openMoverDetail = (m: CatalogMover) => {
    setDetailCard({
      product_id: m.product_id,
      clean_name: m.clean_name,
      number: m.number,
      group_name: m.group_name,
      image_url: m.image_url,
      url: m.url,
      market_price: m.newPrice,
    });
  };

  // ── Set detail view ─────────────────────────────────────────────
  if (selectedSet) {
    const isLoading = loadingSet === selectedSet.group_id;
    const cards = cardsMap[selectedSet.group_id];

    return (
      <>
      <div className="flex flex-col gap-6">
        <button
          onClick={() => setSelectedSet(null)}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sets
        </button>

        {/* Banner header */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border bg-gradient-to-br from-muted/40 to-muted/10 px-6 py-8 text-center">
          {selectedSet.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selectedSet.logo_url}
              alt={`${selectedSet.group_name} logo`}
              className="h-20 object-contain sm:h-24"
            />
          ) : (
            <h1 className="font-heading text-2xl font-semibold">
              {selectedSet.group_name}
            </h1>
          )}
          <p className="text-sm text-muted-foreground">
            {selectedSet.card_count} cards
          </p>
        </div>

        {/* View toggle */}
        {cards && cards.length > 0 && (
          <div className="flex justify-end">
            <div className="flex rounded-lg border p-0.5">
              <button
                onClick={() => setCardView("grid")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  cardView === "grid"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Card view"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setCardView("table")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
                  cardView === "table"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="Table view"
              >
                <Rows3 className="h-4 w-4" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        )}

        {/* Cards */}
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Loading cards…
            </span>
          </div>
        ) : errorSet === selectedSet.group_id ? (
          <p className="py-12 text-center text-sm text-red-500">
            Failed to load cards
          </p>
        ) : !cards || cards.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No cards found
          </p>
        ) : cardView === "grid" ? (
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            }}
          >
            {cards.map((card, i) => {
              const key = `${card.clean_name}-${card.number}`;
              return (
                <div
                  key={`${key}-${i}`}
                  className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative aspect-[63/88] w-full overflow-hidden bg-muted">
                    <button
                      onClick={() =>
                        setDetailCard({
                          product_id: card.product_id,
                          clean_name: card.clean_name,
                          number: card.number,
                          group_name: selectedSet.group_name,
                          image_url: card.image_url,
                          url: card.url,
                          market_price: card.market_price,
                        })
                      }
                      className="block h-full w-full text-left"
                      title="View card details"
                    >
                      {card.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.image_url}
                          alt={card.clean_name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 p-3 text-center">
                          <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                          <span className="text-[11px] leading-tight text-muted-foreground/70">
                            No image
                          </span>
                        </div>
                      )}
                    </button>
                    <button
                      onClick={() => handleAdd(card)}
                      disabled={addingCard === key || addedCard === key}
                      className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-primary group-hover:opacity-100 disabled:opacity-100"
                      title="Add to inventory"
                    >
                      {addedCard === key ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : addingCard === key ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-2">
                    <p
                      className="line-clamp-2 text-xs font-medium leading-snug"
                      title={card.clean_name}
                    >
                      {card.clean_name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {card.number ? `#${card.number}` : "\u00A0"}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="font-mono text-sm font-semibold">
                        {fmt(
                          card.market_price != null
                            ? Number(card.market_price)
                            : null
                        )}
                      </span>
                      {card.url && (
                        <a
                          href={card.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-blue-600"
                          title="View on TCGPlayer"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border">
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="w-16 px-4 py-2 font-medium" />
                      <th className="px-4 py-2 text-left font-medium">
                        Name
                      </th>
                      <th className="w-24 px-4 py-2 text-left font-medium">
                        Number
                      </th>
                      <th className="w-28 px-4 py-2 text-right font-medium">
                        Market Price
                      </th>
                      <th className="w-24 px-4 py-2 text-center font-medium">
                        Link
                      </th>
                      <th className="w-12 px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {cards.map((card, i) => (
                      <tr
                        key={`${card.clean_name}-${card.number}-${i}`}
                        onClick={() =>
                          setDetailCard({
                            product_id: card.product_id,
                            clean_name: card.clean_name,
                            number: card.number,
                            group_name: selectedSet.group_name,
                            image_url: card.image_url,
                            url: card.url,
                            market_price: card.market_price,
                          })
                        }
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/20"
                      >
                        <td className="w-16 px-4 py-1.5">
                          {card.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={card.image_url}
                              alt={card.clean_name}
                              className="h-14 w-10 rounded object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-14 w-10 rounded bg-muted/30" />
                          )}
                        </td>
                        <td className="px-4 py-1.5">{card.clean_name}</td>
                        <td className="px-4 py-1.5 text-muted-foreground">
                          {card.number || "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                          {fmt(
                            card.market_price != null
                              ? Number(card.market_price)
                              : null
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          {card.url ? (
                            <a
                              href={card.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            >
                              TCGPlayer
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAdd(card);
                            }}
                            disabled={
                              addingCard === `${card.clean_name}-${card.number}` ||
                              addedCard === `${card.clean_name}-${card.number}`
                            }
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                            title="Add to inventory"
                          >
                            {addedCard === `${card.clean_name}-${card.number}` ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : addingCard === `${card.clean_name}-${card.number}` ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile card layout */}
              <div className="divide-y sm:hidden">
                {cards.map((card, i) => (
                  <div
                    key={`${card.clean_name}-${card.number}-${i}`}
                    onClick={() =>
                      setDetailCard({
                        product_id: card.product_id,
                        clean_name: card.clean_name,
                        number: card.number,
                        group_name: selectedSet.group_name,
                        image_url: card.image_url,
                        url: card.url,
                        market_price: card.market_price,
                      })
                    }
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/20"
                  >
                    {card.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.image_url}
                        alt={card.clean_name}
                        className="h-14 w-10 flex-shrink-0 rounded object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-14 w-10 flex-shrink-0 rounded bg-muted/30" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium">
                        {card.clean_name}
                      </span>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>#{card.number || "—"}</span>
                        <span className="font-mono">
                          {fmt(
                            card.market_price != null
                              ? Number(card.market_price)
                              : null
                          )}
                        </span>
                        {card.url && (
                          <a
                            href={card.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          >
                            TCGPlayer
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAdd(card);
                      }}
                      disabled={
                        addingCard === `${card.clean_name}-${card.number}` ||
                        addedCard === `${card.clean_name}-${card.number}`
                      }
                      className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-input transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50"
                      title="Add to inventory"
                    >
                      {addedCard === `${card.clean_name}-${card.number}` ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : addingCard === `${card.clean_name}-${card.number}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </>
          </div>
        )}
      </div>
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}
      </>
    );
  }

  // ── Set grid view ───────────────────────────────────────────────
  return (
    <>
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-xl font-semibold">Catalog</h1>

        {/* Sets / Cards tab toggle */}
        <div className="flex w-fit rounded-lg border p-0.5">
          <button
            onClick={() => setTab("sets")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "sets"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sets
          </button>
          <button
            onClick={() => setTab("cards")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === "cards"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cards
          </button>
        </div>
      </div>

      {tab === "sets" ? (
        <>
          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sets…"
              className="h-9 w-full rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {loadingSets ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Loading sets…
              </span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No sets match
            </p>
          ) : (
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              }}
            >
              {filtered.map((set) => (
                <button
                  key={set.group_id}
                  onClick={() => openSet(set)}
                  className="group flex flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="relative flex h-28 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-muted to-muted/50 p-4">
                    {set.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={set.logo_url}
                        alt={`${set.group_name} logo`}
                        className="h-full max-h-20 w-full object-contain transition-transform duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-center">
                        <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                        <span className="text-[11px] leading-tight text-muted-foreground/70">
                          No logo yet
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 items-center gap-2 p-3">
                    {set.symbol_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={set.symbol_url}
                        alt=""
                        className="h-4 w-4 flex-shrink-0 object-contain"
                      />
                    ) : null}
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {set.group_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {set.card_count} cards
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Universal card/set search — fuzzy-ish substring match against
              both card names, set names, and card numbers at once. Starts
              wide/prominent and centered as a "hero" search when nothing's
              been typed yet, then shrinks back to a compact, left-aligned
              bar once there's a query so results have room to breathe. */}
          <div
            className={cn(
              "group relative w-full transition-all duration-300",
              cardSearch ? "sm:max-w-md" : "mx-auto mt-6 sm:mt-16 sm:max-w-2xl"
            )}
          >
            <div className="pointer-events-none absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-primary/40 via-fuchsia-400/30 to-primary/40 opacity-0 blur transition-opacity duration-300 group-focus-within:opacity-100" />
            <div className="relative flex items-center rounded-2xl border border-input bg-card shadow-sm transition-shadow duration-200 group-focus-within:shadow-md">
              <Search className="ml-3.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <input
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search by card name, set, or card number… (e.g. Charizard, Prismatic Evolutions, 006/165)"
                className={cn(
                  "w-full bg-transparent px-2.5 text-sm transition-all duration-300 focus:outline-none",
                  cardSearch ? "h-11" : "h-14 text-base"
                )}
                autoFocus
              />
              {cardSearch ? (
                <button
                  onClick={() => setCardSearch("")}
                  className="mr-1.5 flex-shrink-0 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <Sparkles className="mr-3.5 h-4 w-4 flex-shrink-0 text-primary/50" />
              )}
            </div>
          </div>

          {parsedSearch.namePart && (parsedSearch.matchedSet || parsedSearch.numberPart) && (
            <p className="-mt-1 text-xs text-muted-foreground">
              Showing &ldquo;{parsedSearch.namePart}&rdquo; results
              {parsedSearch.matchedSet && (
                <>
                  {" "}narrowed to{" "}
                  <span className="font-medium text-foreground">
                    {parsedSearch.matchedSet.group_name}
                  </span>
                </>
              )}
              {parsedSearch.numberPart && (
                <>
                  {" "}
                  <span className="font-medium text-foreground">
                    · #{parsedSearch.numberPart}
                  </span>
                </>
              )}
            </p>
          )}

          {cardSearch.trim() && sealedCount > 0 && (
            <label className="-mt-1 flex w-fit cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={hideSealed}
                onChange={(e) => setHideSealed(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              Hide sealed products ({sealedCount})
            </label>
          )}

          {cardSearch.trim() && matchingSets.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Matching Sets
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {matchingSets.map((set) => (
                  <button
                    key={set.group_id}
                    onClick={() => openSet(set)}
                    className="group/chip flex items-center gap-2.5 rounded-full border bg-card py-1.5 pl-2 pr-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-muted to-muted/50">
                      {set.symbol_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={set.symbol_url}
                          alt=""
                          className="h-4 w-4 object-contain"
                        />
                      ) : (
                        <ImageOff className="h-3 w-3 text-muted-foreground/50" />
                      )}
                    </span>
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-sm font-medium">
                        {highlightMatch(set.group_name, cardSearch)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {set.card_count} cards
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!cardSearch.trim() ? (
            loadingMovers ? (
              <div className="flex items-center justify-center gap-2 py-12">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Loading today&rsquo;s movers…
                </span>
              </div>
            ) : !movers ||
              (movers.gainers.length === 0 && movers.drops.length === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Start typing to search cards across every set
              </p>
            ) : (
              <div className="flex flex-col gap-8">
                {movers.gainers.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                      <ArrowUpRight className="h-4 w-4 text-green-600" />
                      Today&rsquo;s Top Gainers
                    </h2>
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(140px, 1fr))",
                      }}
                    >
                      {movers.gainers.map((m, i) => (
                        <MoverTile
                          key={`gain-${m.product_id}-${i}`}
                          mover={m}
                          direction="up"
                          fmt={fmt}
                          onOpenSet={openSetFromCard}
                          onOpenDetail={openMoverDetail}
                          onAdd={handleAdd}
                          addingCard={addingCard}
                          addedCard={addedCard}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {movers.drops.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                      Today&rsquo;s Top Drops
                    </h2>
                    <div
                      className="grid gap-4"
                      style={{
                        gridTemplateColumns:
                          "repeat(auto-fill, minmax(140px, 1fr))",
                      }}
                    >
                      {movers.drops.map((m, i) => (
                        <MoverTile
                          key={`drop-${m.product_id}-${i}`}
                          mover={m}
                          direction="down"
                          fmt={fmt}
                          onOpenSet={openSetFromCard}
                          onOpenDetail={openMoverDetail}
                          onAdd={handleAdd}
                          addingCard={addingCard}
                          addedCard={addedCard}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : searchingCards ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Searching…
              </span>
            </div>
          ) : filteredCardResults.length === 0 ? (
            matchingSets.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No cards or sets match &ldquo;{cardSearch}&rdquo;
              </p>
            )
          ) : (
            // Each set's section is a shrink-to-fit block (title + its own
            // wrapping tile grid, capped at the full row width) rather than a
            // full-width row by default, so small sections sit side-by-side
            // and only drop to their own line when they don't fit — no more
            // wasted whitespace next to a lone 1-2 card set, while large
            // sections can still stretch to use the whole row.
            <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
              {groupedCardResults.map((group) => (
                <div key={group.group_id} className="flex flex-col gap-2.5">
                  <button
                    onClick={() => openSetFromCard({ group_id: group.group_id })}
                    className="flex w-fit items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground hover:underline"
                    title={`View ${group.group_name} set`}
                  >
                    {group.group_name}
                    <span className="font-normal normal-case tracking-normal text-muted-foreground/70">
                      · {group.cards.length}
                    </span>
                  </button>
                  <div
                    className="flex flex-wrap gap-4"
                    style={{ maxWidth: "100%" }}
                  >
                    {group.cards.map((card, i) => (
                      <div key={`${card.group_id}-${card.clean_name}-${card.number}-${i}`} className="w-[140px] flex-shrink-0">
                        <SearchResultTile
                          card={card}
                          query={parsedSearch.namePart}
                          showSetName={false}
                          onOpenDetail={setDetailCard}
                          onAdd={handleAdd}
                          addingCard={addingCard}
                          addedCard={addedCard}
                          fmt={fmt}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}
    </>
  );
}

// Compact card tile for the search-results tab. Used both inside per-set
// sections (showSetName=false, since the section header already names the
// set) and the flattened "Other Matches" grid for small groups
// (showSetName=true, since there's no header to disambiguate).
function SearchResultTile({
  card,
  query,
  showSetName,
  onOpenSet,
  onOpenDetail,
  onAdd,
  addingCard,
  addedCard,
  fmt,
}: {
  card: CatalogCardSearchResult;
  query: string;
  showSetName: boolean;
  onOpenSet?: (result: { group_id: number }) => void;
  onOpenDetail: (card: CardDetailInfo) => void;
  onAdd: (card: CatalogCard) => void;
  addingCard: string | null;
  addedCard: string | null;
  fmt: (n: number | null) => string;
}) {
  const key = `${card.group_id}-${card.clean_name}-${card.number}`;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <button
        onClick={() =>
          onOpenDetail({
            product_id: card.product_id,
            clean_name: card.clean_name,
            number: card.number,
            group_name: card.group_name,
            image_url: card.image_url,
            url: card.url,
            market_price: card.market_price,
          })
        }
        className="relative aspect-[63/88] w-full overflow-hidden bg-muted text-left"
        title="View card details"
      >
        {card.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.image_url}
            alt={card.clean_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 p-3 text-center">
            <ImageOff className="h-6 w-6 text-muted-foreground/50" />
            <span className="text-[11px] leading-tight text-muted-foreground/70">
              No image
            </span>
          </div>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p
          className="line-clamp-2 text-xs font-medium leading-snug"
          title={card.clean_name}
        >
          {highlightMatch(card.clean_name, query)}
        </p>
        {showSetName ? (
          <button
            onClick={() => onOpenSet?.(card)}
            className="truncate text-left text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            title={card.group_name}
          >
            {card.group_name}
            {card.number ? ` · #${card.number}` : ""}
          </button>
        ) : (
          <span className="truncate text-[11px] text-muted-foreground">
            {card.number ? `#${card.number}` : "Sealed"}
          </span>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-mono text-sm font-semibold">
            {fmt(card.market_price != null ? Number(card.market_price) : null)}
          </span>
          {card.url && (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-blue-600"
              title="View on TCGPlayer"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <button
          onClick={() => onAdd(card)}
          disabled={addingCard === key || addedCard === key}
          className={cn(
            "mt-1.5 flex items-center justify-center gap-1 rounded-lg py-1 text-[11px] font-semibold transition-colors",
            addedCard === key
              ? "bg-green-600 text-white"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
          )}
          title="Add to inventory"
        >
          {addedCard === key ? (
            <>
              <Check className="h-3 w-3" />
              Added
            </>
          ) : addingCard === key ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Add
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Compact card tile for the top-movers sections, with a price-change badge
// overlaid on the artwork.
function MoverTile({
  mover,
  direction,
  fmt,
  onOpenSet,
  onOpenDetail,
  onAdd,
  addingCard,
  addedCard,
}: {
  mover: CatalogMover;
  direction: "up" | "down";
  fmt: (v: number | null) => string;
  onOpenSet: (m: CatalogMover) => void;
  onOpenDetail: (m: CatalogMover) => void;
  onAdd: (card: CatalogCard) => void;
  addingCard: string | null;
  addedCard: string | null;
}) {
  const isUp = direction === "up";
  const key = `${mover.clean_name}-${mover.number}`;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
      <button
        onClick={() => onOpenDetail(mover)}
        className="relative aspect-[63/88] w-full overflow-hidden bg-muted text-left"
        title="View card details"
      >
        {mover.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mover.image_url}
            alt={mover.clean_name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 p-3 text-center">
            <ImageOff className="h-6 w-6 text-muted-foreground/50" />
            <span className="text-[11px] leading-tight text-muted-foreground/70">
              No image
            </span>
          </div>
        )}
        <span
          className={`absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white ${
            isUp ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {isUp ? (
            <ArrowUpRight className="h-3 w-3" />
          ) : (
            <ArrowDownRight className="h-3 w-3" />
          )}
          {isUp ? "+$" : "\u2212$"}
          {Math.abs(mover.deltaDollars).toFixed(2)}
        </span>
      </button>
      <button
        onClick={() =>
          onAdd({
            product_id: mover.product_id,
            clean_name: mover.clean_name,
            number: mover.number,
            market_price: mover.newPrice,
            url: mover.url,
            image_url: mover.image_url,
          })
        }
        disabled={addingCard === key || addedCard === key}
        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity hover:bg-primary group-hover:opacity-100 disabled:opacity-100"
        title="Add to inventory"
      >
        {addedCard === key ? (
          <Check className="h-3 w-3 text-green-400" />
        ) : addingCard === key ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Plus className="h-3 w-3" />
        )}
      </button>
      <div className="flex flex-1 flex-col gap-0.5 p-2">
        <p
          className="line-clamp-2 text-xs font-medium leading-snug"
          title={mover.clean_name}
        >
          {mover.clean_name}
        </p>
        <button
          onClick={() => onOpenSet(mover)}
          className="truncate text-left text-[11px] text-muted-foreground hover:text-foreground hover:underline"
          title={mover.group_name}
        >
          {mover.group_name}
          {mover.number ? ` · #${mover.number}` : ""}
        </button>
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-mono text-xs text-muted-foreground">
            {fmt(mover.oldPrice)} →{" "}
            <span className="font-semibold text-foreground">
              {fmt(mover.newPrice)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
