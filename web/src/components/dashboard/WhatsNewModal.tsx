"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Tag, Scale, Camera, BarChart3, type LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";

// Bump this key whenever there's a new announcement to show — users who
// dismissed a previous version will see the new one, and the old key is left
// behind harmlessly.
const STORAGE_KEY = "cardparser_whatsnew_v1";

interface Feature {
  icon: LucideIcon;
  title: string;
  body: string;
  href: string;
  cta: string;
  accent: string; // tailwind classes for the icon chip
}

const FEATURES: Feature[] = [
  {
    icon: Tag,
    title: "Condition your cards",
    body: "Grade each card by condition and pull the exact TCGplayer price for that grade. No more estimating off Near Mint.",
    href: "/inventory",
    cta: "Go to inventory",
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Scale,
    title: "Trade Calculator",
    body: "Weigh both sides of a trade by real market value, with liquidity guidance so you know what will actually move.",
    href: "/trade",
    cta: "Open calculator",
    accent: "bg-violet-500/10 text-violet-600",
  },
  {
    icon: Camera,
    title: "Automated show snapshots",
    body: "We now snapshot your collection automatically before each show, so you can see exactly what sold afterward.",
    href: "/shows",
    cta: "View shows",
    accent: "bg-amber-500/10 text-amber-600",
  },
  {
    icon: BarChart3,
    title: "Charts & analytics",
    body: "Track your portfolio, any single set, or the whole Pokémon market over time on the new Charts page.",
    href: "/charts",
    cta: "See charts",
    accent: "bg-sky-500/10 text-sky-600",
  },
];

export default function WhatsNewModal() {
  const [open, setOpen] = useState(false);

  // Check localStorage on mount only — keeps SSR output empty (modal closed)
  // so there's no hydration mismatch; it opens client-side if unseen.
  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      /* storage unavailable — just don't show it */
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto sm:mx-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle className="mt-3">What&apos;s new on CardParser</DialogTitle>
          <DialogDescription>
            A few big upgrades we&apos;ve shipped recently.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex flex-col gap-4 py-1">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <li key={f.title} className="flex gap-3">
                <div
                  className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${f.accent}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.body}</p>
                  <Link
                    href={f.href}
                    onClick={dismiss}
                    className="mt-1 inline-block text-xs font-medium text-primary hover:underline"
                  >
                    {f.cta} →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        <DialogClose asChild>
          <button
            onClick={dismiss}
            className="mt-1 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Got it
          </button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
