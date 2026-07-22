import { notFound } from "next/navigation";
import { UserRound } from "lucide-react";
import { auth } from "@/lib/auth";
import { canMessage } from "@/lib/guards";
import { getPublicProfileAction } from "@/actions/profiles";
import { publicUrl } from "@/lib/storage";
import MessageButton from "@/components/messages/MessageButton";

const LINK_LABELS: Record<string, string> = {
  ebay: "eBay",
  instagram: "Instagram",
  whatnot: "Whatnot",
  website: "Website",
};

export default async function VendorProfilePage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  const profile = await getPublicProfileAction(targetEmail);
  if (!profile) notFound();

  const session = await auth();
  const viewer = session?.user?.email;
  const showMessage = viewer ? await canMessage(viewer, targetEmail) : false;

  const avatarUrl = publicUrl("avatars", profile.avatar_path);
  const links = Object.entries(profile.links ?? {}).filter(
    ([, url]) => typeof url === "string" && url.trim()
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={profile.store_name ?? "Vendor"}
            className="w-20 h-20 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <span className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
            <UserRound className="h-8 w-8 text-muted-foreground" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
            {profile.store_name || "Vendor"}
          </h1>
          {showMessage && (
            <div className="mt-2">
              <MessageButton otherEmail={targetEmail} />
            </div>
          )}
          {(profile.location_city || profile.location_region) && (
            <p className="text-muted-foreground mt-0.5">
              {[profile.location_city, profile.location_region]
                .filter(Boolean)
                .join(", ")}
            </p>
          )}
        </div>
      </div>

      {profile.bio && (
        <p className="text-sm leading-relaxed whitespace-pre-line">
          {profile.bio}
        </p>
      )}

      {profile.specialties.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.specialties.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {links.map(([key, url]) => (
            <a
              key={key}
              href={url as string}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {LINK_LABELS[key] ?? key}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
