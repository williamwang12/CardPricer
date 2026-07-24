import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAllCards } from "@/lib/db/cards";
import { loadSnapshot } from "@/lib/db/label-snapshot";
import { computeReprintQueue } from "@/lib/reprint-queue";

// Powers the Labels nav badge. Uses the same computeReprintQueue as the Labels
// page's "only what changed" scope, so the badge count and the page count are
// guaranteed to match.
export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ count: 0 });

  const [cards, snapshot] = await Promise.all([
    loadAllCards(email),
    loadSnapshot(email),
  ]);
  const count = computeReprintQueue(cards, snapshot?.cards ?? null).length;
  return NextResponse.json({ count });
}
