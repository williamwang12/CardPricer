import { supabase } from "@/lib/supabase";
import type { Profile, ProfileInput } from "@/lib/types";

const TABLE = "profiles";

/** Read a profile by email. Returns null if the user has never saved one. */
export async function getProfile(userEmail: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_email", userEmail)
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

/**
 * Get the caller's profile, creating a default row if none exists yet.
 * Lazy bootstrap — called the first time a real user opens their profile.
 */
export async function ensureProfile(userEmail: string): Promise<Profile> {
  const existing = await getProfile(userEmail);
  if (existing) return existing;
  const { data, error } = await supabase
    .from(TABLE)
    .upsert({ user_email: userEmail }, { onConflict: "user_email" })
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Update the caller's own profile fields. */
export async function saveProfile(
  userEmail: string,
  input: ProfileInput
): Promise<Profile> {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_email: userEmail,
        ...input,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Batch-read profiles for a set of emails (vendor directory). */
export async function getProfilesByEmails(
  emails: string[]
): Promise<Profile[]> {
  if (emails.length === 0) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .in("user_email", emails);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

/** Admin-only: grant/revoke the organizer capability. */
export async function setOrganizer(
  userEmail: string,
  isOrganizer: boolean
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      {
        user_email: userEmail,
        is_organizer: isOrganizer,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_email" }
    );
  if (error) throw error;
}

/**
 * Whether two users share at least one event where BOTH are approved
 * attendees. Powers `profile_visibility = 'show_connected'` and the
 * "can these two message each other" gate.
 */
export async function sharesApprovedShow(
  a: string,
  b: string
): Promise<boolean> {
  if (a === b) return true;
  const { data, error } = await supabase
    .from("event_attendees")
    .select("event_id, user_email")
    .in("user_email", [a, b])
    .eq("status", "approved");
  if (error) throw error;
  const aEvents = new Set<number>();
  const bEvents = new Set<number>();
  for (const row of data ?? []) {
    if (row.user_email === a) aEvents.add(row.event_id);
    else if (row.user_email === b) bEvents.add(row.event_id);
  }
  for (const id of aEvents) if (bEvents.has(id)) return true;
  return false;
}
