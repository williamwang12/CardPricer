import { supabase } from "@/lib/supabase";

// Generic per-user, per-UTC-day counter used to rate-limit expensive actions
// (trade calculations, condition price lookups). Each `table` is expected to
// have (user_email text, day date, count int) with PK (user_email, day).
// Fails open (returns 0 / no-ops) if the table is missing, so features work
// before their migration is run.

function today(): string {
  return new Date().toISOString().slice(0, 10); // UTC day
}

export async function getUsageToday(
  table: string,
  email: string
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from(table)
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

export async function incrementUsage(
  table: string,
  email: string
): Promise<void> {
  try {
    const current = await getUsageToday(table, email);
    await supabase
      .from(table)
      .upsert(
        { user_email: email, day: today(), count: current + 1 },
        { onConflict: "user_email,day" }
      );
  } catch {
    /* table missing — skip */
  }
}
