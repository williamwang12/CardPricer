import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { loadAllCards } from "@/lib/db/cards";
import { generateStickerPdf } from "@/lib/export/pdf";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardIds, format, logoBase64, currency, rate } = (await req.json()) as {
    cardIds?: number[];
    format?: string;
    logoBase64?: string;
    currency?: string;
    rate?: number;
  };

  let cards = await loadAllCards(session.user.email);
  if (cardIds) {
    const idSet = new Set(cardIds);
    cards = cards.filter((c) => idSet.has(c.id));
  }

  const logoBuffer = logoBase64
    ? Buffer.from(logoBase64, "base64")
    : null;

  const pdf = await generateStickerPdf(
    cards,
    logoBuffer,
    format ?? "avery5167",
    (currency as "USD") ?? "USD",
    rate ?? 1
  );
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="sticker_sheet.pdf"',
    },
  });
}
