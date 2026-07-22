"use server";

import { revalidatePath } from "next/cache";
import { getUserEmail, requireRealUser } from "@/lib/guards";
import {
  ensureProfile,
  getProfile,
  saveProfile,
  sharesApprovedShow,
} from "@/lib/db/profiles";
import { uploadImage, publicUrl } from "@/lib/storage";
import type { Profile, ProfileInput } from "@/lib/types";

/** The caller's own profile, bootstrapping a default row on first access. */
export async function getMyProfileAction(): Promise<Profile> {
  const email = await requireRealUser();
  return ensureProfile(email);
}

export async function saveProfileAction(input: ProfileInput): Promise<Profile> {
  const email = await requireRealUser();
  // avatar_path is set only through uploadAvatarAction, never client-supplied.
  const { avatar_path: _ignored, ...safe } = input;
  void _ignored;
  const profile = await saveProfile(email, safe);
  revalidatePath("/profile");
  revalidatePath(`/vendors/${encodeURIComponent(email)}`);
  return profile;
}

export async function uploadAvatarAction(
  formData: FormData
): Promise<{ profile: Profile; avatarUrl: string | null }> {
  const email = await requireRealUser();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image provided");
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("File must be an image");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be under 5 MB");
  }
  const path = await uploadImage("avatars", email, file);
  const profile = await saveProfile(email, { avatar_path: path });
  revalidatePath("/profile");
  revalidatePath(`/vendors/${encodeURIComponent(email)}`);
  // Uploads overwrite the same storage path, so cache-bust the public URL.
  const base = publicUrl("avatars", profile.avatar_path);
  const avatarUrl = base ? `${base}?t=${Date.now()}` : null;
  return { profile, avatarUrl };
}

/**
 * A public view of another user's profile, honoring `profile_visibility`.
 * Returns null when the viewer isn't allowed to see it. Guests may view
 * 'everyone' profiles (read-only browsing is allowed).
 */
export async function getPublicProfileAction(
  targetEmail: string
): Promise<Profile | null> {
  const viewer = await getUserEmail();
  const profile = await getProfile(targetEmail);
  if (!profile) return null;
  if (viewer === targetEmail) return profile;
  if (profile.profile_visibility === "everyone") return profile;
  // 'show_connected' — only visible to someone sharing an approved show.
  const connected = await sharesApprovedShow(viewer, targetEmail);
  return connected ? profile : null;
}
