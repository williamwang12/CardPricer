# Replace TCGPlayer Scraper with TCGCSV Catalog

## Context
The app currently scrapes TCGPlayer's search API directly for each card, one at a time. This is slow (~1 card/sec with rate limiting), fragile (IP-blocking risk), and limits the cron job to ~300 cards within Vercel's 5-minute timeout. TCGCSV provides a free, daily-updated mirror of TCGPlayer's product and pricing data as a bulk API. By syncing all Pokemon products into a local Supabase table, price lookups become instant database queries instead of external HTTP requests.

## Architecture Overview
1. **New `tcg_catalog` Supabase table** — stores all Pokemon products with their prices
2. **New TCGCSV sync cron job** — fetches all Pokemon groups/products/prices daily, upserts into catalog
3. **Replace `searchTcgplayer()`** — change from external API call to Supabase query
4. **Simplify price refresh cron** — bulk SQL update instead of per-card scraping
5. **Remove rate limiting** — DB lookups don't need throttling

---

## Phase 1: Supabase Schema

Run this SQL in the Supabase SQL editor to create the catalog table:

```sql
CREATE TABLE tcg_catalog (
  product_id   INT          NOT NULL,
  sub_type_name TEXT         NOT NULL DEFAULT 'Normal',
  name         TEXT          NOT NULL,
  clean_name   TEXT          NOT NULL,
  number       TEXT,
  group_id     INT           NOT NULL,
  group_name   TEXT,
  market_price NUMERIC,
  low_price    NUMERIC,
  url          TEXT,
  image_url    TEXT,
  updated_at   TIMESTAMPTZ   DEFAULT NOW(),
  PRIMARY KEY (product_id, sub_type_name)
);

-- Index for fast card lookups by name + number
CREATE INDEX idx_tcg_catalog_name_number ON tcg_catalog (lower(clean_name), number);

-- Index for syncing by group
CREATE INDEX idx_tcg_catalog_group ON tcg_catalog (group_id);
```

Rows per product variant: one row per (product_id, sub_type_name) pair. Example: Charizard VSTAR might have two rows — one for "Normal" and one for "Holofoil" — with different prices.

Estimated size: ~50K products x ~1.5 variants each = ~75K rows.

---

## Phase 2: TCGCSV Sync Module

### New file: `web/src/lib/tcgcsv.ts`

Constants:
- `CATEGORY_ID = "3"` (Pokemon)
- `BASE_URL = "https://tcgcsv.com/tcgplayer"`
- `USER_AGENT = "CardPricer/1.0.0"`
- `DELAY_MS = 100` (between requests, per TCGCSV docs)

Functions:

**`fetchGroups()`** — GET `{BASE_URL}/3/groups`, returns array of group objects (`groupId`, `name`)

**`fetchProducts(groupId)`** — GET `{BASE_URL}/3/{groupId}/products`, returns array of product objects. Extract card number from `extendedData` array (find item where `name === "Number"`, use its `value`).

**`fetchPrices(groupId)`** — GET `{BASE_URL}/3/{groupId}/prices`, returns array of price objects (`productId`, `marketPrice`, `lowPrice`, `subTypeName`)

**`syncGroup(groupId, groupName)`** — Fetches products + prices for one group, joins by `productId`, upserts into `tcg_catalog`. For each product, find its price entries and create a row per (productId, subTypeName) combo.

**`syncAllGroups()`** — Fetches group list, iterates through all groups calling `syncGroup()` with 100ms delay between groups. Returns stats (groups synced, products upserted).

All fetch calls must include `User-Agent: CardPricer/1.0.0` header. Use `AbortSignal.timeout(30000)` for safety.

### Upsert strategy
Use Supabase `upsert` with `onConflict: 'product_id,sub_type_name'` to insert-or-update. Delete stale rows for each group before upserting (to handle products removed from TCGPlayer).

---

## Phase 3: Catalog Sync Cron Endpoint

### New file: `web/src/app/api/cron/sync-catalog/route.ts`

- `maxDuration = 300` (5 minutes)
- Auth via `CRON_SECRET` header (same pattern as existing refresh-prices cron)
- Calls `syncAllGroups()` from tcgcsv module
- Returns JSON with stats: `{ ok, groupsSynced, productsUpserted }`

