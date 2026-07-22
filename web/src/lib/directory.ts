import type {
  EventAttendee,
  EventListing,
  Profile,
  DirectoryVendor,
  ListedCard,
} from "@/lib/types";

/** Featured cards first, preserving relative order otherwise. */
export function featuredFirst(cards: ListedCard[]): ListedCard[] {
  return [...cards].sort(
    (a, b) => Number(!!b.is_featured) - Number(!!a.is_featured)
  );
}

/**
 * Build a show's vendor directory: every APPROVED vendor except the viewer,
 * joined to their profile + booth + visible showcase. Pure so it can be tested
 * without a DB. `avatarUrlOf` resolves a storage path to a public URL.
 *
 * Filtering rules (the privacy-sensitive part):
 *  - the viewer never appears in their own directory
 *  - a vendor's `hidden` listing contributes no cards
 *  - a vendor with no (visible) listing shows an empty showcase
 *  - a vendor with no profile falls back to email/no-avatar/no-specialties
 */
export function buildVendorDirectory(
  viewerEmail: string,
  approvedAttendees: EventAttendee[],
  profiles: Profile[],
  listings: EventListing[],
  avatarUrlOf: (avatarPath: string | null) => string | null
): DirectoryVendor[] {
  const others = approvedAttendees.filter((a) => a.user_email !== viewerEmail);
  const profileByEmail = new Map(profiles.map((p) => [p.user_email, p]));
  const visibleByEmail = new Map(
    listings
      .filter((l) => l.user_email !== viewerEmail && l.visibility !== "hidden")
      .map((l) => [l.user_email, l])
  );

  return others.map((a) => {
    const p = profileByEmail.get(a.user_email);
    return {
      email: a.user_email,
      storeName: p?.store_name ?? null,
      avatarUrl: avatarUrlOf(p?.avatar_path ?? null),
      specialties: p?.specialties ?? [],
      boothLabel: a.booth_label,
      cards: featuredFirst(visibleByEmail.get(a.user_email)?.cards ?? []),
    };
  });
}
