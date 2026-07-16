import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportMovers } from "@/lib/export/excel";
import type { PriceMover } from "@/lib/types";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { movers, minPrice, currency, rate } = (await req.json()) as {
    movers: PriceMover[];
    minPrice?: number;
    currency?: string;
    rate?: number;
  };

  const buf = await exportMovers(
    movers,
    minPrice ?? 0,
    (currency as "USD") ?? "USD",
    rate ?? 1
  );
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="price_movers.xlsx"',
    },
  });
}
