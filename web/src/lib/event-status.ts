import type { Event, EventStatus } from "@/lib/types";

/** Today's date as an ISO YYYY-MM-DD string (UTC). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Auto-derive an event's lifecycle status from its dates.
 *
 * The `events.status` enum has `live` and `ended`, but nothing writes them —
 * an approved show is stored as `published` and stays that way. This derives
 * the effective status from the show's date window so the UI can show
 * "Live now" / "Ended" and stop advertising shows that are over, without a
 * cron writing the column.
 *
 * Only `published` (and an already-derived `live`) transition by the clock.
 * `draft`, `pending_approval`, `rejected`, `cancelled`, and a stored `ended`
 * are explicit states set by people and must never be overridden by the date.
 *
 * Day-granular on purpose: a show is `live` on its date(s) and `ended` the day
 * after `date_end` (falling back to `date` when there's no end). This matches
 * the day-level `date`/`date_end` fields the rest of the UI already keys off,
 * and sidesteps timezone math on the mostly-unset `starts_at`/`ends_at`.
 */
export function deriveEventStatus(
  event: Pick<Event, "status" | "date" | "date_end">,
  today: string = todayIso()
): EventStatus {
  if (event.status !== "published" && event.status !== "live") {
    return event.status;
  }
  const start = event.date;
  if (!start) return event.status;
  const end = event.date_end ?? event.date;
  if (today < start) return "published";
  if (today > end) return "ended";
  return "live";
}

/** Apply {@link deriveEventStatus} to an event, returning a copy. */
export function withDerivedStatus<T extends Pick<Event, "status" | "date" | "date_end">>(
  event: T,
  today: string = todayIso()
): T {
  return { ...event, status: deriveEventStatus(event, today) };
}

/** Whether a show is still accepting/showing to vendors (upcoming or ongoing). */
export function isVendorVisibleStatus(status: EventStatus): boolean {
  return status === "published" || status === "live";
}
