import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { signInWithGoogle, signInAsGuest } from "@/actions/auth";
import { HoloCard } from "@/components/HoloCard";
import {
  Upload,
  ArrowUpDown,
  Download,
  ArrowRight,
  BarChart3,
  CalendarDays,
  PackageX,
  LayoutDashboard,
  Tag,
  TrendingUp,
} from "lucide-react";

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
                The fastest, cheapest way to price&nbsp;cards
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                Drop a CSV, get market prices, print labels. Re-import before
                your next show and only reprint stickers that actually changed.
                Plus price charts, show management, portfolio tracking, and
                more.
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
              <div className="relative">
                {/* Pikachu card (behind, offset left) */}
                <div className="absolute -left-12 top-10 sm:-left-28 sm:top-8 w-[120px] sm:w-[180px] aspect-[5/7] rounded-xl border border-border bg-white shadow-md overflow-hidden -rotate-6 z-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://tcgplayer-cdn.tcgplayer.com/product/513721_400w.jpg"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3 pt-8">
                    <p className="text-white/70 text-[10px] font-medium">Pikachu · 173/165</p>
                    <span className="font-mono text-base font-bold text-white">$96.65</span>
                  </div>
                </div>

                {/* Greninja card (behind, offset right) */}
                <div className="absolute -right-12 top-10 sm:-right-28 sm:top-8 w-[120px] sm:w-[180px] aspect-[5/7] rounded-xl border border-border bg-white shadow-md overflow-hidden rotate-6 z-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://tcgplayer-cdn.tcgplayer.com/product/550242_400w.jpg"
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 via-black/40 to-transparent p-3 pt-8">
                    <p className="text-white/70 text-[10px] font-medium">Greninja ex · 198/167</p>
                    <span className="font-mono text-base font-bold text-white">$21.45</span>
                  </div>
                </div>

                {/* Main Charizard card */}
                <HoloCard />

                {/* Floating diff badge — since last export */}
                <div className="absolute -right-2 -top-3 sm:-right-10 sm:top-16 rounded-lg border border-border bg-white shadow-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col gap-0.5 z-20">
                  <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Since last export</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600">+$2.41</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">+5.6%</span>
                </div>

                {/* Floating badge — last 30 days */}
                <div className="absolute -left-2 bottom-8 sm:-right-10 sm:left-auto sm:bottom-20 rounded-lg border border-border bg-white shadow-lg px-2.5 py-1.5 sm:px-3 sm:py-2 flex flex-col gap-0.5 z-20">
                  <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Last 30 days</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600">+$6.83</span>
                  <span className="text-[9px] sm:text-[10px] text-muted-foreground">+17.8%</span>
                </div>
              </div>
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
                step="1"
                title="Import"
                body="Drop a CSV from Collectr, TCGPlayer, or DeckTradr. Cards are matched against 100,000+ TCGPlayer listings and priced instantly."
              />
              <StepCard
                icon={<ArrowUpDown className="h-5 w-5" />}
                step="2"
                title="Track changes"
                body="Re-import anytime. Newcomers, price movers, and removed cards are surfaced automatically against your last snapshot."
              />
              <StepCard
                icon={<Download className="h-5 w-5" />}
                step="3"
                title="Export labels"
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
                    number="183/165"
                    price="$45.08"
                    delta="+$2.41"
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
                <div className="border-t border-border bg-muted/30 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    4 cards changed · 1 new · 1 removed
                  </span>
                  <span className="text-xs font-semibold text-emerald-600">
                    Net change: +$31.56
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Chart showcase ─────────────────────────────── */}
        <section className="border-t border-border bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
              <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
                <div className="border-b border-border bg-muted/50 px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Price History
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block w-2.5 h-0.5 rounded-full bg-primary" />
                      Charizard ex
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-block w-2.5 h-0.5 rounded-full bg-amber-400" />
                      S&amp;P 500
                    </span>
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className="inline-block w-2.5 h-0.5 rounded-full bg-emerald-400" />
                      Pokemon Index
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <MockChart />
                </div>
                <div className="border-t border-border bg-muted/30 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>6 months</span>
                  <div className="flex items-center gap-4">
                    <span>Charizard ex: <span className="font-semibold text-emerald-600">+18.2%</span></span>
                    <span>S&amp;P: <span className="font-medium">+6.4%</span></span>
                    <span>Pokemon: <span className="font-medium">+11.7%</span></span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                  Track every card like a stock
                </h2>
                <p className="text-muted-foreground leading-relaxed">
                  TradingView-style price charts for every modern Pokemon card.
                  Compare your portfolio against the S&amp;P 500 and the Pokemon
                  market index. Daily prices updated automatically from
                  TCGPlayer market data.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features grid ──────────────────────────────── */}
        <section className="border-t border-border bg-white py-20 sm:py-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="font-heading text-2xl font-bold tracking-tight text-center sm:text-3xl">
              Everything else you need
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Beyond pricing — tools to run your card business.
            </p>

            <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<BarChart3 className="h-5 w-5" />}
                title="Price charts"
                body="TradingView-style charts for every modern Pokemon card. Track your portfolio value over time and compare it against the S&P 500."
              />
              <FeatureCard
                icon={<CalendarDays className="h-5 w-5" />}
                title="Show management"
                body="Create a show, get a prep checklist. Pre-show snapshots are taken automatically. After the show, see exactly what sold and your profit."
              />
              <FeatureCard
                icon={<LayoutDashboard className="h-5 w-5" />}
                title="Dashboard"
                body="See your total collection value, top movers, biggest gainers and drops — all at a glance. Portfolio value tracked daily."
              />
              <FeatureCard
                icon={<PackageX className="h-5 w-5" />}
                title="Dead inventory"
                body="Cards that haven't sold across multiple shows are flagged automatically. Know what to discount or pull from your binder."
              />
              <FeatureCard
                icon={<Tag className="h-5 w-5" />}
                title="Label printing"
                body="Export price stickers formatted for Avery label sheets. Print only the labels that changed since your last batch."
              />
              <FeatureCard
                icon={<TrendingUp className="h-5 w-5" />}
                title="Daily price refresh"
                body="Prices update automatically every day from TCGPlayer market data. No manual lookups, no stale prices."
              />
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
              Free to use. Sign up in seconds.
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
            Built for card vendors
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components (server, no separate file needed) ──── */

