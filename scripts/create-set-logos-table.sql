-- Adds a `set_logos` table to store official set logo/symbol images sourced
-- from the free, developer-sanctioned Pokemon TCG API (pokemontcg.io) —
-- NOT scraped from Bulbapedia. Those images are owned by Nintendo/Creatures/
-- GAME FREAK/The Pokemon Company; Bulbapedia hosts them under fair use for a
-- non-commercial fan wiki, so re-hosting them in a commercial product would
-- be a copyright risk. pokemontcg.io is a public API explicitly intended for
-- third-party developer use and returns the same official logo/symbol art.
--
-- `group_id` mirrors `tcg_catalog.group_id` (TCGPlayer's set/group id) so we
-- can join logos onto the existing set list without a separate sets table.
--
-- Run this once in the Supabase SQL editor (DDL isn't available via the
-- app's publishable key).

CREATE TABLE IF NOT EXISTS set_logos (
  group_id    BIGINT PRIMARY KEY,
  group_name  TEXT NOT NULL,
  logo_url    TEXT,
  symbol_url  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read-only data (same trust level as tcg_catalog) — allow the app's
-- publishable key to SELECT, and to UPSERT during the sync script's writes.
ALTER TABLE set_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access to set_logos"
  ON set_logos FOR SELECT
  USING (true);

CREATE POLICY "Public write access to set_logos"
  ON set_logos FOR ALL
  USING (true)
  WITH CHECK (true);
