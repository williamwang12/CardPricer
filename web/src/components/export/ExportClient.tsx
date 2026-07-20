"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  Download,
  Search,
  CheckSquare,
  Square,
  FileSpreadsheet,
  Tag,
  TrendingUp,
  Sparkles,
  ArrowLeft,
  Loader2,
  Calendar,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LABEL_FORMATS } from "@/lib/export/label-formats";
import { useCurrency } from "@/components/currency-context";
import { cn } from "@/lib/cn";
import type { Card } from "@/lib/types";
import type { LabelSnapshot, SnapshotSummary } from "@/lib/db/label-snapshot";

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
  const { fmt, currency, rate } = useCurrency();

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

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

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

  const uncheckAll = () => setSelectedIds(new Set());

  const [minPrice, setMinPrice] = useState(1);
  const selectAbovePrice = () => {
    setSelectedIds(
      new Set(
        cards
          .filter((c) => c.market_price != null && c.market_price >= minPrice)
          .map((c) => c.id)
      )
    );
  };

  const selectedCardIds = Array.from(selectedIds);

  const selectedValue = useMemo(
    () =>
      cards
        .filter((c) => selectedIds.has(c.id))
        .reduce((sum, c) => sum + (c.market_price ?? 0) * c.quantity, 0),
    [cards, selectedIds]
  );

  // ── Export state ────────────────────────────────────────────────────────────
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [stickerFormat, setStickerFormat] = useState<Format>("avery5167");

  // ── Snapshot state ──────────────────────────────────────────────────────────
  const [snapshotList, setSnapshotList] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState<
    string | null
  >(null);
  const [snapshot, setSnapshot] = useState<LabelSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [moverThreshold, setMoverThreshold] = useState(1.0);
  const [loadingNewcomers, setLoadingNewcomers] = useState(false);
  const [loadingMovers, setLoadingMovers] = useState(false);
  const [loadingBoth, setLoadingBoth] = useState(false);

  // Load snapshot list on mount
  useEffect(() => {
    fetch("/api/export/price-list?list=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setSnapshotList(data as SnapshotSummary[]);
          // Auto-select the most recent snapshot
          setSelectedSnapshotDate(data[0].downloaded_at);
        }
      })
      .catch(() => {});
  }, []);

  // Load the selected snapshot's full data
  useEffect(() => {
    if (!selectedSnapshotDate) {
      setSnapshot(null);
      return;
    }
    setLoadingSnapshot(true);
    fetch(
      `/api/export/price-list?at=${encodeURIComponent(selectedSnapshotDate)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSnapshot(data as LabelSnapshot);
        else setSnapshot(null);
      })
      .catch(() => setSnapshot(null))
      .finally(() => setLoadingSnapshot(false));
  }, [selectedSnapshotDate]);

  const handleDownloadInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/export/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: selectedCardIds, currency, rate }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "inventory.xlsx");
      toast.success("Inventory exported");
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
        body: JSON.stringify({ cardIds: selectedCardIds, currency, rate }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "price_list.xlsx");
      // Refresh the snapshot list to include the new export
      const list = await fetch("/api/export/price-list?list=1").then((r) =>
        r.ok ? r.json() : null
      );
      if (list && Array.isArray(list) && list.length > 0) {
        setSnapshotList(list as SnapshotSummary[]);
        setSelectedSnapshotDate(list[0].downloaded_at);
      }
      toast.success("Price list exported");
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
        body: JSON.stringify({
          cardIds: selectedCardIds,
          format: stickerFormat,
          currency,
          rate,
        }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "sticker_sheet.pdf");
      toast.success("Stickers exported");
    } catch {
      toast.error("Failed to export stickers");
    }
    setLoadingStickers(false);
  };

  // ── Changes computation ─────────────────────────────────────────────────────
  const { newcomers, priceMovers } = useMemo(() => {
    if (!snapshot)
      return { newcomers: [] as Card[], priceMovers: [] as Card[] };
    const snapLookup = new Map(
      snapshot.cards.map((c) => [
        `${c.name.toLowerCase()}|${c.number}`,
        c.market_price,
      ])
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
        body: JSON.stringify({ cardIds, currency, rate }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), filename);
      toast.success("Changes exported");
    } catch {
      toast.error("Failed to export");
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-semibold">Export</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Download your inventory as spreadsheets, price lists, or printable
            sticker sheets.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      {/* Selection summary bar */}
      <div className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">
              {selectedIds.size} of {cards.length} cards selected
            </p>
            <p className="text-xs text-muted-foreground">
              Selected value: {fmt(selectedValue)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={uncheckAll}
            className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
          >
            Uncheck All
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onClick={selectAbovePrice}
              className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors whitespace-nowrap"
            >
              Select &ge; ${minPrice}
            </button>
            <input
              type="number"
              min={0}
              step={1}
              value={minPrice}
              onChange={(e) =>
                setMinPrice(Math.max(0, parseFloat(e.target.value) || 0))
              }
              className="h-7 w-16 rounded-md border border-input px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Card selector */}
      <div className="rounded-xl border">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
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
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cards..."
              className="w-full h-8 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No cards match
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {filtered.map((card) => (
                  <tr
                    key={card.id}
                    className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
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
                    <td className="py-1.5 pr-3 font-medium">{card.name}</td>
                    <td className="py-1.5 pr-3 text-muted-foreground w-28">
                      {card.number || "\u2014"}
                    </td>
                    <td className="py-1.5 pr-4 text-right font-mono text-muted-foreground w-20">
                      {fmt(card.market_price)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Export options */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Export Formats
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Inventory */}
        <ExportCard
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Inventory"
          description="Full inventory spreadsheet. Cards with market price &le; $1 are excluded."
          filename="inventory.xlsx"
          loading={loadingInventory}
          disabled={selectedIds.size === 0}
          onDownload={handleDownloadInventory}
        />

        {/* Label Printer Price List */}
        <ExportCard
          icon={<Tag className="h-5 w-5" />}
          title="Price List"
          description="One row per card per quantity with prices rounded up. Designed for label printers. Saves a snapshot for tracking changes."
          filename="price_list.xlsx"
          loading={loadingPriceList}
          disabled={selectedIds.size === 0}
          onDownload={handleDownloadPriceList}
          featured
        />

        {/* Stickers */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold">Price Stickers</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Printable price labels for cards with known prices.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Label format
            </label>
            <select
              value={stickerFormat}
              onChange={(e) => setStickerFormat(e.target.value as Format)}
              className="h-9 w-full rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white"
            >
              {Object.entries(LABEL_FORMATS).map(([key, f]) => (
                <option key={key} value={key}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleDownloadStickers}
            disabled={loadingStickers || selectedIds.size === 0}
            variant="outline"
            className="w-full mt-auto"
          >
            {loadingStickers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loadingStickers ? "Generating..." : "sticker_sheet.pdf"}
          </Button>
        </div>
      </div>

      {/* Changes Since Download */}
      {snapshotList.length > 0 && (
        <>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Changes Since Download
          </h2>
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* Snapshot timeline */}
            <div className="border-b px-5 py-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold">
                    Export History
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select a snapshot to compare against your current inventory.
                  </p>
                </div>
              </div>

              {/* Snapshot selector */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Compare against
                </label>
                <div className="relative w-full sm:w-80">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <select
                    value={selectedSnapshotDate ?? ""}
                    onChange={(e) =>
                      setSelectedSnapshotDate(e.target.value || null)
                    }
                    className="w-full h-9 rounded-md border border-input pl-8 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring bg-white appearance-none"
                  >
                    {snapshotList.map((s) => (
                      <option key={s.downloaded_at} value={s.downloaded_at}>
                        {formatSnapshotDate(s.downloaded_at)} ({s.card_count}{" "}
                        cards)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Snapshot timeline chips (last 5) */}
              {snapshotList.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {snapshotList.slice(0, 8).map((s) => {
                    const isSelected =
                      selectedSnapshotDate === s.downloaded_at;
                    return (
                      <button
                        key={s.downloaded_at}
                        onClick={() =>
                          setSelectedSnapshotDate(s.downloaded_at)
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input hover:bg-muted"
                        )}
                      >
                        {formatSnapshotDateShort(s.downloaded_at)}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Diff results */}
            <div className="px-5 py-4 flex flex-col gap-4">
              {loadingSnapshot ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    Loading snapshot...
                  </span>
                </div>
              ) : snapshot ? (
                <>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                      Price change threshold
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-muted-foreground">$</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={moverThreshold}
                        onChange={(e) =>
                          setMoverThreshold(
                            Math.max(0, parseFloat(e.target.value) || 0)
                          )
                        }
                        className="h-8 w-20 rounded-md border border-input px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-blue-500" />
                      <strong>{newcomers.length}</strong> newcomer(s)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                      <strong>{priceMovers.length}</strong> price mover(s)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={newcomers.length === 0 || loadingNewcomers}
                      onClick={() =>
                        handleDownloadChanges(
                          newcomers.map((c) => c.id),
                          "newcomers.xlsx",
                          setLoadingNewcomers
                        )
                      }
                    >
                      {loadingNewcomers ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Newcomers ({newcomers.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={priceMovers.length === 0 || loadingMovers}
                      onClick={() =>
                        handleDownloadChanges(
                          priceMovers.map((c) => c.id),
                          "price_movers.xlsx",
                          setLoadingMovers
                        )
                      }
                    >
                      {loadingMovers ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Price Movers ({priceMovers.length})
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={combined.length === 0 || loadingBoth}
                      onClick={() =>
                        handleDownloadChanges(
                          combined.map((c) => c.id),
                          "changes_since_last.xlsx",
                          setLoadingBoth
                        )
                      }
                    >
                      {loadingBoth ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="h-3.5 w-3.5" />
                      )}
                      Both ({combined.length})
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Could not load this snapshot.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Date formatting helpers ──────────────────────────────────────────────────
function formatSnapshotDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSnapshotDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// ── Reusable export option card ──────────────────────────────────────────────
function ExportCard({
  icon,
  title,
  description,
  filename,
  loading,
  disabled,
  onDownload,
  featured,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  filename: string;
  loading: boolean;
  disabled: boolean;
  onDownload: () => void;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 flex flex-col gap-4 ${
        featured ? "border-primary ring-1 ring-primary/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {featured && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground leading-none">
                Popular
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Button
        onClick={onDownload}
        disabled={loading || disabled}
        variant={featured ? "default" : "outline"}
        className="w-full mt-auto"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {loading ? "Generating..." : filename}
      </Button>
    </div>
  );
}
