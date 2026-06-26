"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { Download, Search, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LABEL_FORMATS } from "@/lib/label-formats";
import type { Card } from "@/lib/types";
import type { LabelSnapshot } from "@/lib/db/label-snapshot";

type Format = keyof typeof LABEL_FORMATS;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  cards: Card[];
}

export default function ExportClient({ cards }: Props) {
  // ── Card selection ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(cards.map((c) => c.id))
  );
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q)
    );
  }, [cards, search]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  const toggleCard = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((c) => next.delete(c.id));
      } else {
        filtered.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const selectedCardIds = Array.from(selectedIds);

  // ── Export state ────────────────────────────────────────────────────────────
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [stickerFormat, setStickerFormat] = useState<Format>("avery5167");

  // ── Snapshot state ──────────────────────────────────────────────────────────
  const [snapshot, setSnapshot] = useState<LabelSnapshot | null>(null);
  const [moverThreshold, setMoverThreshold] = useState(1.0);
  const [loadingChanges, setLoadingChanges] = useState(false);
  const [loadingNewcomers, setLoadingNewcomers] = useState(false);
  const [loadingMovers, setLoadingMovers] = useState(false);
  const [loadingBoth, setLoadingBoth] = useState(false);

  useEffect(() => {
    fetch("/api/export/price-list")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setSnapshot(data as LabelSnapshot); })
      .catch(() => {});
  }, []);

  const handleDownloadInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/export/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: selectedCardIds }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "inventory.xlsx");
    } catch {
      toast.error("Failed to export inventory");
    }
    setLoadingInventory(false);
  };

  const handleDownloadPriceList = async () => {
    setLoadingPriceList(true);
    try {
      const res = await fetch("/api/export/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: selectedCardIds }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "price_list.xlsx");
      // Refresh snapshot after successful download
      const snap = await fetch("/api/export/price-list").then((r) => r.ok ? r.json() : null);
      if (snap) setSnapshot(snap as LabelSnapshot);
    } catch {
      toast.error("Failed to export price list");
    }
    setLoadingPriceList(false);
  };

  const handleDownloadStickers = async () => {
    setLoadingStickers(true);
    try {
      const res = await fetch("/api/export/stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: selectedCardIds, format: stickerFormat }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "sticker_sheet.pdf");
    } catch {
      toast.error("Failed to export stickers");
    }
    setLoadingStickers(false);
  };

  // ── Changes computation ─────────────────────────────────────────────────────
  const { newcomers, priceMovers } = useMemo(() => {
    if (!snapshot) return { newcomers: [] as Card[], priceMovers: [] as Card[] };
    const snapLookup = new Map(
      snapshot.cards.map((c) => [`${c.name.toLowerCase()}|${c.number}`, c.market_price])
    );
    const snapKeys = new Set(snapLookup.keys());
    const newcomers = cards.filter(
      (c) => !snapKeys.has(`${c.name.toLowerCase()}|${c.number}`)
    );
    const priceMovers = cards.filter((c) => {
      const key = `${c.name.toLowerCase()}|${c.number}`;
      const old = snapLookup.get(key);
      return (
        old != null &&
        c.market_price != null &&
        Math.abs(c.market_price - old) >= moverThreshold
      );
    });
    return { newcomers, priceMovers };
  }, [snapshot, cards, moverThreshold]);

  const combined = useMemo(() => {
    const seen = new Set<string>();
    return [...newcomers, ...priceMovers].filter((c) => {
      const key = `${c.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [newcomers, priceMovers]);

  const handleDownloadChanges = async (
    cardIds: number[],
    filename: string,
    setLoading: (v: boolean) => void
  ) => {
    setLoading(true);
    try {
      const res = await fetch("/api/export/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), filename);
    } catch {
      toast.error("Failed to export");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Export</h1>

      {/* Card selector */}
      <div className="rounded-lg border">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
          <button
            onClick={toggleAllFiltered}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            title={allFilteredSelected ? "Deselect all" : "Select all"}
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </button>
          <span className="text-sm font-medium">
            {selectedIds.size} / {cards.length} cards selected
          </span>
          <div className="relative w-full sm:w-56 sm:ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards…"
              className="w-full h-8 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No cards match</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((card) => (
                  <tr
                    key={card.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                    onClick={() => toggleCard(card.id)}
                  >
                    <td className="px-4 py-1.5 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(card.id)}
                        onChange={() => toggleCard(card.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="rounded"
                      />
                    </td>
                    <td className="py-1.5 pr-3">{card.name}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground w-28">{card.number || "—"}</td>
                    <td className="py-1.5 pr-4 text-right font-mono text-muted-foreground w-20">
                      {card.market_price != null ? `$${card.market_price.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Export options */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* Inventory */}
        <div className="rounded-lg border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Inventory</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Cards with market price ≤ $1 are excluded.
            </p>
          </div>
          <Button
            onClick={handleDownloadInventory}
            disabled={loadingInventory || selectedIds.size === 0}
            variant="outline"
            className="w-fit mt-auto"
          >
            <Download className="h-4 w-4" />
            {loadingInventory ? "Generating…" : "Download inventory.xlsx"}
          </Button>
        </div>

        {/* Label Printer Price List */}
        <div className="rounded-lg border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Label Printer Price List</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              One row per card per quantity, prices rounded up.
            </p>
          </div>
          <Button
            onClick={handleDownloadPriceList}
            disabled={loadingPriceList || selectedIds.size === 0}
            variant="outline"
            className="w-fit mt-auto"
          >
            <Download className="h-4 w-4" />
            {loadingPriceList ? "Generating…" : "Download price_list.xlsx"}
          </Button>
        </div>

        {/* Stickers */}
        <div className="rounded-lg border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Price Stickers (PDF)</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Printable price labels for cards with known prices.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Label format</label>
              <select
                value={stickerFormat}
                onChange={(e) => setStickerFormat(e.target.value as Format)}
                className="h-9 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white"
              >
                {Object.entries(LABEL_FORMATS).map(([key, fmt]) => (
                  <option key={key} value={key}>{fmt.label}</option>
                ))}
              </select>
            </div>
          </div>
          <Button
            onClick={handleDownloadStickers}
            disabled={loadingStickers || selectedIds.size === 0}
            variant="outline"
            className="w-fit"
          >
            <Download className="h-4 w-4" />
            {loadingStickers ? "Generating…" : "Download sticker_sheet.pdf"}
          </Button>
        </div>
      </div>

      {/* Changes Since Last Download */}
      {snapshot && (
        <div className="rounded-lg border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-base font-semibold">Changes Since Last Download</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Last downloaded:{" "}
              {new Date(snapshot.downloaded_at).toLocaleString(undefined, {
                month: "short", day: "numeric", year: "numeric",
                hour: "numeric", minute: "2-digit",
              })}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-medium whitespace-nowrap">
              Price change threshold ($)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={moverThreshold}
              onChange={(e) => setMoverThreshold(Math.max(0, parseFloat(e.target.value) || 0))}
              className="h-8 w-24 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            📦 <strong>{newcomers.length}</strong> newcomer(s) ·{" "}
            📈 <strong>{priceMovers.length}</strong> price mover(s) (±${moverThreshold.toFixed(2)}+)
          </p>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={newcomers.length === 0 || loadingNewcomers}
              onClick={() =>
                handleDownloadChanges(
                  newcomers.map((c) => c.id),
                  "newcomers.xlsx",
                  setLoadingNewcomers
                )
              }
            >
              <Download className="h-4 w-4" />
              {loadingNewcomers ? "Generating…" : `Newcomers (${newcomers.length})`}
            </Button>
            <Button
              variant="outline"
              disabled={priceMovers.length === 0 || loadingMovers}
              onClick={() =>
                handleDownloadChanges(
                  priceMovers.map((c) => c.id),
                  "price_movers.xlsx",
                  setLoadingMovers
                )
              }
            >
              <Download className="h-4 w-4" />
              {loadingMovers ? "Generating…" : `Price Movers (${priceMovers.length})`}
            </Button>
            <Button
              variant="outline"
              disabled={combined.length === 0 || loadingBoth}
              onClick={() =>
                handleDownloadChanges(
                  combined.map((c) => c.id),
                  "changes_since_last.xlsx",
                  setLoadingBoth
                )
              }
            >
              <Download className="h-4 w-4" />
              {loadingBoth ? "Generating…" : `Both (${combined.length})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
