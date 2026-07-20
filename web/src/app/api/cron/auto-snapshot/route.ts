import { NextResponse } from "next/server";
import { findShowsNeedingPreSnapshot, takeSnapshot } from "@/lib/db/show-snapshots";

export const maxDuration = 300;

export async function GET() {
  try {
    const needed = await findShowsNeedingPreSnapshot();
    let snapshotsTaken = 0;

    for (const { show_id, user_email } of needed) {
      try {
        await takeSnapshot(show_id, "pre", user_email);
        snapshotsTaken++;
      } catch {
        // Skip individual failures — don't block other shows
      }
    }

    return NextResponse.json({
      ok: true,
      showsChecked: needed.length,
      snapshotsTaken,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
