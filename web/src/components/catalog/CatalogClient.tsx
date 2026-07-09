"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ChevronRight, ChevronDown, Loader2, ExternalLink, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { getAllSetsAction, getSetCardsAction } from "@/actions/catalog";
import { addCardAction } from "@/actions/cards";
import { useCurrency } from "@/lib/currency-context";
import type { CatalogSet, CatalogCard } from "@/lib/db/catalog";

export default function CatalogClient() {
  const { fmt } = useCurrency();
  const [sets, setSets] = useState<CatalogSet[]>([]);
  const [loadingSets, setLoadingSets] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedSet, setExpandedSet] = useState<number | null>(null);
  const [loadingSet, setLoadingSet] = useState<number | null>(null);
  const [cardsMap, setCardsMap] = useState<Record<number, CatalogCard[]>>({});
  const [errorSet, setErrorSet] = useState<number | null>(null);
  const [addingCard, setAddingCard] = useState<string | null>(null);
  const [addedCard, setAddedCard] = useState<string | null>(null);

  useEffect(() => {
    getAllSetsAction()
      .then(setSets)
      .catch(() => toast.error("Failed to load sets"))
      .finally(() => setLoadingSets(false));
  }, []);

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

  const toggleSet = async (groupId: number) => {
    if (expandedSet === groupId) {
      setExpandedSet(null);
      return;
    }

    setExpandedSet(groupId);
    setErrorSet(null);

    if (!cardsMap[groupId]) {
      setLoadingSet(groupId);
      try {
        const cards = await getSetCardsAction(groupId);
        setCardsMap((prev) => ({ ...prev, [groupId]: cards }));
      } catch (err) {
        console.error("Failed to load cards for set", groupId, err);
        setErrorSet(groupId);
      }
      setLoadingSet(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Catalog</h1>

      {/* Search */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search sets…"
          className="w-full h-9 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Set list */}
      <div className="rounded-lg border">
        {loadingSets ? (
          <div className="flex items-center justify-center gap-2 py-12">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Loading sets…</span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            No sets match
          </p>
        ) : (
          filtered.map((set) => {
            const isExpanded = expandedSet === set.group_id;
            const isLoading = loadingSet === set.group_id;
            const cards = cardsMap[set.group_id];

            return (
              <div key={set.group_id} className="border-b last:border-0">
                {/* Set row */}
                <button
                  onClick={() => toggleSet(set.group_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium flex-1 min-w-0 truncate">
                    {set.group_name}
                  </span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {set.card_count} cards
                  </span>
                </button>

                {/* Expanded cards */}
                {isExpanded && (
                  <div className="border-t bg-muted/10">
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2 py-6">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Loading cards…
                        </span>
                      </div>
                    ) : errorSet === set.group_id ? (
                      <p className="text-sm text-red-500 text-center py-6">
                        Failed to load cards
                      </p>
                    ) : !cards || cards.length === 0 ? (
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
                                <th className="text-left px-4 py-2 font-medium w-16">
                                </th>
                                <th className="text-left px-4 py-2 font-medium">
                                  Name
                                </th>
                                <th className="text-left px-4 py-2 font-medium w-24">
                                  Number
                                </th>
                                <th className="text-right px-4 py-2 font-medium w-28">
                                  Market Price
                                </th>
                                <th className="text-center px-4 py-2 font-medium w-24">
                                  Link
                                </th>
                                <th className="px-4 py-2 w-12" />
                              </tr>
                            </thead>
                            <tbody>
                              {cards.map((card, i) => (
                                <tr
                                  key={`${card.clean_name}-${card.number}-${i}`}
                                  className="border-b last:border-0 hover:bg-muted/20"
                                >
                                  <td className="px-4 py-1.5 w-16">
                                    {card.image_url ? (
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
                                  <td className="px-4 py-1.5">
                                    {card.clean_name}
                                  </td>
                                  <td className="px-4 py-1.5 text-muted-foreground">
                                    {card.number || "—"}
                                  </td>
                                  <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                                    {fmt(card.market_price != null ? Number(card.market_price) : null)}
                                  </td>
                                  <td className="px-4 py-1.5 text-center">
                                    {card.url ? (
                                      <a
                                        href={card.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
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
                                      onClick={() => handleAdd(card)}
                                      disabled={addingCard === `${card.clean_name}-${card.number}` || addedCard === `${card.clean_name}-${card.number}`}
                                      className="inline-flex items-center justify-center h-7 w-7 rounded-md border border-input hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
                        <div className="sm:hidden divide-y">
                          {cards.map((card, i) => (
                            <div
                              key={`${card.clean_name}-${card.number}-${i}`}
                              className="px-4 py-3 flex items-center gap-3"
                            >
                              {card.image_url ? (
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
                                  <span>#{card.number || "—"}</span>
                                  <span className="font-mono">
                                    {fmt(card.market_price != null ? Number(card.market_price) : null)}
                                  </span>
                                  {card.url && (
                                    <a
                                      href={card.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                                    >
                                      TCGPlayer
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                              <button
                                onClick={() => handleAdd(card)}
                                disabled={addingCard === `${card.clean_name}-${card.number}` || addedCard === `${card.clean_name}-${card.number}`}
                                className="flex-shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-md border border-input hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
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
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
