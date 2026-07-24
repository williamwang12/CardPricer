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
  Printer,
  SlidersHorizontal,
  ArrowLeft,
  Upload,
  Loader2,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LABEL_FORMATS } from "@/lib/export/label-formats";
import { useCurrency } from "@/components/currency-context";
import { cn } from "@/lib/cn";
import type { Card } from "@/lib/types";
import type { LabelSnapshot, SnapshotSummary } from "@/lib/db/label-snapshot";
import { computeReprintQueue, REPRINT_CHANGED_EVENT } from "@/lib/reprint-queue";

type Format = keyof typeof LABEL_FORMATS;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

interface Props {
  cards: Card[];
}

export default function ExportClient({ cards }: Props) {
  const { fmt, currency, rate } = useCurrency();

  const hasCards = cards.length > 0;

  // ── Scope + selection ─────────────────────────────────────────────────────
  // Two headline scopes ("changed" / "everything"), plus an optional custom
  // fine-tuned selection that supersedes the scope when active.
  const [scope, setScope] = useState<"changed" | "everything">("changed");
  const [customIds, setCustomIds] = useState<Set<number> | null>(null);
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [minPrice, setMinPrice] = useState(1);

  // ── Export loading state ──────────────────────────────────────────────────
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [stickerFormat, setStickerFormat] = useState<Format>("avery5167");

  // ── Snapshot state (most recent snapshot only) ────────────────────────────
  const [listLoaded, setListLoaded] = useState(false);
  const [snapshotList, setSnapshotList] = useState<SnapshotSummary[]>([]);
  const [selectedSnapshotDate, setSelectedSnapshotDate] = useState<
    string | null
  >(null);
  const [snapshot, setSnapshot] = useState<LabelSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);

  // Load snapshot list on mount, auto-select the most recent.
  useEffect(() => {
    fetch("/api/export/price-list?list=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setSnapshotList(data as SnapshotSummary[]);
          setSelectedSnapshotDate(data[0].downloaded_at);
        }
      })
      .catch(() => {})
      .finally(() => setListLoaded(true));
  }, []);

  // Load the most recent snapshot's full card list. selectedSnapshotDate only
  // ever transitions null -> date, so there is no null branch to reset.
  useEffect(() => {
    if (!selectedSnapshotDate) return;
    setLoadingSnapshot(true);
    fetch(
      `/api/export/price-list?at=${encodeURIComponent(selectedSnapshotDate)}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setSnapshot(data ? (data as LabelSnapshot) : null))
      .catch(() => setSnapshot(null))
      .finally(() => setLoadingSnapshot(false));
  }, [selectedSnapshotDate]);

  // ── What changed since the last export ────────────────────────────────────
  // Shared with the Labels nav badge via computeReprintQueue — one source of
  // truth so the page count and the badge count always agree.
  const changedCards = useMemo(
    () => computeReprintQueue(cards, snapshot?.cards ?? null),
    [snapshot, cards]
  );

  const hasSnapshot = snapshotList.length > 0;
  const settled = listLoaded && !loadingSnapshot;
  const changedAvailable = hasSnapshot && changedCards.length > 0;
  const changedDisabled = settled && !changedAvailable;

  // Derive the scope actually in effect: if "only what changed" is unavailable,
  // fall back to everything without mutating the stored preference.
  const effectiveScope: "changed" | "everything" =
    scope === "changed" && changedDisabled ? "everything" : scope;
  const checkingChanged = effectiveScope === "changed" && !customIds && !settled;

  // ── Effective selection ───────────────────────────────────────────────────
  const allIdSet = useMemo(() => new Set(cards.map((c) => c.id)), [cards]);
  const changedIdSet = useMemo(
    () => new Set(changedCards.map((c) => c.id)),
    [changedCards]
  );
  const effectiveIdSet = customIds
    ? customIds
    : effectiveScope === "changed"
      ? changedIdSet
      : allIdSet;

  const effectiveCards = useMemo(
    () => cards.filter((c) => effectiveIdSet.has(c.id)),
    [cards, effectiveIdSet]
  );
  const effectiveCardIds = useMemo(
    () => effectiveCards.map((c) => c.id),
    [effectiveCards]
  );

  // Label rows the NIIMBOT file will contain: one per card per quantity.
  const labelCount = useMemo(
    () => effectiveCards.reduce((sum, c) => sum + c.quantity, 0),
    [effectiveCards]
  );

  // ── Fine-tune selection helpers (operate on the custom set) ───────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q)
    );
  }, [cards, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((c) => effectiveIdSet.has(c.id));

  const toggleCard = (id: number) => {
    const base = new Set(customIds ?? effectiveIdSet);
    if (base.has(id)) base.delete(id);
    else base.add(id);
    setCustomIds(base);
  };

  const toggleAllFiltered = () => {
    const base = new Set(customIds ?? effectiveIdSet);
    if (allFilteredSelected) filtered.forEach((c) => base.delete(c.id));
    else filtered.forEach((c) => base.add(c.id));
    setCustomIds(base);
  };

  const uncheckAll = () => setCustomIds(new Set());

  const selectAbovePrice = () =>
    setCustomIds(
      new Set(
        cards
          .filter((c) => c.market_price != null && c.market_price >= minPrice)
          .map((c) => c.id)
      )
    );

  const selectScope = (next: "changed" | "everything") => {
    setScope(next);
    setCustomIds(null);
  };

  // ── Downloads ─────────────────────────────────────────────────────────────
  const handleDownloadPriceList = async () => {
    setLoadingPriceList(true);
    try {
      const res = await fetch("/api/export/price-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: effectiveCardIds, currency, rate }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "price_list.xlsx");
      // Refresh the snapshot list so "what changed" resets against this export.
      const list = await fetch("/api/export/price-list?list=1").then((r) =>
        r.ok ? r.json() : null
      );
      if (list && Array.isArray(list) && list.length > 0) {
        setSnapshotList(list as SnapshotSummary[]);
        setSelectedSnapshotDate(list[0].downloaded_at);
      }
      // Tell the Labels nav badge to refetch — the export just re-snapshotted.
      window.dispatchEvent(new Event(REPRINT_CHANGED_EVENT));
      toast.success("Spreadsheet ready", {
        description:
          "In NIIMBOT: Import, choose this file, select your label template, then Print all.",
      });
    } catch {
      toast.error("Failed to export labels");
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
          cardIds: effectiveCardIds,
          format: stickerFormat,
          currency,
          rate,
        }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "sticker_sheet.pdf");
      toast.success("Sticker sheet ready");
    } catch {
      toast.error("Failed to export stickers");
    }
    setLoadingStickers(false);
  };

  const handleDownloadInventory = async () => {
    setLoadingInventory(true);
    try {
      const res = await fetch("/api/export/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardIds: effectiveCardIds, currency, rate }),
      });
      if (!res.ok) throw new Error();
      downloadBlob(await res.blob(), "inventory.xlsx");
      toast.success("Inventory spreadsheet ready");
    } catch {
      toast.error("Failed to export inventory");
    }
    setLoadingInventory(false);
  };

  const noSelection = effectiveCards.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-heading text-xl font-semibold">Labels</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Choose where your prices are going.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/inventory">
            <ArrowLeft className="h-4 w-4" />
            Back to Inventory
          </Link>
        </Button>
      </div>

      {/* Primary: NIIMBOT labels */}
      <div className="rounded-xl border-2 border-primary bg-card p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
            <Printer className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading text-base font-semibold">
                NIIMBOT labels
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary leading-none">
                Label printing
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Downloads a spreadsheet for NIIMBOT&apos;s batch print. In the
              NIIMBOT app: Import, choose the file, pick your template, then
              Print all.
            </p>
          </div>
        </div>

        {!hasCards ? (
          <div className="rounded-lg border border-dashed p-6 flex flex-col items-center text-center gap-3">
            <p className="text-sm text-muted-foreground max-w-sm">
              Import your inventory first to start printing labels.
            </p>
            <Button asChild>
              <Link href="/import">
                <Upload className="h-4 w-4" />
                Import your inventory
              </Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Scope selector */}
            <div className="flex flex-col gap-2">
              <ScopeOption
                selected={!customIds && effectiveScope === "changed"}
                disabled={changedDisabled}
                onSelect={() => selectScope("changed")}
                title="Only what changed"
                subtitle={
                  checkingChanged
                    ? "Checking what changed since your last export..."
                    : !hasSnapshot
                      ? "After this export, we'll track what changes."
                      : changedCards.length > 0
                        ? `${plural(
                            changedCards.length,
                            "card"
                          )} new or moved since your last export`
                        : "Nothing to reprint. No price moves since your last export."
                }
              />
              <ScopeOption
                selected={!customIds && effectiveScope === "everything"}
                onSelect={() => selectScope("everything")}
                title="Everything"
                subtitle={`All ${plural(cards.length, "card")} in your inventory`}
              />
              {customIds && (
                <ScopeOption
                  selected
                  onSelect={() => {}}
                  title="Custom"
                  subtitle={`${plural(customIds.size, "card")} selected`}
                />
              )}
            </div>

            {/* Primary download */}
            <Button
              size="lg"
              className="w-full"
              onClick={handleDownloadPriceList}
              disabled={loadingPriceList || noSelection || checkingChanged}
            >
              {loadingPriceList ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {loadingPriceList
                ? "Exporting..."
                : checkingChanged
                  ? "Checking what changed..."
                  : `Export ${plural(labelCount, "label")}`}
            </Button>
            <p className="text-xs text-muted-foreground text-center -mt-1">
              Saves a snapshot, so your next export knows what changed.
            </p>

            {/* Fine-tune selection */}
            <div>
              <button
                onClick={() => setFineTuneOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Fine-tune selection
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    fineTuneOpen && "rotate-180"
                  )}
                />
              </button>

              {fineTuneOpen && (
                <div className="mt-3 rounded-lg border">
                  <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 border-b">
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
                    <div className="relative flex-1 min-w-[10rem] max-w-xs">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search cards..."
                        className="w-full h-8 rounded-md border border-input pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
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
                      <button
                        onClick={uncheckAll}
                        className="text-xs px-2.5 py-1.5 rounded-md border border-input hover:bg-muted transition-colors"
                      >
                        Clear
                      </button>
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
                              <td className="px-3 py-1.5 w-10">
                                <input
                                  type="checkbox"
                                  checked={effectiveIdSet.has(card.id)}
                                  onChange={() => toggleCard(card.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded"
                                />
                              </td>
                              <td className="py-1.5 pr-3 font-medium">
                                {card.name}
                              </td>
                              <td className="py-1.5 pr-3 text-muted-foreground w-28">
                                {card.number || "—"}
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
              )}
            </div>
          </>
        )}
      </div>

      {/* Other exports */}
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Other exports
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {/* Avery sticker sheet */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Tag className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">Avery sticker sheet</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                A ready-to-print PDF for Avery label sheets on a regular
                printer. No NIIMBOT needed.
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
            disabled={loadingStickers || noSelection}
            variant="outline"
            className="w-full mt-auto"
          >
            {loadingStickers ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loadingStickers ? "Generating..." : "PDF"}
          </Button>
        </div>

        {/* Full inventory spreadsheet */}
        <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold">
                Full inventory spreadsheet
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Every card and price in one file, for your records, taxes, or
                working in Excel. Cards priced $1 or under are left out.
              </p>
            </div>
          </div>
          <Button
            onClick={handleDownloadInventory}
            disabled={loadingInventory || noSelection}
            variant="outline"
            className="w-full mt-auto"
          >
            {loadingInventory ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {loadingInventory ? "Generating..." : "Download .xlsx"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Scope radio option ───────────────────────────────────────────────────────
function ScopeOption({
  selected,
  disabled,
  onSelect,
  title,
  subtitle,
}: {
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-primary bg-primary/5"
          : "border-input hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
          selected ? "border-primary" : "border-muted-foreground/40"
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
