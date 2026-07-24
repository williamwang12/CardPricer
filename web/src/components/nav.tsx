"use client";

import { Fragment, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Package,
  Upload,
  BookOpen,
  BarChart3,
  Tag,
  Store,
  ShieldCheck,
  LogOut,
  Bell,
  UserRound,
  ClipboardList,
  MessagesSquare,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { REPRINT_CHANGED_EVENT } from "@/lib/reprint-queue";
import { cn } from "@/lib/cn";
import { useCurrency } from "@/components/currency-context";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Left-hand "places". Labels is rendered separately (it carries the tag icon
// and the reprint-queue badge); Import is the single accent action button.
const PRIMARY_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/shows", label: "Shows", icon: Store },
  { href: "/charts", label: "Charts", icon: BarChart3 },
];

const LABELS_LINK = { href: "/labels", label: "Labels", icon: Tag };

interface UpcomingShow {
  id: number;
  name: string;
  date: string;
}

interface NavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  isAdmin?: boolean;
  /** Admin or granted organizer — shows the "Manage Shows" link. */
  canOrganize?: boolean;
  /** Unread-conversation count for the Messages badge. */
  unreadCount?: number;
  /** Custom vendor-profile avatar URL; overrides the OAuth (Google) image. */
  avatarUrl?: string | null;
  upcomingShows?: UpcomingShow[];
}

