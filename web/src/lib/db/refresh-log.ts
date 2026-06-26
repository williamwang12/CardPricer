import { supabase } from "@/lib/supabase";

const TABLE = "refresh_log";

export async function getLastRefreshed(userEmail: string): Promise<Date | null> {
  const { data } = await supabase
    .from(TABLE)
    .select("refreshed_at")
    .eq("user_email", userEmail)
    .single();
  return data?.refreshed_at ? new Date(data.refreshed_at) : null;
}

export async function setLastRefreshed(userEmail: string): Promise<void> {
  await supabase.from(TABLE).upsert({
    user_email: userEmail,
    refreshed_at: new Date().toISOString(),
  });
}
