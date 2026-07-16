import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { bulkSearchTcgplayer, loadCatalogIndex } from "@/lib/data/scraper";
import { loadAllCards, updatePrices } from "@/lib/db/cards";
import { setLastRefreshed } from "@/lib/db/refresh-log";
import { saveSnapshot } from "@/lib/db/collection-snapshots";
import type { Card } from "@/lib/types";

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

export async function GET() {
  // Get all distinct users with cards
  const { data: userRows, error: userErr } = await supabase
    .from("cards")
    .select("user_email")
    .neq("user_email", null);

  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const emails = [...new Set((userRows ?? []).map((r) => r.user_email as string))];
  let totalUpdated = 0;

  // Load catalog once, reuse for all users
  const catalogIndex = await loadCatalogIndex();

  for (const email of emails) {
    // Load all non-manual cards for this user
    const { data: cards, error: cardsErr } = await supabase
      .from("cards")
      .select("*")
      .eq("user_email", email)
      .eq("manual_price", false);

    if (cardsErr || !cards?.length) continue;

    const updates = await bulkSearchTcgplayer(
      (cards as Card[]).map((c) => ({ id: c.id, name: c.name, number: c.number })),
      catalogIndex
    );
    totalUpdated += updates.length;

    if (updates.length > 0) {
      await updatePrices(updates);
    }

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
