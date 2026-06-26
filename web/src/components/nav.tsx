"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOutAction } from "@/actions/auth";
import { cn } from "@/lib/cn";

const NAV_LINKS = [
  { href: "/inventory", label: "Inventory" },
  { href: "/add", label: "Add Cards" },
  { href: "/transactions", label: "Transactions" },
  { href: "/export", label: "Export" },
  { href: "/catalog", label: "Catalog" },
];

interface NavProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

export default function Nav({ user }: NavProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b bg-white sticky top-0 z-10">
      {/* Main bar */}
      <div className="container mx-auto px-4 max-w-7xl flex items-center h-14 gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Vendr" className="w-7 h-7 rounded-lg" />
          <span className="font-bold text-base tracking-tight">Vendr</span>
        </div>

        {/* Desktop nav links */}
        <nav className="hidden sm:flex gap-1 flex-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(link.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop user / sign-out */}
        <div className="hidden sm:flex items-center gap-3">
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
              className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* Mobile hamburger */}
        <button
          className="sm:hidden ml-auto p-1.5 rounded-md hover:bg-muted transition-colors"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="sm:hidden border-t bg-white px-4 py-3 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                pathname.startsWith(link.href)
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 pt-2 border-t flex items-center justify-between gap-3">
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
                className="text-sm px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors flex-shrink-0"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
