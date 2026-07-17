import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";
import { bulkSearchTcgplayer, loadCatalogIndex } from "@/lib/data/scraper";
import { loadAllCards, updatePrices, cardsTag } from "@/lib/db/cards";
import { setLastRefreshed } from "@/lib/db/refresh-log";
import { saveSnapshot } from "@/lib/db/collection-snapshots";
import type { Card } from "@/lib/types";

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

export async function GET() {
  // Get all distinct users with cards. Paginated since PostgREST caps
  // unbounded selects at 1000 rows — without this, only users whose cards
  // happen to fall in the first page would ever get refreshed.
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
  let totalUpdated = 0;

  // Load catalog once, reuse for all users
  const catalogIndex = await loadCatalogIndex();

  for (const email of emails) {
    // Load all non-manual cards for this user (paginated — a single user
    // can have well over 1000 cards)
    const cards: Card[] = [];
    let cardsFrom = 0;
    while (true) {
      const { data: page, error: cardsErr } = await supabase
        .from("cards")
        .select("*")
        .eq("user_email", email)
        .eq("manual_price", false)
        .range(cardsFrom, cardsFrom + PAGE - 1);

      if (cardsErr || !page) break;
      cards.push(...(page as Card[]));
      if (page.length < PAGE) break;
      cardsFrom += PAGE;
    }

    if (!cards.length) continue;

    const updates = await bulkSearchTcgplayer(
      cards.map((c) => ({ id: c.id, name: c.name, number: c.number })),
      catalogIndex
    );
    totalUpdated += updates.length;

    if (updates.length > 0) {
      await updatePrices(updates);
    }
    // Invalidate cached page reads (Dashboard/Inventory/etc.) for this user
    // so the refreshed prices show up immediately instead of after 60s.
    revalidateTag(cardsTag(email), "max");

    // Save daily collection snapshot after prices are updated
    const allCards = await loadAllCards(email);
    const totalValue = allCards.reduce(
      (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
      0
    );
    const cardCount = allCards.reduce((sum, c) => sum + c.quantity, 0);
    const uniqueCount = allCards.length;
    await saveSnapshot(email, totalValue, cardCount, uniqueCount);

    await setLastRefreshed(email);
  }

  return NextResponse.json({
    ok: true,
    usersRefreshed: emails.length,
    cardsUpdated: totalUpdated,
    refreshedAt: new Date().toISOString(),
  });
}
