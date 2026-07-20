"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  CalendarDays,
  MapPin,
  CheckCircle2,
  Circle,
  ChevronRight,
  Tag,
  Camera,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/cn";
import { createShowAction, updateShowAction, deleteShowAction } from "@/actions/shows";
import type { Show, ShowInput, VenueType } from "@/lib/types";

const VENUE_LABELS: Record<VenueType, string> = {
  collector_show: "Collector Show",
  mall_show: "Mall Show",
  tcg_tournament: "TCG Tournament",
  convention: "Convention",
  online: "Online",
  other: "Other",
};

interface Props {
  initialShows: Show[];
  snapshotStatuses: Record<number, { hasPre: boolean; hasPost: boolean }>;
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const showDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((showDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getShowStatus(show: Show): "upcoming" | "today" | "past" {
  const days = daysUntil(show.date);
  const endDays = show.date_end ? daysUntil(show.date_end) : days;
  if (endDays < 0) return "past";
  if (days <= 0 && endDays >= 0) return "today";
  return "upcoming";
}

interface PrepStep {
  label: string;
  done: boolean;
}

function getShowPrepSteps(
  show: Show,
  status: { hasPre: boolean; hasPost: boolean } | undefined
): PrepStep[] {
  const hasPre = status?.hasPre ?? false;
  const hasPost = status?.hasPost ?? false;
  const finalized = !!show.finalized_at;
  const showStatus = getShowStatus(show);

  if (showStatus === "upcoming") {
    return [
      { label: "Export labels", done: false },
      { label: "Pre-show snapshot", done: hasPre },
    ];
  }

  return [
    { label: "Pre-show snapshot", done: hasPre },
    { label: "Post-show snapshot", done: hasPost },
    { label: "Finalize", done: finalized },
  ];
}

function getNextAction(
  show: Show,
  status: { hasPre: boolean; hasPost: boolean } | undefined
): string | null {
  const hasPre = status?.hasPre ?? false;
  const hasPost = status?.hasPost ?? false;
  const finalized = !!show.finalized_at;
  const showStatus = getShowStatus(show);

  if (finalized) return null;
  if (showStatus === "upcoming") {
    if (!hasPre) return "Snapshot auto-taken before show";
    return "Export labels for the show";
  }
  if (!hasPre) return "Pre-show snapshot will be auto-taken";
  if (!hasPost) return "Take post-show snapshot";
  return "Finalize show results";
}

export default function ShowsClient({ initialShows, snapshotStatuses }: Props) {
  const [shows, setShows] = useState(initialShows);
  const [statuses, setStatuses] = useState(snapshotStatuses);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Show | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [venueType, setVenueType] = useState<VenueType>("collector_show");
  const [tableFee, setTableFee] = useState("");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setName("");
    setDate("");
    setDateEnd("");
    setVenueType("collector_show");
    setTableFee("");
    setNotes("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (show: Show) => {
    setEditing(show);
    setName(show.name);
    setDate(show.date);
    setDateEnd(show.date_end ?? "");
    setVenueType(show.venue_type);
    setTableFee(show.table_fee != null ? String(show.table_fee) : "");
    setNotes(show.notes ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      toast.error("Name and date are required");
      return;
    }

    const input: ShowInput = {
      name: name.trim(),
      date,
      date_end: dateEnd || null,
      venue_type: venueType,
      table_fee: tableFee ? parseFloat(tableFee) : null,
      notes: notes.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateShowAction(editing.id, input);
        setShows((prev) =>
          prev.map((s) =>
            s.id === editing.id ? { ...s, ...input } : s
          )
        );
        toast.success("Show updated");
      } else {
        const created = await createShowAction(input);
        setShows((prev) => [created, ...prev]);
        setStatuses((prev) => ({
          ...prev,
          [created.id]: { hasPre: false, hasPost: false },
        }));
        toast.success("Show created");
      }
      setDialogOpen(false);
      resetForm();
    } catch {
      toast.error("Failed to save show");
    }
    setSaving(false);
  };

  const handleDelete = async (show: Show) => {
    if (!confirm(`Delete "${show.name}"? This will also delete its snapshots.`)) return;
    try {
      await deleteShowAction(show.id);
      setShows((prev) => prev.filter((s) => s.id !== show.id));
      toast.success("Show deleted");
    } catch {
      toast.error("Failed to delete show");
    }
  };

  // Group shows
  const upcoming = shows.filter((s) => getShowStatus(s) !== "past");
  const past = shows.filter((s) => getShowStatus(s) === "past");

  // Sort upcoming by date ascending (nearest first)
  upcoming.sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-xl font-semibold">My Shows</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track inventory before and after each show
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Show
        </Button>
      </div>

      {shows.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No shows yet. Create one to start tracking sales at events.
          </p>
          <Button size="sm" variant="outline" className="mt-4" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Your First Show
          </Button>
        </div>
      ) : (
        <>
          {/* Upcoming / Active Shows */}
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Upcoming
              </h2>
              <div className="flex flex-col gap-3">
                {upcoming.map((show) => {
                  const status = getShowStatus(show);
                  const snapStatus = statuses[show.id];
                  const prepSteps = getShowPrepSteps(show, snapStatus);
                  const completedSteps = prepSteps.filter((s) => s.done).length;
                  const nextAction = getNextAction(show, snapStatus);
                  const days = daysUntil(show.date);

                  return (
                    <div
                      key={show.id}
                      className={cn(
                        "rounded-lg border bg-white transition-shadow hover:shadow-sm",
                        status === "today" && "border-primary ring-1 ring-primary/20"
                      )}
                    >
                      <div className="flex items-start gap-4 px-4 py-3">
                        <Link
                          href={`/shows/${show.id}`}
                          className="flex-1 min-w-0 flex flex-col gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {show.name}
                            </span>
                            {status === "today" && (
                              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0">
                                Today
                              </Badge>
                            )}
                            {status === "upcoming" && days <= 7 && days > 0 && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                {days === 1 ? "Tomorrow" : `${days} days`}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {formatDate(show.date)}
                              {show.date_end && ` – ${formatDate(show.date_end)}`}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {VENUE_LABELS[show.venue_type] ?? show.venue_type}
                            </span>
                            {show.table_fee != null && (
                              <span>${Number(show.table_fee).toFixed(2)} fee</span>
                            )}
                          </div>

                          {/* Prep progress */}
                          <div className="flex items-center gap-3 mt-1">
                            <div className="flex items-center gap-1.5">
                              {prepSteps.map((step, i) => (
                                <div key={i} className="flex items-center gap-1" title={step.label}>
                                  {step.done ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
                                  )}
                                  <span className={cn(
                                    "text-[11px]",
                                    step.done ? "text-green-700" : "text-muted-foreground"
                                  )}>
                                    {step.label}
                                  </span>
                                  {i < prepSteps.length - 1 && (
                                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 ml-0.5" />
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Next action callout */}
                          {nextAction && (
                            <div className="flex items-center gap-1.5 text-xs text-primary font-medium mt-0.5">
                              <ClipboardCheck className="h-3.5 w-3.5" />
                              Next: {nextAction}
                            </div>
                          )}
                        </Link>

                        <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              openEdit(show);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.preventDefault();
                              handleDelete(show);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Past Shows */}
          {past.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Past
              </h2>
              <div className="rounded-lg border divide-y">
                {past.map((show) => {
                  const snapStatus = statuses[show.id];
                  const finalized = !!show.finalized_at;
                  const hasPost = snapStatus?.hasPost ?? false;

                  return (
                    <div
                      key={show.id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <Link
                        href={`/shows/${show.id}`}
                        className="flex-1 min-w-0 flex flex-col gap-1"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {show.name}
                          </span>
                          {finalized ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-green-700 bg-green-50 border-green-200">
                              Finalized
                            </Badge>
                          ) : hasPost ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-amber-700 bg-amber-50 border-amber-200">
                              Needs Finalization
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Incomplete
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {formatDate(show.date)}
                            {show.date_end && ` – ${formatDate(show.date_end)}`}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {VENUE_LABELS[show.venue_type] ?? show.venue_type}
                          </span>
                          {show.table_fee != null && (
                            <span>${Number(show.table_fee).toFixed(2)} fee</span>
                          )}
                        </div>
                      </Link>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            openEdit(show);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            handleDelete(show);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Show" : "New Show"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the show details."
                : "Add a show to track inventory and sales."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pokemon League June 2026"
                className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">End Date</label>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Venue Type</label>
                <select
                  value={venueType}
                  onChange={(e) => setVenueType(e.target.value as VenueType)}
                  className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {Object.entries(VENUE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Table Fee ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={tableFee}
                  onChange={(e) => setTableFee(e.target.value)}
                  placeholder="0.00"
                  className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Optional notes…"
                className="rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
