"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, Check, X, Plus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createShowAction,
  approveShowAction,
  rejectShowAction,
  setOrganizerAction,
} from "@/actions/events";
import type { Event, EventInput, EventStatus, VenueType } from "@/lib/types";

const VENUE_TYPES: { value: VenueType; label: string }[] = [
  { value: "collector_show", label: "Collector Show" },
  { value: "mall_show", label: "Mall Show" },
  { value: "tcg_tournament", label: "TCG Tournament" },
  { value: "convention", label: "Convention" },
  { value: "online", label: "Online" },
  { value: "other", label: "Other" },
];

const STATUS_META: Record<
  EventStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", variant: "outline" },
  pending_approval: { label: "Pending approval", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  live: { label: "Live", variant: "default" },
  ended: { label: "Ended", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "outline" },
  rejected: { label: "Rejected", variant: "destructive" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const inputClass =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

interface Props {
  isAdmin: boolean;
  initialMyShows: Event[];
  initialPending: Event[];
}

export default function ManageShowsClient({
  isAdmin,
  initialMyShows,
  initialPending,
}: Props) {
  const [myShows, setMyShows] = useState<Event[]>(initialMyShows);
  const [pending, setPending] = useState<Event[]>(initialPending);

  // Create-show form
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [venueType, setVenueType] = useState<VenueType>("collector_show");
  const [venueName, setVenueName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const [grantEmail, setGrantEmail] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const createShow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      toast.error("Name and date are required");
      return;
    }
    setCreating(true);
    try {
      const input: EventInput = {
        name: name.trim(),
        date,
        date_end: dateEnd || null,
        venue_type: venueType,
        venue_name: venueName.trim() || null,
        description: description.trim() || null,
      };
      const show = await createShowAction(input);
      setMyShows((prev) => [show, ...prev]);
      setName("");
      setDate("");
      setDateEnd("");
      setVenueName("");
      setDescription("");
      toast.success(
        show.status === "published"
          ? "Show published"
          : "Show submitted for admin approval"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create show");
    }
    setCreating(false);
  };

  const approve = async (show: Event) => {
    setBusyId(show.id);
    try {
      await approveShowAction(show.id);
      setPending((prev) => prev.filter((s) => s.id !== show.id));
      setMyShows((prev) =>
        prev.map((s) => (s.id === show.id ? { ...s, status: "published" } : s))
      );
      toast.success(`Approved "${show.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
    }
    setBusyId(null);
  };

  const reject = async (show: Event) => {
    const note = prompt(`Reject "${show.name}"? Optional note to the organizer:`);
    if (note === null) return; // cancelled
    setBusyId(show.id);
    try {
      await rejectShowAction(show.id, note.trim() || null);
      setPending((prev) => prev.filter((s) => s.id !== show.id));
      toast.success(`Rejected "${show.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reject");
    }
    setBusyId(null);
  };

  const grant = async (isOrganizer: boolean) => {
    if (!grantEmail.trim()) {
      toast.error("Enter an email");
      return;
    }
    try {
      await setOrganizerAction(grantEmail.trim(), isOrganizer);
      toast.success(
        `${isOrganizer ? "Granted" : "Revoked"} organizer for ${grantEmail.trim()}`
      );
      setGrantEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="font-heading text-xl font-semibold">Manage Shows</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isAdmin
            ? "Create shows (auto-published), review organizer requests, and grant organizer access."
            : "Create a show. It goes live once an admin approves it."}
        </p>
      </div>

      {/* Create show */}
      <form onSubmit={createShow} className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> New show
        </div>
        <input
          className={inputClass}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Show name"
        />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Start date</label>
            <input type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">End date (optional)</label>
            <input type="date" className={inputClass} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            className={inputClass}
            value={venueType}
            onChange={(e) => setVenueType(e.target.value as VenueType)}
          >
            {VENUE_TYPES.map((v) => (
              <option key={v.value} value={v.value}>{v.label}</option>
            ))}
          </select>
          <input
            className={inputClass}
            value={venueName}
            onChange={(e) => setVenueName(e.target.value)}
            placeholder="Venue name (optional)"
          />
        </div>
        <textarea
          className={inputClass}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
        />
        <Button type="submit" disabled={creating} className="self-start">
          {isAdmin ? "Create & publish" : "Submit for approval"}
        </Button>
      </form>

      {/* Admin: pending approval queue */}
      {isAdmin && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">Pending approval ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">No shows awaiting approval.</p>
          ) : (
            pending.map((show) => (
              <div key={show.id} className="rounded-lg border p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{show.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(show.date)} · by {show.created_by}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button size="sm" disabled={busyId === show.id} onClick={() => approve(show)}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === show.id} onClick={() => reject(show)}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>
      )}

      {/* Admin: grant organizer */}
      {isAdmin && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Grant organizer access
          </h2>
          <div className="flex items-center gap-2">
            <Input
              value={grantEmail}
              onChange={(e) => setGrantEmail(e.target.value)}
              placeholder="vendor@email.com"
              className="max-w-xs"
            />
            <Button size="sm" onClick={() => grant(true)}>Grant</Button>
            <Button size="sm" variant="outline" onClick={() => grant(false)}>Revoke</Button>
          </div>
        </section>
      )}

      {/* My shows */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">My shows ({myShows.length})</h2>
        {myShows.length === 0 ? (
          <p className="text-sm text-muted-foreground">You haven&apos;t created any shows yet.</p>
        ) : (
          myShows.map((show) => {
            const meta = STATUS_META[show.status];
            return (
              <div key={show.id} className="rounded-lg border p-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/events/${show.id}`} className="font-medium hover:underline truncate">
                    {show.name}
                  </Link>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(show.date)}
                </div>
                {show.status === "rejected" && show.review_note && (
                  <p className="text-xs text-destructive mt-1">
                    Admin note: {show.review_note}
                  </p>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
