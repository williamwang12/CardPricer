import { NextResponse } from "next/server";
import { syncAllGroups } from "@/lib/tcgcsv";

export const maxDuration = 300;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await syncAllGroups();
    return NextResponse.json({
      ok: true,
      groupsSynced: stats.groupsSynced,
      productsUpserted: stats.productsUpserted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
