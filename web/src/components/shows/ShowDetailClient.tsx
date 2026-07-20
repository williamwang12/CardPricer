"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  TrendingUp,
  TrendingDown,
  Package,
  ShoppingCart,
  Loader2,
  CheckCircle2,
  Circle,
  Upload,
  Tag,
  ClipboardCheck,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import { takeSnapshotAction, finalizeShowAction } from "@/actions/shows";
import { diffShowSnapshots } from "@/lib/diff";
import { useCurrency } from "@/components/currency-context";
import type { Show, ShowSnapshot, ShowDiffResult } from "@/lib/types";

interface Props {
  show: Show;
  initialPre: ShowSnapshot | null;
  initialPost: ShowSnapshot | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface ChecklistStep {
  id: string;
  title: string;
  description: string;
  done: boolean;
  doneLabel?: string;
  action?: React.ReactNode;
}

export default function ShowDetailClient({ show, initialPre, initialPost }: Props) {
  const { fmt } = useCurrency();
  const [pre, setPre] = useState(initialPre);
  const [post, setPost] = useState(initialPost);
  const [takingPre, setTakingPre] = useState(false);
  const [takingPost, setTakingPost] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeProgress, setFinalizeProgress] = useState(0);
  const [finalized, setFinalized] = useState(!!show.finalized_at);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, []);

  const diff: ShowDiffResult | null = useMemo(() => {
    if (!pre || !post) return null;
    return diffShowSnapshots(pre.cards, post.cards);
  }, [pre, post]);

  const profit = useMemo(() => {
    if (!diff) return null;
    const fee = show.table_fee != null ? Number(show.table_fee) : 0;
    return diff.revenue - fee;
  }, [diff, show.table_fee]);

  const handleTakeSnapshot = async (type: "pre" | "post") => {
    const setter = type === "pre" ? setTakingPre : setTakingPost;
    setter(true);
    try {
      const snapshot = await takeSnapshotAction(show.id, type);
      if (type === "pre") setPre(snapshot);
      else setPost(snapshot);
      toast.success(
        `${type === "pre" ? "Pre-show" : "Post-show"} snapshot saved (${snapshot.cards.length} cards)`
      );
    } catch {
      toast.error("Failed to take snapshot");
    }
    setter(false);
  };

  const handleFinalize = async () => {
    if (finalized || finalizing) return;
    setFinalizing(true);
    setFinalizeProgress(8);

    progressTimer.current = setInterval(() => {
      setFinalizeProgress((p) => (p >= 90 ? p : p + Math.random() * 12));
    }, 250);

    try {
      await finalizeShowAction(show.id);
      setFinalizeProgress(100);
      setFinalized(true);
      toast.success("Show finalized — shelf-life counters updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to finalize show"
      );
    } finally {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
        progressTimer.current = null;
      }
      setFinalizing(false);
    }
  };

  // Build checklist steps
  const steps: ChecklistStep[] = [
    {
      id: "sync",
      title: "Sync your inventory",
      description: "Make sure your inventory is up to date before the show.",
      done: false, // no way to track this automatically — always available
      action: (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/inventory">
              <Package className="h-3.5 w-3.5" />
              Inventory
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/import">
              <Upload className="h-3.5 w-3.5" />
              Import
            </Link>
          </Button>
        </div>
      ),
    },
    {
      id: "labels",
      title: "Export price labels",
      description: "Print price stickers for your cards to display at the show.",
      done: false, // always available
      action: (
        <Button size="sm" variant="outline" asChild>
          <Link href="/export">
            <Tag className="h-3.5 w-3.5" />
            Go to Export
            <ExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      ),
    },
    {
      id: "pre-snapshot",
      title: "Pre-show snapshot",
      description: pre
        ? `Snapshot taken ${formatTimestamp(pre.created_at)} (${pre.cards.length} cards).`
        : "Auto-taken the day before or day of the show. You can also take one manually.",
      done: !!pre,
      doneLabel: pre ? `${pre.cards.length} cards snapshotted` : undefined,
      action: (
        <Button
          size="sm"
          variant={pre ? "outline" : "default"}
          onClick={() => handleTakeSnapshot("pre")}
          disabled={takingPre}
        >
          {takingPre ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {pre ? "Retake" : "Take Snapshot"}
        </Button>
      ),
    },
    {
      id: "post-snapshot",
      title: "Take post-show snapshot",
      description: post
        ? `Snapshot taken ${formatTimestamp(post.created_at)} (${post.cards.length} cards).`
        : "Capture your inventory after the show to see what sold.",
      done: !!post,
      doneLabel: post ? `${post.cards.length} cards snapshotted` : undefined,
      action: (
        <Button
          size="sm"
          variant={post ? "outline" : "default"}
          onClick={() => handleTakeSnapshot("post")}
          disabled={takingPost}
        >
          {takingPost ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Camera className="h-3.5 w-3.5" />
          )}
          {post ? "Retake" : "Take Snapshot"}
        </Button>
      ),
    },
    {
      id: "sync-after",
      title: "Sync inventory after show",
      description: "Update your inventory to reflect sales and any new cards acquired at the show.",
      done: false,
      action: (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/inventory">
              <Package className="h-3.5 w-3.5" />
              Inventory
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/import">
              <Upload className="h-3.5 w-3.5" />
              Import
            </Link>
          </Button>
        </div>
      ),
    },
    {
      id: "finalize",
      title: "Finalize show",
      description: finalized
        ? "Show finalized — shelf-life counters have been updated."
        : "Finalize to update shelf-life counters for dead inventory tracking. This can only be done once.",
      done: finalized,
      doneLabel: "Finalized",
      action: !finalized ? (
        <Button
          size="sm"
          onClick={handleFinalize}
          disabled={finalizing || !pre || !post}
        >
          {finalizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ClipboardCheck className="h-3.5 w-3.5" />
          )}
          {finalizing ? "Finalizing…" : "Finalize Show"}
        </Button>
      ) : undefined,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;
  // Sync and labels are always "available" steps, not truly completable
  const trackableSteps = steps.filter((s) =>
    ["pre-snapshot", "post-snapshot", "finalize"].includes(s.id)
  );
  const trackableCompleted = trackableSteps.filter((s) => s.done).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/shows">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          <h1 className="font-heading text-xl font-semibold truncate">{show.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatDate(show.date)}
            {show.date_end && ` – ${formatDate(show.date_end)}`}
            {show.table_fee != null && ` · $${Number(show.table_fee).toFixed(2)} table fee`}
          </p>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            "flex-shrink-0",
            finalized && "text-green-700 bg-green-50 border-green-200"
          )}
        >
          {trackableCompleted}/{trackableSteps.length} complete
        </Badge>
      </div>

      {show.notes && (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          {show.notes}
        </p>
      )}

      {/* Checklist */}
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold mb-2">Show Checklist</h2>
        <div className="rounded-lg border bg-white divide-y">
          {steps.map((step, i) => {
            const isPrereqMet =
              step.id !== "finalize" || (!!pre && !!post);

            return (
              <div
                key={step.id}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5",
                  step.done && "bg-muted/20"
                )}
              >
                {/* Step indicator */}
                <div className="flex-shrink-0 mt-0.5">
                  {step.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <div className="relative">
                      <Circle className="h-5 w-5 text-muted-foreground/30" />
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        step.done && "text-muted-foreground line-through"
                      )}
                    >
                      {step.title}
                    </span>
                    {step.done && step.doneLabel && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-green-700 bg-green-50 border-green-200">
                        {step.doneLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>

                {/* Action */}
                {step.action && (
                  <div className="flex-shrink-0">
                    {step.action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Finalize progress bar */}
      {finalizing && (
        <Progress value={finalizeProgress} className="h-2" />
      )}

      {/* Diff Report */}
      {diff && (
        <>
          <h2 className="text-sm font-semibold">Sales Report</h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Cards Sold
              </div>
              <span className="text-lg font-semibold">{diff.sold.length}</span>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                Acquired
              </div>
              <span className="text-lg font-semibold">{diff.acquired.length}</span>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                Revenue
              </div>
              <span className="text-lg font-semibold">{fmt(diff.revenue)}</span>
            </div>
            <div className="rounded-lg border p-3 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {profit != null && profit >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                )}
                Profit
              </div>
              <span
                className={`text-lg font-semibold ${
                  profit != null && profit < 0 ? "text-red-500" : ""
                }`}
              >
                {fmt(profit)}
              </span>
            </div>
          </div>

          {/* Sold Cards Table */}
          {diff.sold.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                Sold ({diff.sold.length})
              </h2>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Number</th>
                      <th className="text-right px-4 py-2 font-medium w-20">Qty Sold</th>
                      <th className="text-right px-4 py-2 font-medium w-28">Price</th>
                      <th className="text-right px-4 py-2 font-medium w-28">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.sold.map((card, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-1.5">{card.name}</td>
                        <td className="px-4 py-1.5 text-muted-foreground">
                          {card.number || "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right">
                          {card.qty_sold}
                          {card.qty_before > card.qty_sold && (
                            <span className="text-muted-foreground"> / {card.qty_before}</span>
                          )}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                          {fmt(card.market_price)}
                        </td>
                        <td className="px-4 py-1.5 text-right font-mono">
                          {card.market_price != null
                            ? fmt(card.qty_sold * card.market_price)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Acquired Cards Table */}
          {diff.acquired.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-blue-600" />
                Acquired at Show ({diff.acquired.length})
              </h2>
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium w-20">Number</th>
                      <th className="text-right px-4 py-2 font-medium w-20">Qty</th>
                      <th className="text-right px-4 py-2 font-medium w-28">Market Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.acquired.map((card, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-1.5">{card.name}</td>
                        <td className="px-4 py-1.5 text-muted-foreground">
                          {card.number || "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right">{card.quantity}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                          {fmt(card.market_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unsold count */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            {diff.unsold.length} cards unsold
          </div>
        </>
      )}

      {/* No diff yet */}
      {!diff && pre && !post && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Take a post-show snapshot after the show to see your sales report.
        </p>
      )}
      {!diff && !pre && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Complete the checklist above to track your show performance.
        </p>
      )}
    </div>
  );
}
