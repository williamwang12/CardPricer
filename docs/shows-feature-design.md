# Shows Feature — Design Doc

## Overview

Add show tracking to Card Parser so vendors can snapshot their inventory before and after a show, diff the two to produce a sales report, and track dead inventory across shows.

---

## New Supabase Tables

### 1. `shows`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `user_email` | `text` | NOT NULL, index | Multi-tenant key |
| `name` | `text` | NOT NULL | e.g. "Pokemon League June 2026" |
| `date` | `date` | NOT NULL | Show date (for multi-day, use first day) |
| `date_end` | `date` | nullable | Last day if multi-day show |
| `venue_type` | `text` | NOT NULL, default `'other'` | `collector_show`, `mall_show`, `tcg_tournament`, `convention`, `online`, `other` |
| `table_fee` | `numeric` | nullable | Cost of the table/booth |
| `notes` | `text` | nullable | Free-form |
| `created_at` | `timestamptz` | default `now()` | |

### 2. `show_snapshots`

Each show gets up to 2 snapshots: one `pre` and one `post`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `show_id` | `bigint` | NOT NULL, FK -> `shows.id` ON DELETE CASCADE | |
| `user_email` | `text` | NOT NULL, index | Denormalized for query speed |
| `type` | `text` | NOT NULL, CHECK `IN ('pre', 'post')` | |
| `cards_json` | `text` | NOT NULL | JSON array of `SnapshotCardWithQty[]` |
| `created_at` | `timestamptz` | default `now()` | When the snapshot was taken |
| UNIQUE | | `(show_id, type)` | One pre and one post per show |

`SnapshotCardWithQty` shape (extends existing `SnapshotCard` with quantity):

```ts
{ name: string; number: string; quantity: number; market_price: number | null }
```

The existing `label_snapshots.cards_json` does NOT store quantity, but show diffing needs it to detect partial sells (sold 2 of 3 copies).

### 3. `card_shelf_life`

Tracks consecutive unsold shows per card.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `user_email` | `text` | NOT NULL | |
| `card_key` | `text` | NOT NULL | `${name.toLowerCase()}\|${number}` — same diff key used everywhere |
| `consecutive_shows` | `int` | NOT NULL, default `0` | Resets to 0 when the card sells |
| `last_show_id` | `bigint` | nullable, FK -> `shows.id` | Prevents double-counting if diff is re-run |
| UNIQUE | | `(user_email, card_key)` | One row per card per user |

**Why a separate table instead of a column on `cards`?** The `cards` table gets destructively rewritten by Collectr full-sync imports (delete all + re-insert). A column on `cards` would lose the counter on every import. A separate table keyed by `card_key` survives that.

---

## Shared Diff Engine — `web/src/lib/diff.ts`

Extract a pure function that both show-diffing and the existing newcomer/mover logic can use:

```ts
interface SnapshotCardWithQty {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
}

function cardKey(name: string, number: string): string {
  return `${name.toLowerCase()}|${number}`;
}

interface SoldCard {
  name: string;
  number: string;
  qty_sold: number;            // how many copies sold
  qty_before: number;          // how many were in pre-snapshot
  market_price: number | null; // price at pre-show time
}

interface AcquiredCard {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
}

interface ShowDiffResult {
  sold: SoldCard[];
  acquired: AcquiredCard[];      // in post but not in pre (show pickups)
  unsold: SnapshotCardWithQty[]; // in both, quantity didn't decrease
  revenue: number;               // sum of sold.qty_sold * sold.market_price
}

function diffShowSnapshots(
  pre: SnapshotCardWithQty[],
  post: SnapshotCardWithQty[]
): ShowDiffResult;
```

Diff logic:

- Build maps keyed by `cardKey(name, number)` for both pre and post
- **Sold**: card in pre where either (a) absent from post, or (b) post qty < pre qty. `qty_sold = pre_qty - (post_qty ?? 0)`
- **Acquired**: card in post that is absent from pre, OR post qty > pre qty for existing card (treat the increase as acquired)
- **Unsold**: card in both with post qty >= pre qty and no increase
- **Revenue**: sum of `qty_sold * market_price` for each sold card (skip if `market_price` is null)

---

## SQL Migration

```sql
-- 1. Shows
CREATE TABLE shows (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email  text NOT NULL,
  name        text NOT NULL,
  date        date NOT NULL,
  date_end    date,
  venue_type  text NOT NULL DEFAULT 'other',
  table_fee   numeric,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);
CREATE INDEX idx_shows_user ON shows (user_email);

-- 2. Show snapshots
CREATE TABLE show_snapshots (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  show_id     bigint NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  type        text NOT NULL CHECK (type IN ('pre', 'post')),
  cards_json  text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (show_id, type)
);
CREATE INDEX idx_show_snapshots_user ON show_snapshots (user_email);

-- 3. Card shelf life
CREATE TABLE card_shelf_life (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_email          text NOT NULL,
  card_key            text NOT NULL,
  consecutive_shows   int NOT NULL DEFAULT 0,
  last_show_id        bigint REFERENCES shows(id),
  UNIQUE (user_email, card_key)
);
CREATE INDEX idx_card_shelf_life_user ON card_shelf_life (user_email);

-- 4. RLS (service key bypasses; enable for safety)
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE show_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_shelf_life ENABLE ROW LEVEL SECURITY;
```

