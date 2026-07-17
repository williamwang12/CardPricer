-- Fixes card_price_history so the sync-catalog cron can actually write to it.
--
-- BUG: card_price_history has row-level security enabled but no INSERT/UPDATE
-- policy, so every upsert from src/lib/data/tcgcsv.ts (which uses the app's
-- publishable/anon key, same as tcg_catalog and set_logos) has been silently
-- failing with "new row violates row-level security policy for table
-- card_price_history" since the feature was added. The sync-catalog cron
-- itself succeeds (it only console.errors price-history failures, never
-- throws), so tcg_catalog stays up to date while card_price_history has
-- remained empty — meaning the Catalog page's "Today's Top Gainers/Drops"
-- and any price-history charts have had no data to show.
--
-- FIX: same public read/write policy pattern already used for set_logos
-- (scripts/create-set-logos-table.sql) and effectively tcg_catalog itself.
--
-- Run this once in the Supabase SQL editor.

ALTER TABLE card_price_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access to card_price_history" ON card_price_history;
CREATE POLICY "Public read access to card_price_history"
  ON card_price_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public write access to card_price_history" ON card_price_history;
CREATE POLICY "Public write access to card_price_history"
  ON card_price_history FOR ALL
  USING (true)
  WITH CHECK (true);
