import { supabase } from "@/lib/supabase";

const TABLE = "blocks";

export async function blockUser(blocker: string, blocked: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { blocker_email: blocker, blocked_email: blocked },
      { onConflict: "blocker_email,blocked_email" }
    );
  if (error) throw error;
}

export async function unblockUser(blocker: string, blocked: string): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("blocker_email", blocker)
    .eq("blocked_email", blocked);
  if (error) throw error;
}

/** True if either user has blocked the other — blocks conversation in both directions. */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("blocker_email, blocked_email")
    .in("blocker_email", [a, b])
    .in("blocked_email", [a, b]);
  if (error) throw error;
  return (data ?? []).some(
    (r) =>
      (r.blocker_email === a && r.blocked_email === b) ||
      (r.blocker_email === b && r.blocked_email === a)
  );
}

/** Emails the given user has blocked. */
export async function listBlocked(blocker: string): Promise<string[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("blocked_email")
    .eq("blocker_email", blocker);
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_email);
}
