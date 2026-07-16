import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAllCards } from "@/lib/db/cards";
import { exportPriceList } from "@/lib/export/excel";
import { saveSnapshot, loadSnapshot } from "@/lib/db/label-snapshot";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
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

  // Save snapshot of what's being exported
  await saveSnapshot(
    cards.map((c) => ({ name: c.name, number: c.number, market_price: c.market_price })),
    session.user.email
  ).catch(() => { /* non-fatal */ });

  const buf = await exportPriceList(
    cards,
    (currency as "USD") ?? "USD",
    rate ?? 1
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="price_list.xlsx"',
    },
  });
}
