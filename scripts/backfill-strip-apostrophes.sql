-- Backfill: strip apostrophes from card names so they match our catalog.
--
-- BUG: our tcg_catalog.clean_name (sourced from TCGPlayer's own "clean name")
-- never contains apostrophes, e.g. "Lillie's Determination" -> "Lillies
-- Determination", "N's Zekrom" -> "Ns Zekrom". Our app's normalizeName()
-- didn't strip them, so any card imported/typed with an apostrophe (curly or
-- straight) could never be matched against the catalog by name -- it would
-- never get a tcgplayer_url, price, or synced image.
--
-- FIX (code): src/lib/utils.ts normalizeName() now strips apostrophes
-- ('/'/'), applied at every import path (TCGPlayer/DeckTradr/Collectr CSV
-- parsers, manual add, and the Collectr full-sync upsert).
--
-- FIX (data): this statement backfills all existing rows across every user.
-- Verified beforehand that stripping apostrophes creates no (user_email,
-- name, number) collisions with any existing row, so a plain rename is safe
-- (no quantities need to be merged). Already run directly against production
-- via the app's Supabase key on 2026-07-16 (1006 rows updated, 0 failures);
-- re-running is a no-op since the WHERE clause only matches names that still
-- contain an apostrophe.

UPDATE cards
SET name = replace(replace(name, '''', ''), '’', '')
WHERE name LIKE '%''%' OR name LIKE '%’%';
