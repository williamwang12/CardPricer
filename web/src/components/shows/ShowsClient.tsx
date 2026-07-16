"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
}

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ShowsClient({ initialShows }: Props) {
  const [shows, setShows] = useState(initialShows);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Shows</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Show
        </Button>
      </div>

      {shows.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No shows yet. Create one to start tracking sales.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {shows.map((show) => (
            <div
              key={show.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <Link
                href={`/shows/${show.id}`}
                className="flex-1 min-w-0 flex flex-col gap-1"
              >
                <span className="text-sm font-medium truncate">
                  {show.name}
                </span>
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
          ))}
        </div>
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
