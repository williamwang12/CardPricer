import type { Card } from "@/lib/types";
import type { SnapshotCard } from "@/lib/db/label-snapshot";

// Single source of truth for "what changed since the last export" — the reprint
// queue. Both the Labels page ("only what changed" scope) and the Labels nav
// badge derive their count from this one function so they can never disagree.
//
// A card is in the queue when it is new since the last snapshot, or its market
// price moved by at least this threshold. Mirrors the app-wide $1 default.
export const REPRINT_MOVE_THRESHOLD = 1.0;

// Dispatched on window when the reprint queue may have changed without a
// navigation (an export or import completing on the current page). The Labels
// nav badge listens for it and refetches so it updates immediately.
export const REPRINT_CHANGED_EVENT = "cardparser:reprint-changed";

export function computeReprintQueue(
  cards: Card[],
  snapshotCards: SnapshotCard[] | null | undefined,
  threshold: number = REPRINT_MOVE_THRESHOLD
): Card[] {
  if (!snapshotCards) return [];
  const snapLookup = new Map(
    snapshotCards.map((c) => [
      `${c.name.toLowerCase()}|${c.number}`,
      c.market_price,
    ])
  );
  const snapKeys = new Set(snapLookup.keys());
  const out: Card[] = [];
  for (const c of cards) {
    const key = `${c.name.toLowerCase()}|${c.number}`;
    const isNew = !snapKeys.has(key);
    const old = snapLookup.get(key);
    const moved =
      old != null &&
      c.market_price != null &&
      Math.abs(c.market_price - old) >= threshold;
    if (isNew || moved) out.push(c);
  }
  return out;
}
