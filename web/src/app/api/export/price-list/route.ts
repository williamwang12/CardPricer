import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAllCards } from "@/lib/db/cards";
import { exportPriceList } from "@/lib/export/excel";
import { applyConditionAdjustedPrices } from "@/lib/db/export-pricing";
import {
  saveSnapshot,
  loadSnapshot,
  loadSnapshotAt,
  listSnapshots,
} from "@/lib/db/label-snapshot";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const at = searchParams.get("at");
  const list = searchParams.get("list");

  // GET /api/export/price-list?list=1 → all snapshot summaries
  if (list) {
    const summaries = await listSnapshots(session.user.email);
    return NextResponse.json(summaries);
  }

  // GET /api/export/price-list?at=<iso> → specific snapshot
  if (at) {
    const snapshot = await loadSnapshotAt(session.user.email, at);
    return NextResponse.json(snapshot);
  }

  // GET /api/export/price-list → most recent snapshot (backwards compat)
  const snapshot = await loadSnapshot(session.user.email);
  return NextResponse.json(snapshot);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardIds, currency, rate } = (await req.json()) as {
    cardIds?: number[];
    currency?: string;
    rate?: number;
  };
  let cards = await loadAllCards(session.user.email);
  if (cardIds) {
    const idSet = new Set(cardIds);
    cards = cards.filter((c) => idSet.has(c.id));
  }

  // Save snapshot of what's being exported. Snapshots track the base (Near
  // Mint) market price — the same basis the reprint queue and dashboard diff
  // against — so this stays on the unadjusted prices.
  await saveSnapshot(
    cards.map((c) => ({
      name: c.name,
      number: c.number,
      market_price: c.market_price,
    })),
    session.user.email
  ).catch(() => {
    /* non-fatal */
  });

  // The exported file uses condition-adjusted prices so it matches Inventory.
  const pricedCards = await applyConditionAdjustedPrices(cards);
  const buf = await exportPriceList(
    pricedCards,
    (currency as "USD") ?? "USD",
    rate ?? 1
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="price_list.xlsx"',
    },
  });
}
