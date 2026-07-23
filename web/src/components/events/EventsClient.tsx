"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { applyToEventAction, cancelRegistrationAction } from "@/actions/events";
import { RegistrationBadge, EventLifecycleBadge } from "@/components/events/registration-status";
import type { Event, VenueType, RegistrationStatus } from "@/lib/types";

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
  statusByEvent: Record<number, RegistrationStatus>;
}

export default function EventsClient({ initialEvents, statusByEvent }: Props) {
  const [statuses, setStatuses] =
    useState<Record<number, RegistrationStatus>>(statusByEvent);
  const [pending, setPending] = useState<number | null>(null);

  const apply = async (event: Event) => {
    setPending(event.id);
    try {
      const reg = await applyToEventAction(event.id);
      setStatuses((prev) => ({ ...prev, [event.id]: reg.status }));
      toast.success(`Applied to "${event.name}", pending review`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    }
    setPending(null);
  };

  const withdraw = async (event: Event) => {
    setPending(event.id);
    try {
      await cancelRegistrationAction(event.id);
      setStatuses((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
      toast.success(`Withdrew from "${event.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw");
    }
    setPending(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Shows</h1>
      </div>

      {initialEvents.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No upcoming shows yet. Check back soon.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {initialEvents.map((event) => {
            const status = statuses[event.id];
            const busy = pending === event.id;
            return (
              <div key={event.id} className="rounded-lg border p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/events/${event.id}`} className="font-semibold hover:underline">
                    {event.name}
                  </Link>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <EventLifecycleBadge status={event.status} />
                    {status && <RegistrationBadge status={status} />}
                  </div>
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
                  {!status || status === "rejected" ? (
                    <Button size="sm" disabled={busy} onClick={() => apply(event)}>
                      Apply to sell
                    </Button>
                  ) : status === "approved" ? (
                    <Link href={`/events/${event.id}`}>
                      <Button size="sm">Open showcase</Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => withdraw(event)}
                    >
                      Withdraw
                    </Button>
                  )}
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
