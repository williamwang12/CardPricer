"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import {
  saveProfileAction,
  uploadAvatarAction,
} from "@/actions/profiles";
import type { Profile, ProfileVisibility } from "@/lib/types";

interface ProfileEditClientProps {
  profile: Profile;
  avatarUrl: string | null;
}

const inputClass =
  "w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring";

export default function ProfileEditClient({
  profile,
  avatarUrl: initialAvatarUrl,
}: ProfileEditClientProps) {
  const [storeName, setStoreName] = useState(profile.store_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [specialties, setSpecialties] = useState(
    (profile.specialties ?? []).join(", ")
  );
  const [city, setCity] = useState(profile.location_city ?? "");
  const [region, setRegion] = useState(profile.location_region ?? "");
  const [ebay, setEbay] = useState(profile.links?.ebay ?? "");
  const [instagram, setInstagram] = useState(profile.links?.instagram ?? "");
  const [whatnot, setWhatnot] = useState(profile.links?.whatnot ?? "");
  const [website, setWebsite] = useState(profile.links?.website ?? "");
  const [visibility, setVisibility] = useState<ProfileVisibility>(
    profile.profile_visibility
  );
  const [notify, setNotify] = useState(profile.notify_new_message);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);

  const [isSaving, startSave] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      try {
        await saveProfileAction({
          store_name: storeName.trim() || null,
          bio: bio.trim() || null,
          specialties: specialties
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          location_city: city.trim() || null,
          location_region: region.trim() || null,
          links: {
            ebay: ebay.trim() || undefined,
            instagram: instagram.trim() || undefined,
            whatnot: whatnot.trim() || undefined,
            website: website.trim() || undefined,
          },
          profile_visibility: visibility,
          notify_new_message: notify,
        });
        toast.success("Profile saved");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save");
      }
    });
  };

  const handleAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);
    startUpload(async () => {
      try {
        const { avatarUrl } = await uploadAvatarAction(fd);
        setAvatarUrl(avatarUrl);
        toast.success("Avatar updated");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Vendor Profile
        </h1>
        <p className="text-muted-foreground mt-1">
          How you appear to other vendors in show directories.
        </p>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="Avatar"
            className="w-20 h-20 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <UserRound className="h-8 w-8 text-muted-foreground" />
          </span>
        )}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={isUploading}
            className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isUploading ? "Uploading…" : "Change avatar"}
          </button>
          <p className="text-xs text-muted-foreground mt-1">
            PNG or JPG, up to 5 MB.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatar}
          />
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Store name</label>
          <input
            className={inputClass}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="e.g. Route 1 Cards"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            className={inputClass}
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What you deal in, how you like to trade…"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Specialties
          </label>
          <input
            className={inputClass}
            value={specialties}
            onChange={(e) => setSpecialties(e.target.value)}
            placeholder="vintage, graded, japanese (comma separated)"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">City</label>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              State / Region
            </label>
            <input
              className={inputClass}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Links</legend>
          <div className="grid grid-cols-2 gap-3">
            <input className={inputClass} value={ebay} onChange={(e) => setEbay(e.target.value)} placeholder="eBay URL" />
            <input className={inputClass} value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram URL" />
            <input className={inputClass} value={whatnot} onChange={(e) => setWhatnot(e.target.value)} placeholder="Whatnot URL" />
            <input className={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="Website URL" />
          </div>
        </fieldset>

        <div>
          <label className="block text-sm font-medium mb-1">
            Profile visibility
          </label>
          <select
            className={inputClass}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ProfileVisibility)}
          >
            <option value="everyone">Everyone</option>
            <option value="show_connected">
              Only vendors I share a show with
            </option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
          />
          Notify me of new messages
        </label>

        <button
          type="submit"
          disabled={isSaving}
          className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {isSaving ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}
