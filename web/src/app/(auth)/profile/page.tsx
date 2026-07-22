import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isGuestEmail } from "@/lib/guards";
import { ensureProfile } from "@/lib/db/profiles";
import { publicUrl } from "@/lib/storage";
import ProfileEditClient from "@/components/profile/ProfileEditClient";

export default async function ProfilePage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  if (isGuestEmail(email)) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Vendor Profile
        </h1>
        <p className="text-muted-foreground">
          You&apos;re browsing as a guest. Sign in with Google or Facebook to
          set up a vendor profile, join shows, and message other vendors.
        </p>
      </div>
    );
  }

  const profile = await ensureProfile(email);
  const avatarUrl = publicUrl("avatars", profile.avatar_path);

  return <ProfileEditClient profile={profile} avatarUrl={avatarUrl} />;
}
