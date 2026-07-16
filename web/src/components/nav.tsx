"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/cn";
import { useCurrency } from "@/components/currency-context";
import { SUPPORTED_CURRENCIES, type CurrencyCode } from "@/lib/currency";

const PRIMARY_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/add", label: "Add Cards" },
  { href: "/catalog", label: "Catalog" },
  { href: "/charts", label: "Charts" },
  { href: "/export", label: "Export" },
  { href: "/events", label: "Events" },
];

const MORE_LINKS = [
  { href: "/transactions", label: "Transactions" },
  { href: "/shows", label: "My Shows" },
  { href: "/dead-inventory", label: "Dead Inventory" },
  { href: "/feedback", label: "Suggest Feature" },
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

export default function Nav({ user, isAdmin }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const { currency, setCurrency } = useCurrency();

  const moreLinks = isAdmin
    ? [...MORE_LINKS, { href: "/admin/events", label: "Admin" }]
    : MORE_LINKS;

  const allLinks = isAdmin
    ? [...ALL_LINKS, { href: "/admin/events", label: "Admin" }]
    : ALL_LINKS;

  const moreIsActive = moreLinks.some((link) => pathname.startsWith(link.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [moreOpen]);

  const linkClass = (href: string) =>
    cn(
      "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
      pathname.startsWith(href)
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    );

  const mobileLinkClass = (href: string) =>
    cn(
      "px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
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
    <header className="border-b border-border bg-white sticky top-0 z-10">
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-4">
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="CardParser" className="w-7 h-7 rounded-lg" />
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

          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((o) => !o)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1",
                moreIsActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              More
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
            </button>
            {moreOpen && (
              <div className="absolute top-full left-0 mt-1 w-44 rounded-lg border border-border bg-white shadow-lg py-1 z-20">
                {moreLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "block px-3 py-2 text-sm transition-colors",
                      pathname.startsWith(link.href)
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Desktop currency selector */}
        <div className="hidden sm:block flex-shrink-0">
          {currencySelect}
        </div>

        {/* Desktop user / sign-out */}
        <div className="hidden sm:flex items-center gap-3">
          {user ? (
            <>
              {user.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  className="w-7 h-7 rounded-full"
                  alt={user.name ?? ""}
                />
              )}
              <span className="text-sm text-muted-foreground">
                {user.name ?? user.email}
              </span>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors"
                >
                  Sign out
                </button>
              </form>
            </>
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
        <div className="sm:hidden border-t bg-white px-4 py-3 flex flex-col gap-1">
          {allLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={mobileLinkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 pt-2 border-t flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Currency:</span>
              {currencySelect}
            </div>
          </div>
          <div className="mt-2 pt-2 border-t flex items-center justify-between gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 min-w-0">
                  {user.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.image}
                      className="w-7 h-7 rounded-full flex-shrink-0"
                      alt={user.name ?? ""}
                    />
                  )}
                  <span className="text-sm text-muted-foreground truncate">
                    {user.name ?? user.email}
                  </span>
                </div>
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="text-sm px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors flex-shrink-0"
                  >
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
