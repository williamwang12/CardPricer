import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { bulkSearchTcgplayer, loadCatalogIndex } from "@/lib/scraper";
import { updatePrices } from "@/lib/db/cards";
import { setLastRefreshed } from "@/lib/db/refresh-log";
import type { Card } from "@/lib/types";

// Allow up to 5 minutes on Vercel Pro
export const maxDuration = 300;

export async function GET(req: Request) {
  // Verify Vercel cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

    await setLastRefreshed(email);
  }

  return NextResponse.json({
    ok: true,
    usersRefreshed: emails.length,
    cardsUpdated: totalUpdated,
    refreshedAt: new Date().toISOString(),
  });
}
