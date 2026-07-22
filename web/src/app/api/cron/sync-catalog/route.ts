import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { syncAllGroups } from "@/lib/data/tcgcsv";
import { catalogMoversTag, computeAndStoreMovers } from "@/lib/db/catalog";

export const maxDuration = 300;

export async function GET() {
  try {
    const stats = await syncAllGroups();
    await computeAndStoreMovers();
    revalidateTag(catalogMoversTag(), "max");
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
