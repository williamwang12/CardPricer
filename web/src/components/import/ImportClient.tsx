"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import {
  Upload,
  RotateCcw,
  PenLine,
  FileSpreadsheet,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  parseTcgPlayerCsv,
  parseDeckTradrCsv,
  parseCollectrCsv,
} from "@/lib/export/parse-csv";
import {
  addCardAction,
  rollbackImportAction,
} from "@/actions/cards";
import { upsertCardAction, removeStaleCardsAction, refreshPricesAction } from "@/actions/sync";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { useCurrency } from "@/components/currency-context";
import type { CardInput } from "@/lib/types";

type Tab = "manual" | "tcgplayer" | "decktradr" | "collectr";

const TABS: {
  id: Tab;
  label: string;
  icon: typeof PenLine;
  method: string;
  behavior: string;
}[] = [
  {
    id: "collectr",
    label: "Collectr CSV",
    icon: RefreshCw,
    method: "Upload to sync: updates existing cards and adds new ones.",
    behavior: "Matches cards by name + number: updates quantities, adds new cards, and (unless \u201cAdd only\u201d is checked) removes cards missing from the file. Prices refresh automatically afterward.",
  },
  {
    id: "decktradr",
    label: "DeckTradr CSV",
    icon: FileSpreadsheet,
    method: "Upload a DeckTradr export.",
    behavior: "Adds every row to your inventory. Existing cards are untouched, and you can roll back the whole import with one click.",
  },
  {
    id: "tcgplayer",
    label: "TCGPlayer CSV",
    icon: FileSpreadsheet,
    method: "Upload a TCGPlayer collection export.",
    behavior: "Adds every row to your inventory. Existing cards are untouched, and you can roll back the whole import with one click.",
  },
  {
    id: "manual",
    label: "Manual",
    icon: PenLine,
    method: "Browse the catalog and add cards individually.",
    behavior: "Adds one card at a time from the catalog page. Nothing else is changed.",
  },
];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ── Manual add tab ───────────────────────────────────────────────────────────
function ManualTab() {
  return (
    <div className="flex flex-col gap-4 max-w-sm">
      <p className="text-sm text-muted-foreground">
        Browse the full catalog to find and add cards to your inventory one at a
        time.
      </p>
      <Button asChild className="w-fit">
        <Link href="/catalog">
          Go to Catalog
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

// ── CSV import tab (TCGPlayer / DeckTradr) ───────────────────────────────────
function CsvTab({
  type,
  description,
}: {
  type: "tcgplayer" | "decktradr";
  description: string;
}) {
  const { fmt } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<CardInput[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [lastImport, setLastImport] = useState<CardInput[] | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const parsed =
        type === "tcgplayer"
          ? parseTcgPlayerCsv(text)
          : parseDeckTradrCsv(text);
      setPreview(parsed);
    } catch {
      toast.error("Failed to parse CSV");
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    setProgress(0);
    const imported: CardInput[] = [];

    for (let i = 0; i < preview.length; i++) {
      const card = preview[i];
      setProgressLabel(`${card.name} (${i + 1}/${preview.length})`);

      try {
        await addCardAction(card);
        imported.push({ name: card.name, number: card.number, quantity: card.quantity });
      } catch {
        // continue
      }

      setProgress(((i + 1) / preview.length) * 100);
    }

    setImporting(false);
    setProgressLabel("");
    setLastImport(imported);
    setPreview([]);
    if (fileRef.current) fileRef.current.value = "";
    toast.success(`Imported ${imported.length} card(s)`);
  };

  const handleRollback = async () => {
    if (!lastImport) return;
    try {
      const count = await rollbackImportAction(lastImport);
      toast.success(`Rolled back ${count} card(s)`);
      setLastImport(null);
    } catch {
      toast.error("Rollback failed");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 w-fit cursor-pointer">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
          />
          <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Choose CSV file
          </Button>
        </label>
      </div>

      {preview.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="rounded-lg border overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground w-28">Number</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground w-16">Qty</th>
                  <th className="h-8 px-3 text-right font-medium text-muted-foreground w-20">Price</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{c.name}</td>
                    <td className="px-3 py-1.5">{c.number || "—"}</td>
                    <td className="px-3 py-1.5">{c.quantity}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {fmt(c.market_price ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {preview.length} card(s) found{preview.length > 100 ? " (showing first 100)" : ""}
          </p>

          {importing && (
            <div className="flex flex-col gap-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
          )}

          <Button onClick={handleImport} disabled={importing} className="w-fit">
            {importing ? "Importing…" : `Import ${preview.length} cards`}
          </Button>
        </div>
      )}

      {lastImport && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRollback}
          className="w-fit text-destructive border-destructive/30 hover:bg-destructive/10"
        >
          <RotateCcw className="h-4 w-4" />
          Rollback last import ({lastImport.length} cards)
        </Button>
      )}
    </div>
  );
}

// ── Collectr tab ─────────────────────────────────────────────────────────────
function CollectrTab() {
  const { fmt } = useCurrency();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cards, setCards] = useState<CardInput[]>([]);
  const [addOnly, setAddOnly] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<{
    matched: number;
    added: number;
    removed: number;
  } | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const parsed = parseCollectrCsv(text);
      setCards(parsed);
      setResult(null);
    } catch {
      toast.error("Failed to parse CSV");
    }
  };

  const handleSync = async () => {
    if (!cards.length) return;
    setSyncing(true);
    setProgress(0);

    // Merge duplicates (same name+number, different grade)
    const merged = new Map<string, CardInput>();
    for (const cc of cards) {
      const key = `${cc.name.toLowerCase()}\0${cc.number}`;
      const prev = merged.get(key);
      if (prev) {
        prev.quantity += cc.quantity;
      } else {
        merged.set(key, { ...cc });
      }
    }

    const mergedCards = Array.from(merged.values());
    const mergedKeys = Array.from(merged.keys());
    let matched = 0;
    let added = 0;

    for (let i = 0; i < mergedCards.length; i++) {
      const card = mergedCards[i];
      setProgressLabel(`${card.name} (${i + 1}/${mergedCards.length})`);
      try {
        const result = await upsertCardAction(card);
        if (result === "matched") matched++;
        else added++;
      } catch {
        // continue
      }
      setProgress(((i + 1) / mergedCards.length) * 100);
    }

    let removed = 0;
    if (!addOnly) {
      setProgressLabel("Removing stale cards…");
      try {
        removed = await removeStaleCardsAction(mergedKeys);
      } catch {
        // continue
      }
    }

    // Refreshing prices can take several seconds with no incremental
    // progress to report, so cycle reassuring status messages to signal
    // the sync is still running rather than appearing to hang.
    const refreshMessages = [
      "Refreshing prices…",
      "Still refreshing prices…",
      "Fetching latest market data…",
      "Almost there…",
    ];
    let refreshMsgIndex = 0;
    setProgressLabel(refreshMessages[0]);
    const refreshInterval = setInterval(() => {
      refreshMsgIndex = (refreshMsgIndex + 1) % refreshMessages.length;
      setProgressLabel(refreshMessages[refreshMsgIndex]);
    }, 2500);
    try {
      await refreshPricesAction();
    } catch {
      // continue
    } finally {
      clearInterval(refreshInterval);
    }

    setSyncing(false);
    setProgressLabel("");
    setResult({ matched, added, removed });
    setCards([]);
    if (fileRef.current) fileRef.current.value = "";
    toast.success(
      `Synced: ${matched} updated, ${added} added, ${removed} removed`
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Upload your Collectr CSV export to sync your inventory. Full sync
        removes cards not in the export; Add-only mode preserves existing cards.
      </p>

      <label className="flex items-center gap-2 w-fit cursor-pointer">
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFile}
          className="hidden"
        />
        <Button variant="outline" size="sm" type="button" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Choose CSV file
        </Button>
      </label>

      {cards.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="radio"
                name="collectr-mode"
                checked={!addOnly}
                onChange={() => setAddOnly(false)}
              />
              Full sync (add &amp; remove)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input
                type="radio"
                name="collectr-mode"
                checked={addOnly}
                onChange={() => setAddOnly(true)}
              />
              Add only (keep existing)
            </label>
          </div>

          <div className="rounded-lg border overflow-x-auto max-h-64">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground w-28">Number</th>
                  <th className="h-8 px-3 text-left font-medium text-muted-foreground w-16">Qty</th>
                  <th className="h-8 px-3 text-right font-medium text-muted-foreground w-20">Price</th>
                </tr>
              </thead>
              <tbody>
                {cards.slice(0, 100).map((c, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5">{c.name}</td>
                    <td className="px-3 py-1.5">{c.number || "—"}</td>
                    <td className="px-3 py-1.5">{c.quantity}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {fmt(c.market_price ?? null)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            {cards.length} card(s) found{cards.length > 100 ? " (showing first 100)" : ""}
          </p>

          {syncing && (
            <div className="flex flex-col gap-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
            </div>
          )}

          <Button onClick={handleSync} disabled={syncing} className="w-fit">
            {syncing ? "Syncing…" : `Sync ${cards.length} cards`}
          </Button>
        </div>
      )}

      {result && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm">
          <span className="font-medium">{result.matched}</span> updated ·{" "}
          <span className="font-medium">{result.added}</span> added ·{" "}
          <span className="font-medium">{result.removed}</span> removed
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportClient() {
  const [activeTab, setActiveTab] = useState<Tab>("collectr");
  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-xl font-semibold">Import & Update Inventory</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Import new cards or re-upload a file to update quantities and sync your inventory.
        </p>
      </div>

      {/* How updating works */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "text-left rounded-xl border p-4 flex flex-col gap-2 transition-colors",
                isActive
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold">{tab.label}</p>
              <p className="text-xs text-muted-foreground">{tab.method}</p>
            </button>
          );
        })}
      </div>

      {/* How this updates your inventory */}
      <div className="rounded-xl bg-muted p-4 flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 text-primary p-1.5 flex-shrink-0">
          <active.icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{active.label}: how it updates your inventory</p>
          <p className="text-sm text-muted-foreground mt-0.5">{active.behavior}</p>
        </div>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "manual" && <ManualTab />}
        {activeTab === "tcgplayer" && (
          <CsvTab
            type="tcgplayer"
            description='Upload a TCGPlayer collection export CSV. Expected columns: "Product Name", "Number", "TCG Market Price".'
          />
        )}
        {activeTab === "decktradr" && (
          <CsvTab
            type="decktradr"
            description='Upload a DeckTradr export CSV. Expected columns: "Card Name", "Number", "Quantity".'
          />
        )}
        {activeTab === "collectr" && <CollectrTab />}
      </div>
    </div>
  );
}