If `shows` was already created without `finalized_at` (pre-existing installs), run:

```sql
ALTER TABLE shows ADD COLUMN IF NOT EXISTS finalized_at timestamptz;
```

`finalized_at` is set once `finalizeShowAction` succeeds and is used to permanently
lock the "Finalize Show" button — a show can only be finalized once, since
finalizing mutates the shared `card_shelf_life` counters.

---

## New Files

| File | Purpose |
|------|---------|
| `web/src/lib/diff.ts` | Pure `diffShowSnapshots()`, `cardKey()` helpers |
| `web/src/lib/diff.test.ts` | Tests: basic sell, partial sell, acquired-at-show, quantity edge cases |
| `web/src/lib/db/shows.ts` | CRUD for `shows` table |
| `web/src/lib/db/show-snapshots.ts` | Save/load show snapshots + "snapshot current inventory" helper |
| `web/src/lib/db/shelf-life.ts` | Update/query `card_shelf_life` |
| `web/src/actions/shows.ts` | Server actions for show CRUD, take snapshot, get diff |
| `web/src/app/(auth)/shows/page.tsx` | Shows list page (server component) |
| `web/src/components/shows/ShowsClient.tsx` | Shows list UI + create/edit/delete |
| `web/src/app/(auth)/shows/[id]/page.tsx` | Show detail page (server component) |
| `web/src/components/shows/ShowDetailClient.tsx` | Show detail: snapshots, diff report, profit summary |
| `web/src/app/(auth)/dead-inventory/page.tsx` | Dead inventory report page |
| `web/src/components/dead-inventory/DeadInventoryClient.tsx` | Stale cards list + frozen cash total |

## Modified Files

| File | Change |
|------|--------|
| `web/src/components/nav.tsx` | Add "Shows" to `NAV_LINKS` |
| `web/src/lib/types.ts` | Add `Show`, `ShowSnapshot`, `SnapshotCardWithQty`, `ShowDiffResult` types |
| `web/src/components/add-cards/AddCardsClient.tsx` | After Collectr import, offer "Save as snapshot for Show X" |

---

## Implementation Phases

### Phase 1 — Schema + diff engine
- Run the SQL in Supabase
- Create `diff.ts` with `diffShowSnapshots()` and `cardKey()`
- Add types to `types.ts`
- Write tests for diff logic (basic sell, partial sell, acquired-at-show, empty snapshots)
- *Test*: run the test suite

### Phase 2 — Show CRUD
- `db/shows.ts`: create, list, get, update, delete
- `actions/shows.ts`: server actions wrapping DB layer with auth
- Shows list page + create/edit/delete UI
- *Test*: create a show, verify it appears in list, edit it, delete it

### Phase 3 — Snapshot tagging
- `db/show-snapshots.ts`: save snapshot (from current inventory), load snapshot
- "Take pre-show snapshot" / "Take post-show snapshot" buttons on show detail page
- Optional: after Collectr import in AddCardsClient, dropdown to tag as show snapshot
- *Test*: create show, take pre snapshot, verify card count displayed

### Phase 4 — Show diff + sales report
- Wire `diffShowSnapshots()` into show detail page
- Display: sold cards table, acquired cards table, revenue, profit (revenue - table_fee)
- Export diff to Excel
- *Test*: take pre snapshot, remove some cards, take post snapshot, verify diff

### Phase 5 — Shelf-life counter
- `db/shelf-life.ts`: update counters after a show is finalized, query stale cards
- After show diff is computed, update `card_shelf_life` (increment unsold, reset sold)
- Dead inventory page: list cards where `consecutive_shows >= threshold`, show total frozen value
- *Test*: run 3 shows without selling a card, verify it appears as stale

### Phase 6 — Nav + polish
- Add "Shows" to nav
- Add "Dead Inventory" as sub-navigation or separate link
- Visual consistency pass

---

## Design Decisions

1. **JSON blob snapshots** (not normalized rows) — matches existing `label_snapshots` pattern, keeps reads as single queries, all diffing happens in TypeScript.

2. **`quantity` in snapshot cards** — existing `SnapshotCard` omits quantity. New `SnapshotCardWithQty` adds it. The existing label snapshot flow is unaffected.

3. **Shelf-life in a separate table** — survives Collectr full-sync destructive imports. Keyed by the same `cardKey` string used in all diff logic.

4. **`venue_type` as text, not enum** — the UI shows a dropdown with known values + "Other" freeform. No migration needed to add new types.

5. **Snapshot = freeze current inventory** — "Take snapshot" reads all cards from `cards` table and stores the JSON blob. Independent of the import flow. The "tag import as snapshot" shortcut in AddCards is a convenience that does the same thing immediately after import completes.

6. **No changes to existing tables** — `cards`, `label_snapshots`, and the existing import/export flows are untouched. The shows feature is purely additive.
