import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAllCards } from "@/lib/db/cards";
import { exportInventory } from "@/lib/excel";

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

  const buf = await exportInventory(
    cards,
    (currency as "USD") ?? "USD",
    rate ?? 1
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="inventory.xlsx"',
    },
  });
}
