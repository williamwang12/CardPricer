import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Nav from "@/components/nav";
import { CurrencyProvider } from "@/components/currency-context";
import { isAdmin } from "@/lib/admin";
import { listShows } from "@/lib/db/shows";
import { getProfile } from "@/lib/db/profiles";
import { unreadConversationCount } from "@/lib/db/messaging";
import { publicUrl } from "@/lib/storage";
import { isGuestEmail } from "@/lib/guards";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email;
  const admin = isAdmin(email);
  // One profile read powers both the nav avatar and the organizer link.
  const profile = email ? await getProfile(email) : null;
  const base = publicUrl("avatars", profile?.avatar_path ?? null);
  const avatarUrl =
    base && profile?.updated_at ? `${base}?t=${Date.parse(profile.updated_at)}` : base;
  const canOrganize = admin || !!profile?.is_organizer;
  const unreadCount =
    email && !isGuestEmail(email) ? await unreadConversationCount(email) : 0;
  const allShows = email ? await listShows(email) : [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const weekFromNow = new Date(now);
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  const upcomingShows = allShows
    .filter((s) => {
      const d = new Date(s.date + "T00:00:00");
      return d >= now && d <= weekFromNow;
    })
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => ({ id: s.id, name: s.name, date: s.date }));

  return (
    <CurrencyProvider>
      <div className="min-h-screen flex flex-col">
        <Nav user={session.user} isAdmin={admin} canOrganize={canOrganize} unreadCount={unreadCount} avatarUrl={avatarUrl} upcomingShows={upcomingShows} />
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl w-full">
          {children}
        </main>
      </div>
    </CurrencyProvider>
  );
}
