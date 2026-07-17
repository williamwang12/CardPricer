"use client";

import { useState } from "react";
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
  Download,
  CalendarDays,
  Receipt,
  Store,
  PackageX,
  Lightbulb,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { signOutAction } from "@/actions/auth";
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

const PRIMARY_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/charts", label: "Charts", icon: BarChart3 },
  { href: "/export", label: "Export", icon: Download },
  { href: "/events", label: "Events", icon: CalendarDays },
];

const MORE_LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/transactions", label: "Transactions", icon: Receipt },
  { href: "/shows", label: "My Shows", icon: Store },
  { href: "/dead-inventory", label: "Dead Inventory", icon: PackageX },
  { href: "/feedback", label: "Suggest Feature", icon: Lightbulb },
];

const ALL_LINKS = [...PRIMARY_LINKS, ...MORE_LINKS];

interface NavProps {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | null;
  isAdmin?: boolean;
}

function initialsOf(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Nav({ user, isAdmin }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { currency, setCurrency } = useCurrency();

  const moreLinks = isAdmin
    ? [...MORE_LINKS, { href: "/admin/events", label: "Admin", icon: ShieldCheck }]
    : MORE_LINKS;

  const allLinks = isAdmin
    ? [...ALL_LINKS, { href: "/admin/events", label: "Admin", icon: ShieldCheck }]
    : ALL_LINKS;

  const moreIsActive = moreLinks.some((link) => pathname.startsWith(link.href));

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

        {/* Desktop nav links */}
        <nav className="hidden sm:flex gap-1 flex-1 items-center">
          {PRIMARY_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={linkClass(link.href)}>
              {link.label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "px-3 py-1.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1 outline-none",
                  moreIsActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted data-[state=open]:bg-muted data-[state=open]:text-foreground"
                )}
              >
                More
                <ChevronDown className="h-3.5 w-3.5 transition-transform data-[state=open]:rotate-180" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {moreLinks.map((link) => {
                const Icon = link.icon;
                const active = pathname.startsWith(link.href);
                return (
                  <DropdownMenuItem key={link.href} asChild>
                    <Link
                      href={link.href}
                      className={cn(active && "bg-accent text-accent-foreground")}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        {/* Desktop currency selector */}
        <div className="hidden sm:block flex-shrink-0">{currencySelect}</div>

        {/* Desktop user menu */}
        <div className="hidden sm:flex items-center flex-shrink-0">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 outline-none hover:bg-muted transition-colors">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      className="w-7 h-7 rounded-full ring-1 ring-border"
                      alt={user.name ?? ""}
                    />
                  ) : (
                    <span className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {initialsOf(user.name, user.email)}
                    </span>
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

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-t border-border bg-white px-4 py-3 flex flex-col gap-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
          {allLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={mobileLinkClass(link.href)}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <div className="mt-2 pt-2 border-t border-border flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Currency:</span>
              {currencySelect}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-border flex items-center justify-between gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      className="w-7 h-7 rounded-full flex-shrink-0 ring-1 ring-border"
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
                </div>
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
