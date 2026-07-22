import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { loadAllCards } from "@/lib/db/cards";
import { saveSnapshot } from "@/lib/db/collection-snapshots";

export const maxDuration = 300;

// Records the daily collection-value snapshot for every user. Runs AFTER the
// sync-catalog cron, which refreshes tcg_catalog / card_price_history from
// tcgcsv — loadAllCards() overlays those live catalog prices, so the snapshot
// reflects the day's prices without touching TCGplayer.
//
// This is decoupled from price updates on purpose: each user is isolated in
// its own try/catch and the loop honours a soft deadline, so one bad user (or
// a slow run) can never abort everyone else's snapshot — which is what caused
// the collection chart to flat-line for most users.
export async function GET() {
  // Soft deadline: leave headroom under maxDuration so we return cleanly
  // instead of being killed mid-write by the platform.
  const deadline = Date.now() + 270_000;

  // Collect every distinct user with cards. Paginated since PostgREST caps
  // unbounded selects at 1000 rows.
  const PAGE = 1000;
  const emailSet = new Set<string>();
  let from = 0;
  while (true) {
    const { data: userRows, error: userErr } = await supabase
      .from("cards")
      .select("user_email")
      .neq("user_email", null)
      .range(from, from + PAGE - 1);

    if (userErr) {
      return NextResponse.json({ error: userErr.message }, { status: 500 });
    }
    if (!userRows || userRows.length === 0) break;
    for (const r of userRows) emailSet.add(r.user_email as string);
    if (userRows.length < PAGE) break;
    from += PAGE;
  }

  const emails = [...emailSet];
  let snapshotted = 0;
  let skipped = 0;
  const failures: { email: string; error: string }[] = [];

  for (const email of emails) {
    if (Date.now() > deadline) {
      skipped = emails.length - snapshotted - failures.length;
      break;
    }
    try {
      const cards = await loadAllCards(email);
      if (!cards.length) continue;

      const totalValue = cards.reduce(
        (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
        0
      );
      const cardCount = cards.reduce((sum, c) => sum + c.quantity, 0);
      const uniqueCount = cards.length;

      await saveSnapshot(email, totalValue, cardCount, uniqueCount);
      snapshotted++;
    } catch (err) {
      failures.push({
        email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    users: emails.length,
    snapshotted,
    skipped,
    failed: failures.length,
    failures,
    at: new Date().toISOString(),
  });
}
