"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Plus, Check, Loader2, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { getCardHistoryAction } from "@/actions/charts";
import type { PriceHistoryPoint } from "@/lib/db/card-price-history";
import { addCardAction } from "@/actions/cards";
import { useCurrency } from "@/components/currency-context";
import PriceChart from "@/components/charts/PriceChart";

export interface CardDetailInfo {
  product_id: number;
  clean_name: string;
  number: string | null;
  group_name: string;
  image_url: string | null;
  url: string | null;
  market_price: number | null;
}

interface Props {
  card: CardDetailInfo;
  onClose: () => void;
}

export default function CardDetailModal({ card, onClose }: Props) {
  const { fmt } = useCurrency();
  const [history, setHistory] = useState<PriceHistoryPoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    getCardHistoryAction(card.product_id)
      .then(setHistory)
      .catch(() => {
        // Non-critical: chart just shows "no data yet" on failure.
      })
      .finally(() => setLoadingHistory(false));
  }, [card.product_id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleAdd = async () => {
    setAdding(true);
    try {
      await addCardAction({
        name: card.clean_name,
        number: card.number ?? "",
        quantity: 1,
        market_price: card.market_price != null ? Number(card.market_price) : null,
        tcgplayer_url: card.url ?? null,
      });
      setAdded(true);
      toast.success(`Added ${card.clean_name} to inventory`);
      setTimeout(() => setAdded(false), 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add card";
      if (msg.includes("Not authenticated")) {
        toast.error("Sign in to add cards to your inventory");
      } else {
        toast.error(msg);
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4">
            <div className="relative w-28 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              <div className="aspect-[63/88] w-full">
                {card.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={card.image_url}
                    alt={card.clean_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-muted to-muted/50 p-3 text-center">
                    <ImageOff className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-col gap-1 pt-1">
              <h2 className="font-heading text-lg font-semibold leading-tight">
                {card.clean_name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {card.group_name}
                {card.number ? ` · #${card.number}` : ""}
              </p>
              <p className="mt-2 font-mono text-2xl font-semibold">
                {fmt(card.market_price != null ? Number(card.market_price) : null)}
              </p>
              {card.url && (
                <a
                  href={card.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                >
                  View on TCGPlayer
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loadingHistory ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border py-16">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Loading price history…
            </span>
          </div>
        ) : (
          <PriceChart
            title="Price History"
            data={history.map((h) => ({
              time: h.captured_at,
              value: h.market_price,
            }))}
            height={240}
          />
        )}

        <button
          onClick={handleAdd}
          disabled={adding || added}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-70"
        >
          {added ? (
            <>
              <Check className="h-4 w-4" />
              Added to inventory
            </>
          ) : adding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Adding…
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add to inventory
            </>
          )}
        </button>
      </div>
    </div>
  );
}
