"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createShow, listShows, getShow, updateShow, deleteShow, markShowFinalized } from "@/lib/db/shows";
import { takeSnapshot, loadShowSnapshots } from "@/lib/db/show-snapshots";
import { updateShelfLife, getStaleCards } from "@/lib/db/shelf-life";
import { loadAllCards } from "@/lib/db/cards";
import { diffShowSnapshots, cardKey } from "@/lib/diff";
import type { ShowInput, Show, ShowSnapshot, ShowDiffResult, SnapshotCardWithQty } from "@/lib/types";
import type { ShelfLifeRow } from "@/lib/db/shelf-life";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

// ── Show CRUD ────────────────────────────────────────────────────────────────

export async function createShowAction(input: ShowInput): Promise<Show> {
  const email = await getUserEmail();
  const show = await createShow(input, email);
  revalidatePath("/shows");
  return show;
}

export async function listShowsAction(): Promise<Show[]> {
  const email = await getUserEmail();
  return listShows(email);
}

export async function getShowAction(showId: number): Promise<Show | null> {
  const email = await getUserEmail();
  return getShow(showId, email);
}

export async function updateShowAction(
  showId: number,
  fields: Partial<ShowInput>
): Promise<void> {
  const email = await getUserEmail();
  await updateShow(showId, fields, email);
  revalidatePath("/shows");
  revalidatePath(`/shows/${showId}`);
}

export async function deleteShowAction(showId: number): Promise<void> {
  const email = await getUserEmail();
  await deleteShow(showId, email);
  revalidatePath("/shows");
}

// ── Snapshots ────────────────────────────────────────────────────────────────

export async function takeSnapshotAction(
  showId: number,
  type: "pre" | "post"
): Promise<ShowSnapshot> {
  const email = await getUserEmail();
  const snapshot = await takeSnapshot(showId, type, email);
  revalidatePath(`/shows/${showId}`);
  return snapshot;
}

export async function loadShowSnapshotsAction(
  showId: number
): Promise<{ pre: ShowSnapshot | null; post: ShowSnapshot | null }> {
  const email = await getUserEmail();
  return loadShowSnapshots(showId, email);
}

// ── Diff + shelf life ────────────────────────────────────────────────────────

export async function getShowDiffAction(
  showId: number
): Promise<ShowDiffResult | null> {
  const email = await getUserEmail();
  const { pre, post } = await loadShowSnapshots(showId, email);
  if (!pre || !post) return null;
  return diffShowSnapshots(pre.cards, post.cards);
}

export async function finalizeShowAction(
  showId: number
): Promise<ShowDiffResult | null> {
  const email = await getUserEmail();

  const show = await getShow(showId, email);
  if (!show) throw new Error("Show not found");
  if (show.finalized_at) throw new Error("Show already finalized");

  const { pre, post } = await loadShowSnapshots(showId, email);
  if (!pre || !post) return null;

  const diff = diffShowSnapshots(pre.cards, post.cards);
  await updateShelfLife(showId, diff, pre.cards, email);
  await markShowFinalized(showId, email);
  revalidatePath(`/shows/${showId}`);
  revalidatePath("/dead-inventory");
  return diff;
}

// ── Dead inventory ───────────────────────────────────────────────────────────

export interface StaleCardWithDetails {
  card_key: string;
  name: string;
  number: string;
  consecutive_shows: number;
  market_price: number | null;
  quantity: number;
}

export async function getDeadInventoryAction(
  threshold: number = 3
): Promise<StaleCardWithDetails[]> {
  const email = await getUserEmail();
  const [staleRows, cards] = await Promise.all([
    getStaleCards(email, threshold),
    loadAllCards(email),
  ]);

  // Build lookup from current inventory
  const cardLookup = new Map(
    cards.map((c) => [cardKey(c.name, c.number), c])
  );

  const result: StaleCardWithDetails[] = [];
  for (const row of staleRows) {
    const card = cardLookup.get(row.card_key);
    if (!card) continue; // card no longer in inventory
    result.push({
      card_key: row.card_key,
      name: card.name,
      number: card.number,
      consecutive_shows: row.consecutive_shows,
      market_price: card.market_price,
      quantity: card.quantity,
    });
  }

  return result;
}
