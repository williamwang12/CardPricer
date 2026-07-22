import { supabase } from "@/lib/supabase";
import { getProfile } from "@/lib/db/profiles";

/** Public URL for a stored object (buckets are public-read — see migration). */
export function publicUrl(bucket: string, path: string | null): string | null {
  if (!path) return null;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/**
 * The current avatar URL for a user (their custom vendor avatar), or null.
 * Used by the layout to override the OAuth image in the nav.
 */
export async function avatarUrlForEmail(
  email?: string | null
): Promise<string | null> {
  if (!email) return null;
  const profile = await getProfile(email);
  const base = publicUrl("avatars", profile?.avatar_path ?? null);
  if (!base) return null;
  // Uploads reuse the same storage path, so bust the browser cache whenever the
  // profile changes — otherwise the nav keeps showing the old image.
  const token = profile?.updated_at ? Date.parse(profile.updated_at) : "";
  return token ? `${base}?t=${token}` : base;
}

/** Turn an email into a filesystem-safe path segment. */
function emailKey(email: string): string {
  return email.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

/**
 * Upload an image to a public bucket and return its storage path.
 * The path is namespaced by user so a re-upload overwrites the prior file.
 */
export async function uploadImage(
  bucket: string,
  ownerEmail: string,
  file: File
): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const path = `${emailKey(ownerEmail)}/avatar.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}
