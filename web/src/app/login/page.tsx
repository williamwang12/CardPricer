import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signInWithGoogle, signInAsGuest } from "@/actions/auth";
import { HoloCard } from "@/components/HoloCard";
import { Upload, ArrowUpDown, Download, ArrowRight } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/inventory");

  return (
    <div className="min-h-screen bg-background">
      {/* ── Landing nav ──────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt=""
              className="h-7 w-7 rounded-lg"
            />
            <span className="font-heading text-base font-bold tracking-tight">
              CardParser
            </span>
          </div>
          <a
            href="#get-started"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Get started
          </a>
        </div>
      </header>

      <main>
        {/* ── Hero ─────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 pb-20 sm:pt-24 sm:pb-28">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <div className="hero-text flex flex-col gap-6">
              <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]">
                Price your cards in&nbsp;minutes, not&nbsp;hours
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                Import your collection from Collectr, TCGPlayer, or DeckTradr.
                Every card matched to live market prices. Export price lists and
                labels in one click.
              </p>
              <div
                id="get-started"
                className="flex flex-wrap gap-3 pt-2 scroll-mt-20"
              >
                <form action={signInWithGoogle}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <GoogleIcon />
                    Get started with Google
                  </button>
                </form>
                <form action={signInAsGuest}>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    Try as guest
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>

            <div className="hero-card flex justify-center md:justify-end">
              <HoloCard />
            </div>
          </div>
        </section>

        {/* ── How it works ────────────────────────────────── */}
        <section className="border-t border-border bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-center sm:text-3xl">
              5 minutes from CSV to price tags
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Three steps. No manual lookups. No copy-pasting prices.
            </p>

            <div className="mt-14 grid gap-8 sm:grid-cols-3 sm:gap-6">
              <StepCard
                icon={<Upload className="h-5 w-5" />}
                title="Import"
                body="Drop a CSV from Collectr, TCGPlayer, or DeckTradr. Cards are matched against 100,000+ TCGPlayer listings and priced instantly."
              />
              <StepCard
                icon={<ArrowUpDown className="h-5 w-5" />}
                title="Track changes"
                body="Re-import anytime. Newcomers, price movers, and removed cards are surfaced automatically against your last snapshot."
              />
              <StepCard
                icon={<Download className="h-5 w-5" />}
                title="Export"
                body="Download full price lists or just the deltas. Print fewer labels, waste less paper, get to your next show faster."
              />
            </div>
          </div>
        </section>

        {/* ── Delta showcase ──────────────────────────────── */}
        <section className="py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
              <div className="flex flex-col gap-4 order-2 md:order-1">
                <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  See what changed since your last export
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  The real pain isn&apos;t pricing once — it&apos;s re-pricing.
                  CardParser diffs your inventory against your last export so you
                  only print labels for what actually moved. Fewer stickers, less
                  waste, faster setup at the table.
                </p>
              </div>

              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden order-1 md:order-2">
                <div className="border-b border-border bg-muted/50 px-4 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Changes since last export
                  </span>
                </div>
                <div className="divide-y divide-border text-sm">
                  <DeltaRow
                    badge="NEW"
                    badgeColor="emerald"
                    name="Pikachu VMAX"
                    number="185/185"
                    price="$18.50"
                  />
                  <DeltaRow
                    badge="UP"
                    badgeColor="amber"
                    name="Charizard ex"
                    number="006/165"
                    price="$42.17"
                    delta="+$3.20"
                    deltaDir="up"
                  />
                  <DeltaRow
                    badge="UP"
                    badgeColor="amber"
                    name="Umbreon VMAX"
                    number="215/203"
                    price="$88.40"
                    delta="+$12.05"
                    deltaDir="up"
                  />
                  <DeltaRow
                    badge="DOWN"
                    badgeColor="red"
                    name="Mewtwo GX"
                    number="039/068"
                    price="$8.25"
                    delta="-$1.40"
                    deltaDir="down"
                  />
                  <div className="flex items-center justify-between gap-4 px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 ring-1 ring-inset ring-slate-200">
                        OUT
                      </span>
                      <span className="font-medium text-muted-foreground line-through truncate">
                        Bulbasaur
                      </span>
                      <span className="text-muted-foreground font-mono text-xs hidden sm:inline">
                        001/102
                      </span>
                    </div>
                    <span className="font-mono text-muted-foreground whitespace-nowrap">
                      $2.10
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ──────────────────────────────────── */}
        <section className="bg-[#0f172a] py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Ready to price your next show?
            </h2>
            <p className="mt-3 text-slate-400">
              Free to use. No credit card required.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <form action={signInWithGoogle}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2.5 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-[#0f172a] shadow-sm transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
                >
                  <GoogleIcon />
                  Get started with Google
                </button>
              </form>
              <form action={signInAsGuest}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
                >
                  Continue as guest
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-5 w-5 rounded" />
            <span className="font-heading font-semibold">CardParser</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Built for card sellers
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components (server, no separate file needed) ──── */

function StepCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-6 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-heading text-base font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}

function DeltaRow({
  badge,
  badgeColor,
  name,
  number,
  price,
  delta,
  deltaDir,
}: {
  badge: string;
  badgeColor: "emerald" | "amber" | "red";
  name: string;
  number: string;
  price: string;
  delta?: string;
  deltaDir?: "up" | "down";
}) {
  const colorMap = {
    emerald:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber:
      "bg-amber-50 text-amber-700 ring-amber-600/20",
    red: "bg-red-50 text-red-700 ring-red-600/20",
  };

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${colorMap[badgeColor]}`}
        >
          {badge}
        </span>
        <span className="font-medium truncate">{name}</span>
        <span className="text-muted-foreground font-mono text-xs hidden sm:inline">
          {number}
        </span>
      </div>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="font-mono font-medium">{price}</span>
        {delta && (
          <span
            className={`text-xs font-medium ${
              deltaDir === "up" ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
