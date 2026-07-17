import { NextResponse } from "next/server";
import { syncSetLogos } from "@/lib/data/set-logos";

export const maxDuration = 300;

export async function GET() {
  try {
    const stats = await syncSetLogos();
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