function initialsOf(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatShowDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

const SEEN_SHOWS_KEY = "cardparser_seen_shows";

function getSeenShowIds(): Set<number> {
  try {
    const raw = localStorage.getItem(SEEN_SHOWS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as number[]);
  } catch {
    return new Set();
  }
}

function saveSeenShowIds(ids: Set<number>) {
  try {
    localStorage.setItem(SEEN_SHOWS_KEY, JSON.stringify([...ids]));
  } catch { /* ignore */ }
}

/** Reprint-queue count badge. Remounts (via `key`) when pulseKey changes so
 *  the one-shot CSS animation replays. Hidden entirely when count is 0. */
function ReprintBadge({
  count,
  pulseKey,
  active,
  className,
}: {
  count: number | null;
  pulseKey: number;
  active: boolean;
  className?: string;
}) {
  if (count == null || count <= 0) return null;
  return (
    <span
      key={pulseKey}
      className={cn(
        "inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-semibold leading-none",
        pulseKey > 0 && "cp-badge-pulse",
        active
          ? "bg-primary-foreground text-primary"
          : "bg-primary text-primary-foreground",
        className
      )}
    >
      {count}
    </span>
  );
}

export default function Nav({ user, isAdmin, canOrganize, unreadCount = 0, avatarUrl, upcomingShows = [] }: NavProps) {
  const pathname = usePathname();
  // Custom vendor avatar wins over the OAuth image.
  const displayImage = avatarUrl ?? user?.image ?? null;
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();
  const [unseenCount, setUnseenCount] = useState(0);
  const userEmail = user?.email ?? null;

  // ── Reprint-queue badge (single source of truth: /api/reprint-queue) ───────
  const [reprintCount, setReprintCount] = useState<number | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const [pulseKey, setPulseKey] = useState(0);

  const fetchReprintCount = useCallback(() => {
    if (!userEmail) return;
    fetch("/api/reprint-queue")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === "number") setReprintCount(d.count);
      })
      .catch(() => {});
  }, [userEmail]);

  // Refetch on every navigation (a page change may reflect an import/export).
  useEffect(() => {
    fetchReprintCount();
  }, [pathname, fetchReprintCount]);

  // Refetch when an export/import completes on the current page (no navigation).
  useEffect(() => {
    const handler = () => fetchReprintCount();
    window.addEventListener(REPRINT_CHANGED_EVENT, handler);
    return () => window.removeEventListener(REPRINT_CHANGED_EVENT, handler);
  }, [fetchReprintCount]);

  // Pulse once when the count first appears or increases (e.g. after an import).
  useEffect(() => {
    if (reprintCount == null) return;
    const prev = prevCountRef.current;
    prevCountRef.current = reprintCount;
    if (prev != null && reprintCount > prev && reprintCount > 0) {
      const reduce =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      // Kicking off the one-shot pulse animation is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!reduce) setPulseKey((k) => k + 1);
    }
  }, [reprintCount]);

  useEffect(() => {
    const seen = getSeenShowIds();
    // Clean out IDs for shows no longer in the upcoming list
    const currentIds = new Set(upcomingShows.map((s) => s.id));
    const cleaned = new Set([...seen].filter((id) => currentIds.has(id)));
    if (cleaned.size !== seen.size) saveSeenShowIds(cleaned);
    setUnseenCount(upcomingShows.filter((s) => !cleaned.has(s.id)).length);
  }, [upcomingShows]);

  const markAllSeen = useCallback(() => {
    const seen = getSeenShowIds();
    for (const s of upcomingShows) seen.add(s.id);
    saveSeenShowIds(seen);
    setUnseenCount(0);
  }, [upcomingShows]);

  // Former "More" feature pages, redistributed to the avatar menu.
  const accountLinks: {
    href: string;
    label: string;
    icon: LucideIcon;
    badge?: number;
  }[] = [
    { href: "/messages", label: "Messages", icon: MessagesSquare, badge: unreadCount },
    { href: "/trade", label: "Trade Calculator", icon: Scale },
    ...(canOrganize
      ? [{ href: "/events/manage", label: "Manage Shows", icon: ClipboardList }]
      : []),
    ...(isAdmin ? [{ href: "/admin/events", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const labelsActive = pathname.startsWith(LABELS_LINK.href);

  const linkClass = (href: string) =>
    cn(
      "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
      pathname.startsWith(href)
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    );

  const mobileLinkClass = (href: string) =>
    cn(
      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
      pathname.startsWith(href)
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    );

  const currencySelect = (
    <select
      value={currency}
      onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
      className="h-8 rounded-lg border border-input bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 cursor-pointer"
    >
      {Object.values(SUPPORTED_CURRENCIES).map((c) => (
        <option key={c.code} value={c.code}>
          {c.symbol} {c.code}
        </option>
      ))}
    </select>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white/85 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 flex-shrink-0 group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="CardParser"
            className="w-7 h-7 rounded-lg transition-transform group-hover:scale-105"
          />
          <span className="font-heading font-bold text-base tracking-tight">
            CardParser
          </span>
        </Link>

        {/* Desktop nav links — Labels sits directly after Inventory */}
        <nav className="hidden sm:flex gap-1 flex-1 items-center">
          {PRIMARY_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Fragment key={link.href}>
                <Link href={link.href} className={linkClass(link.href)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5" />
                    {link.label}
                  </span>
                </Link>
                {link.href === "/inventory" && (
                  /* Labels — carries the reprint badge */
                  <Link href={LABELS_LINK.href} className={linkClass(LABELS_LINK.href)}>
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" />
                      {LABELS_LINK.label}
                      <ReprintBadge
                        count={reprintCount}
                        pulseKey={pulseKey}
                        active={labelsActive}
                        className="ml-0.5"
                      />
                    </span>
                  </Link>
                )}
              </Fragment>
            );
          })}
        </nav>

        {/* Import — the single accent action button */}
        {user && (
          <Link
            href="/import"
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors flex-shrink-0",
              pathname.startsWith("/import") && "ring-2 ring-primary/40"
            )}
          >
            <Upload className="h-4 w-4" />
            Import
          </Link>
        )}

        {/* Desktop currency selector */}
        <div className="hidden sm:block flex-shrink-0">{currencySelect}</div>

        {/* Notification bell */}
        {user && (
          <div className="hidden sm:block flex-shrink-0">
            <DropdownMenu onOpenChange={(open) => { if (open) markAllSeen(); }}>
              <DropdownMenuTrigger asChild>
                <button className="relative p-1.5 rounded-lg outline-none hover:bg-muted transition-colors">
                  <Bell className="h-4.5 w-4.5 text-muted-foreground" />
                  {unseenCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {unseenCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Upcoming Shows</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {upcomingShows.length === 0 ? (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                    No shows in the next 7 days
                  </div>
                ) : (
                  upcomingShows.map((show) => (
                    <DropdownMenuItem key={show.id} asChild>
                      <Link href={`/shows/${show.id}`} className="flex flex-col items-start gap-0.5">
                        <span className="font-medium">{show.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatShowDate(show.date)}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Desktop user menu */}
        <div className="hidden sm:flex items-center flex-shrink-0">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative flex items-center gap-2 rounded-full pl-1 pr-2 py-1 outline-none hover:bg-muted transition-colors">
                  {displayImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayImage}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-border"
                      alt={user.name ?? ""}
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {initialsOf(user.name, user.email)}
                    </span>
                  )}
                  {unreadCount > 0 && (
                    <span className="absolute top-0 left-6 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
                  )}
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="font-medium truncate">{user.name ?? "Account"}</span>
                  <span className="text-xs font-normal text-muted-foreground truncate">
                    {user.email}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {accountLinks.map((link) => {
                  const Icon = link.icon;
                  const active = pathname.startsWith(link.href);
                  const badge = !!link.badge && link.badge > 0;
                  return (
                    <DropdownMenuItem key={link.href} asChild>
                      <Link
                        href={link.href}
                        className={cn(active && "bg-accent text-accent-foreground")}
                      >
                        <Icon className="h-4 w-4" />
                        {link.label}
                        {badge && (
                          <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                            {link.badge}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <UserRound className="h-4 w-4" />
                    Edit profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void signOutAction();
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile actions — Import stays visible at all widths, plus the menu */}
        <div className="sm:hidden ml-auto flex items-center gap-2">
          {user && (
            <Link
              href="/import"
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors",
                pathname.startsWith("/import") && "ring-2 ring-primary/40"
              )}
            >
              <Upload className="h-4 w-4" />
              Import
            </Link>
          )}
          <button
            className="p-1.5 rounded-lg hover:bg-muted transition-colors relative"
            onClick={() => { setMobileOpen((o) => { if (!o && upcomingShows.length > 0) markAllSeen(); return !o; }); }}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            {/* Surface the reprint count on the trigger while the menu is closed */}
            {!mobileOpen && reprintCount != null && reprintCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {reprintCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          {PRIMARY_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <Fragment key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={mobileLinkClass(link.href)}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
                {link.href === "/inventory" && (
                  /* Labels with reprint badge, directly after Inventory */
                  <Link
                    href={LABELS_LINK.href}
                    onClick={() => setMobileOpen(false)}
                    className={mobileLinkClass(LABELS_LINK.href)}
                  >
                    <Tag className="h-4 w-4" />
                    {LABELS_LINK.label}
                    <ReprintBadge
                      count={reprintCount}
                      pulseKey={pulseKey}
                      active={labelsActive}
                      className="ml-auto"
                    />
                  </Link>
                )}
              </Fragment>
            );
          })}

          {/* Account links (former More) */}
          {user && (
            <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
              {accountLinks.map((link) => {
                const Icon = link.icon;
                const badge = !!link.badge && link.badge > 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={mobileLinkClass(link.href)}
                  >
                    <Icon className="h-4 w-4" />
                    {link.label}
                    {badge && (
                      <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                        {link.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Mobile upcoming shows */}
          {user && upcomingShows.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-1">
                Upcoming Shows
              </span>
              {upcomingShows.map((show) => (
                <Link
                  key={show.id}
                  href={`/shows/${show.id}`}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors"
                >
                  <span className="font-medium truncate">{show.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                    {formatShowDate(show.date)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Currency:</span>
              {currencySelect}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-3">
            {user ? (
              <>
                <Link
                  href="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 min-w-0"
                >
                  {displayImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayImage}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-border"
                      alt={user.name ?? ""}
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center flex-shrink-0">
                      {initialsOf(user.name, user.email)}
                    </span>
                  )}
                  <span className="text-sm text-muted-foreground truncate">
                    {user.name ?? user.email}
                  </span>
                </Link>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
