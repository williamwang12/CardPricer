import { supabase } from "@/lib/supabase";

const TABLE = "trade_calc_usage";

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day
}

// Today's calculation count for a user. Returns 0 (fail open) if the table
// isn't there yet, so the feature keeps working before the migration is run.
export async function getTradeUsageToday(email: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("count")
      .eq("user_email", email)
      .eq("day", today())
      .maybeSingle();
    if (error) return 0;
    return data?.count ?? 0;
  } catch {
    return 0;
  }
}

// Increments today's count by one (read-modify-write — fine for a soft daily
// cap). Silently no-ops if the table is missing.
export async function incrementTradeUsage(email: string): Promise<void> {
  try {
    const current = await getTradeUsageToday(email);
    await supabase
      .from(TABLE)
      .upsert(
        { user_email: email, day: today(), count: current + 1 },
        { onConflict: "user_email,day" }
      );
  } catch {
    /* table missing — skip */
  }
}