function StepCard({
  icon,
  step,
  title,
  body,
}: {
  icon: React.ReactNode;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-6 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
          {step}
        </span>
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

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-5 transition-colors hover:border-primary/30 hover:bg-primary/[0.02]">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-heading text-sm font-semibold">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
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

function MockChart() {
  // Charizard ex — volatile with upward trend (+18.2%)
  const cardLine = "M0,120 C15,115 30,105 50,110 C70,115 85,95 100,85 C120,90 140,75 160,65 C180,70 200,55 220,50 C240,45 260,40 280,35 C300,30 320,38 340,28 C360,22 380,18 400,15";
  // S&P 500 — steady climb (+6.4%)
  const spLine = "M0,110 C20,108 40,106 60,104 C80,102 100,100 120,98 C140,97 160,95 180,94 C200,92 220,91 240,90 C260,88 280,87 300,86 C320,85 340,84 360,82 C380,81 400,80";
  // Pokemon Index — moderate growth (+11.7%)
  const pokeLine = "M0,118 C20,114 40,112 60,108 C80,106 100,102 120,100 C140,98 160,94 180,90 C200,88 220,85 240,82 C260,80 280,76 300,72 C320,70 340,66 360,62 C380,58 400,55";

  return (
    <svg viewBox="0 0 400 140" className="w-full h-auto" aria-hidden="true">
      {/* Grid lines */}
      <line x1="0" y1="35" x2="400" y2="35" stroke="currentColor" className="text-border" strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="0" y1="70" x2="400" y2="70" stroke="currentColor" className="text-border" strokeWidth="0.5" strokeDasharray="4 4" />
      <line x1="0" y1="105" x2="400" y2="105" stroke="currentColor" className="text-border" strokeWidth="0.5" strokeDasharray="4 4" />

      {/* S&P 500 line */}
      <path d={spLine} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* Pokemon Index line */}
      <path d={pokeLine} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

      {/* Charizard ex area fill */}
      <defs>
        <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.15" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${cardLine} L400,140 L0,140 Z`} fill="url(#cardGrad)" />
      {/* Charizard ex line */}
      <path d={cardLine} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />

      {/* Current price dot */}
      <circle cx="400" cy="15" r="3" fill="hsl(var(--primary))" />
    </svg>
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
