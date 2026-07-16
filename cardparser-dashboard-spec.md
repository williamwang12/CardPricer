# CardParser — Post-login dashboard build spec

Companion to `cardparser-ui-overhaul-prompt.md`. That file sets the visual system; this one specifies the dashboard screen. Build it in the existing Next.js app. Reference mockup: `dashboard-mockup-reference.html` (open it in a browser to see the target layout and the chart behavior).

## Purpose
The first screen a returning user sees after login. Its job is to answer, in one glance: what's my collection worth, what changed since my last import, and am I keeping pace with the market. Everything here is built on data the product already has (imported inventory + prices) plus two new things noted under Data model.

## Layout (top to bottom)
1. **Header row** — "Your collection" + last-import timestamp and source (e.g. "TCGplayer export"), with a primary `Import inventory` action on the right.
2. **Hero value** — total collection value as the largest element (serif display, tabular figures), with a delta pill showing change since last import ($ and %).
3. **KPI row** — four metric tiles: cards tracked (with unique count), net movement ($), newcomers (since last import), removed. Net movement and the value delta use semantic success/danger color.
4. **Collection vs benchmarks** — the value-over-time chart, plotted against a Pokémon card index and the S&P 500. See "Benchmark chart" below — this replaces a plain value line.
5. **Value by set** — horizontal bars, top sets by total value.
6. **Biggest movers** — two columns, gainers and drops, each a bordered list of rows: card name, set, old → new price, delta %. This is the actionable part; link to a full movers view.

## Benchmark chart (the part with real design constraints)
- **Rebase all three series to 100 at the start of the selected window.** You cannot share one y-axis across dollars, S&P points (~6,000), and an index — and dual axes are misleading. The axis is "growth since [start]," not dollars. Surface a small "rebased to 100" affordance so it's never confusing.
- **One y-axis only.** No secondary axis.
- **Emphasis coloring:** the user's collection is the solid, heavier, foreground line. Both benchmarks are dashed and recessive (one gray, one a muted second hue), distinguished by dash pattern as well as color so they read in dark mode and for colorblind users.
- **Timeframe toggle (1M / 6M / 1Y / All).** Pace-vs-market is most meaningful over longer windows, and the story can flip by window — so this control matters more here than on a plain value chart.
- Tooltip shows each series' indexed value and its % from the rebase point.

## Data model additions
- **`collection_snapshots`** — you need historical collection value to draw the value line and the collection's benchmark series. Suggested: `id`, `user_id`, `captured_at`, `total_value`, `card_count`, `unique_count`, `source_import_id`. Write one row per import (and optionally a daily job). Without this, the time-series charts have no history to draw.
- **Benchmark index source** — decide before building:
  - *S&P 500:* any market-data API provides daily closes; store or fetch and rebase client-side.
  - *Pokémon index:* there is no single official one. Either (a) license an existing market index (e.g. Card Ladder, PriceCharting) or (b) compute your own from your price feed over a fixed, documented basket with a stated weighting and rebase date. Option (b) is differentiated and uses data you already have, but it's a real sub-project — don't treat it as a chart tweak. A defensible index needs a fixed basket, a weighting rule, and a published methodology.

## Design system
Inherit everything from `cardparser-ui-overhaul-prompt.md`: the restrained holo-foil signature (use it in at most one or two places — the hero value card is a candidate), intentional display/body/data typefaces, tabular figures for all prices, semantic-only use of green/red (deltas), and the anti-generic guardrails. The chat mockup is flat by necessity; the real build is where the signature treatment lives.

## Open product decisions (flag, don't guess)
- **Guest first-run.** Guests can "continue as guest," but this dashboard assumes a persistent, re-imported collection with a "since last import" story. A guest with one import has no history — design a lighter first-run/empty state for that path.
- **Primary action from here.** Currently "see all movers" and "import." If the September shows feature is near, a "list movers at [show]" action may belong here too.

## Do not change
- The import → match → price → export logic and the auth flows. This is a new screen and a visual system, not a rewrite of working functionality.
