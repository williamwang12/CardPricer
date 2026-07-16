"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays, MapPin, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
  togglePublishAction,
} from "@/actions/events";
import type { Event, EventInput, VenueType } from "@/lib/types";

const VENUE_LABELS: Record<VenueType, string> = {
  collector_show: "Collector Show",
  mall_show: "Mall Show",
  tcg_tournament: "TCG Tournament",
  convention: "Convention",
  online: "Online",
  other: "Other",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  initialEvents: Event[];
}

export default function AdminEventsClient({ initialEvents }: Props) {
  const [events, setEvents] = useState(initialEvents);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Event | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [venueName, setVenueName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [venueType, setVenueType] = useState<VenueType>("collector_show");
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setDate("");
    setDateEnd("");
    setVenueName("");
    setVenueAddress("");
    setVenueType("collector_show");
    setDescription("");
    setEditing(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (event: Event) => {
    setEditing(event);
    setName(event.name);
    setDate(event.date);
    setDateEnd(event.date_end ?? "");
    setVenueName(event.venue_name ?? "");
    setVenueAddress(event.venue_address ?? "");
    setVenueType(event.venue_type);
    setDescription(event.description ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) {
      toast.error("Name and date are required");
      return;
    }

    const input: EventInput = {
      name: name.trim(),
      date,
      date_end: dateEnd || null,
      venue_name: venueName.trim() || null,
      venue_address: venueAddress.trim() || null,
      venue_type: venueType,
      description: description.trim() || null,
    };

    setSaving(true);
    try {
      if (editing) {
        await updateEventAction(editing.id, input);
        setEvents((prev) =>
          prev.map((ev) => (ev.id === editing.id ? { ...ev, ...input } : ev))
        );
        toast.success("Event updated");
      } else {
        const created = await createEventAction(input);
        setEvents((prev) => [created, ...prev]);
        toast.success("Event created");
      }
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save event");
    }
    setSaving(false);
  };

  const handleDelete = async (event: Event) => {
    if (!confirm(`Delete "${event.name}"? This removes all RSVPs, listings, and offers for it.`)) return;
    try {
      await deleteEventAction(event.id);
      setEvents((prev) => prev.filter((ev) => ev.id !== event.id));
      toast.success("Event deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete event");
    }
  };

  const handleTogglePublish = async (event: Event) => {
    try {
      await togglePublishAction(event.id, !event.published);
      setEvents((prev) =>
        prev.map((ev) => (ev.id === event.id ? { ...ev, published: !ev.published } : ev))
      );
      toast.success(event.published ? "Event unpublished" : "Event published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update event");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Admin — Events</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-sm text-muted-foreground">No events yet. Create one.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <Link href={`/events/${event.id}`} className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-sm font-medium truncate flex items-center gap-2">
                  {event.name}
                  <Badge variant={event.published ? "default" : "secondary"}>
                    {event.published ? "Published" : "Draft"}
                  </Badge>
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {formatDate(event.date)}
                    {event.date_end && ` – ${formatDate(event.date_end)}`}
                  </span>
                  {event.venue_name && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {event.venue_name}
                    </span>
                  )}
                  <span>{VENUE_LABELS[event.venue_type] ?? event.venue_type}</span>
                </div>
              </Link>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  title={event.published ? "Unpublish" : "Publish"}
                  onClick={(e) => {
                    e.preventDefault();
                    handleTogglePublish(event);
                  }}
                >
                  {event.published ? (
                    <Eye className="h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    openEdit(event);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(event);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Event" : "New Event"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update the event details." : "Publish a new show event for vendors."}
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
                <label className="text-sm font-medium">Venue Name</label>
                <input
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="e.g. Springfield Convention Center"
                  className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
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
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Venue Address</label>
              <input
                value={venueAddress}
                onChange={(e) => setVenueAddress(e.target.value)}
                placeholder="Optional"
                className="h-9 rounded-md border border-input px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Shown to vendors browsing events…"
                className="rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
