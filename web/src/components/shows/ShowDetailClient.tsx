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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
    if (finalized || finalizing) return; // already finalized or in progress — button is locked
    setFinalizing(true);
    setFinalizeProgress(8);

    // Finalizing is a single request/response with no incremental progress
    // events, so simulate steady progress while we wait and snap to 100%
    // when the request resolves.
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

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/shows">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-xl font-semibold">{show.name}</h1>
          <p className="text-xs text-muted-foreground">
            {formatDate(show.date)}
            {show.date_end && ` – ${formatDate(show.date_end)}`}
            {show.table_fee != null && ` · $${Number(show.table_fee).toFixed(2)} table fee`}
          </p>
        </div>
      </div>

      {show.notes && (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          {show.notes}
        </p>
      )}

      {/* Snapshot Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Pre-Show Snapshot</h2>
            {pre && (
              <Badge variant="secondary">
                {pre.cards.length} cards
              </Badge>
            )}
          </div>
          {pre ? (
            <p className="text-xs text-muted-foreground">
              Taken {formatTimestamp(pre.created_at)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No snapshot yet. Take one before the show.
            </p>
          )}
          <Button
            size="sm"
            variant={pre ? "outline" : "default"}
            onClick={() => handleTakeSnapshot("pre")}
            disabled={takingPre}
          >
            {takingPre ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {pre ? "Retake" : "Take Snapshot"}
          </Button>
        </div>

        <div className="rounded-lg border p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Post-Show Snapshot</h2>
            {post && (
              <Badge variant="secondary">
                {post.cards.length} cards
              </Badge>
            )}
          </div>
          {post ? (
            <p className="text-xs text-muted-foreground">
              Taken {formatTimestamp(post.created_at)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              No snapshot yet. Take one after the show.
            </p>
          )}
          <Button
            size="sm"
            variant={post ? "outline" : "default"}
            onClick={() => handleTakeSnapshot("post")}
            disabled={takingPost}
          >
            {takingPost ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {post ? "Retake" : "Take Snapshot"}
          </Button>
        </div>
      </div>

      {/* Diff Report */}
      {diff && (
        <>
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

          {/* Finalize button */}
          <div className="flex flex-col gap-2 rounded-lg border p-4 bg-muted/10">
            {finalized ? (
              <p className="text-sm flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Show finalized — shelf-life counters updated. A show can only be
                finalized once.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  <strong>Finalize show</strong> to update shelf-life counters
                  for dead inventory tracking. This can only be done once per
                  show.
                </p>
                {finalizing && (
                  <Progress value={finalizeProgress} className="h-2" />
                )}
                <Button
                  size="sm"
                  onClick={handleFinalize}
                  disabled={finalizing}
                  className="w-fit"
                >
                  {finalizing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  {finalizing ? "Finalizing…" : "Finalize Show"}
                </Button>
              </>
            )}
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
          Take a pre-show snapshot before the show to start tracking.
        </p>
      )}
    </div>
  );
}
