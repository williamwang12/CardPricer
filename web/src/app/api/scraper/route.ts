import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTcgplayer } from "@/lib/data/scraper";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { name, number } = body as { name: string; number: string };

  if (!name) {
    return NextResponse.json({ error: "Card name required" }, { status: 400 });
  }

  const result = await searchTcgplayer(name, number ?? "");
  return NextResponse.json(result);
}