### Update: `web/vercel.json`
Add second cron entry — schedule catalog sync before price refresh:
```json
{
  "crons": [
    { "path": "/api/cron/sync-catalog", "schedule": "0 5 * * *" },
    { "path": "/api/cron/refresh-prices", "schedule": "0 6 * * *" }
  ]
}
```

---

## Phase 4: Replace Scraper with Catalog Lookup

### Rewrite: `web/src/lib/scraper.ts`

Replace the entire file. The new `searchTcgplayer()` function (keep name for minimal call-site changes):

1. Normalize the card name: `cardName.toLowerCase()`
2. Normalize the card number using existing `normalizeNumber()` from `utils.ts` (strips leading zeros, takes part before `/`)
3. Query `tcg_catalog`:
   - **Pass 1:** Match `lower(clean_name) = lower(cardName)` AND `number` normalizes to same value. Prefer `sub_type_name = 'Holofoil'`, fall back to `'Normal'`, then any.
   - **Pass 2:** If no match, try `lower(clean_name) ILIKE '%' || lower(cardName) || '%'` with same number match.
   - **Pass 3:** If still no match and no number was provided, match by name only.
4. Return `{ price: market_price, url }` from the best match, or `{ price: null, url: null }`.

The `/api/scraper` route (`web/src/app/api/scraper/route.ts`) needs NO changes — it already calls `searchTcgplayer()` and returns the result.

---

## Phase 5: Simplify Price Refresh Cron

### Rewrite: `web/src/app/api/cron/refresh-prices/route.ts`

Replace per-card scraping with a bulk approach:
1. For each user, load all non-manual cards
2. For each card, call `searchTcgplayer(card.name, card.number)` (now a fast DB lookup)
3. Collect updates and batch-write via existing `updatePrices()`
4. No rate limiting needed — all lookups are local DB queries

Remove the 500ms delay. Keep `maxDuration = 300` as a safety net.

---

## Phase 6: Remove Rate Limiting

### `web/src/components/inventory/InventoryClient.tsx` (~line 244)
Remove `await new Promise((r) => setTimeout(r, 500));`

### `web/src/components/add-cards/AddCardsClient.tsx` (~line 185)
Remove `if (fetchPrices) await new Promise((r) => setTimeout(r, 500));`

---

## Phase 7: Cleanup

- Remove old TCGPlayer API constants and functions from `scraper.ts` (HEADERS, SEARCH_API_URL, buildSearchPayload, etc.)
- The `ScrapeResult` type in `types.ts` stays — `searchTcgplayer` still returns `{ price, url }`

---

## Files Summary

| File | Action |
|------|--------|
| `web/src/lib/tcgcsv.ts` | **New** — TCGCSV fetch + sync logic |
| `web/src/app/api/cron/sync-catalog/route.ts` | **New** — catalog sync cron endpoint |
| `web/src/lib/scraper.ts` | **Rewrite** — DB lookup instead of TCGPlayer API |
| `web/src/app/api/cron/refresh-prices/route.ts` | **Simplify** — remove 500ms delay |
| `web/src/components/inventory/InventoryClient.tsx` | **Edit** — remove 500ms delay |
| `web/src/components/add-cards/AddCardsClient.tsx` | **Edit** — remove 500ms delay |
| `web/vercel.json` | **Edit** — add sync-catalog cron schedule |

Existing utilities to reuse:
- `normalizeNumber()` from `web/src/lib/utils.ts` — for card number matching
- `supabase` client from `web/src/lib/supabase.ts`
- `updatePrices()` from `web/src/lib/db/cards.ts` — for batch price updates
- `setLastRefreshed()` from `web/src/lib/db/refresh-log.ts`

---

## Verification

1. **Create the Supabase table** — run the SQL migration in Supabase dashboard
2. **Deploy and trigger catalog sync** — `curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/sync-catalog` — verify it completes and populates `tcg_catalog` (check row count in Supabase)
3. **Test price lookup** — go to inventory page, click "Refresh Missing" — cards should update nearly instantly (no 500ms delay, no external API calls)
4. **Test CSV import** — import a Collectr CSV with "Fetch Prices" enabled — should be fast
5. **Verify cron** — check that the daily refresh-prices cron still works on next scheduled run
