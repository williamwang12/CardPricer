"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rsvpAction, unRsvpAction } from "@/actions/events";
import type { Event, VenueType } from "@/lib/types";

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
  attendingEventIds: number[];
}

export default function EventsClient({ initialEvents, attendingEventIds }: Props) {
  const [attending, setAttending] = useState(new Set(attendingEventIds));
  const [pending, setPending] = useState<number | null>(null);

  const toggleRsvp = async (event: Event) => {
    setPending(event.id);
    try {
      if (attending.has(event.id)) {
        await unRsvpAction(event.id);
        setAttending((prev) => {
          const next = new Set(prev);
          next.delete(event.id);
          return next;
        });
        toast.success(`Cancelled attendance for "${event.name}"`);
      } else {
        await rsvpAction(event.id);
        setAttending((prev) => new Set(prev).add(event.id));
        toast.success(`You're going to "${event.name}"`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update RSVP");
    }
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events</h1>
      </div>

      {initialEvents.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No upcoming events yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialEvents.map((event) => {
            const isAttending = attending.has(event.id);
            return (
              <div key={event.id} className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/events/${event.id}`} className="font-semibold hover:underline">
                    {event.name}
                  </Link>
                  {isAttending && (
                    <Badge variant="secondary" className="flex items-center gap-1 flex-shrink-0">
                      <Check className="h-3 w-3" />
                      Going
                    </Badge>
                  )}
                </div>
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDate(event.date)}
                    {event.date_end && ` – ${formatDate(event.date_end)}`}
                  </span>
                  {event.venue_name && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.venue_name}
                    </span>
                  )}
                  <span>{VENUE_LABELS[event.venue_type]}</span>
                </div>
                {event.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {event.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-auto pt-2">
                  <Button
                    size="sm"
                    variant={isAttending ? "outline" : "default"}
                    disabled={pending === event.id}
                    onClick={() => toggleRsvp(event)}
                  >
                    {isAttending ? "Cancel" : "I'm Going"}
                  </Button>
                  <Link href={`/events/${event.id}`}>
                    <Button size="sm" variant="ghost">
                      View
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
