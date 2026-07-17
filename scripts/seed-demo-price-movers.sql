-- Seed demo price-mover data for hungergamesareawesome@gmail.com
-- Re-runnable: merges fresh "old price" entries for the demo user's 10
-- dead-inventory cards into their existing label_snapshots row, so the
-- dashboard's gainers/drops comparison (current cards.market_price vs.
-- snapshot cards_json) produces 5 gainers + 5 drops for the price-movers
-- carousel.
--
-- Any pre-existing snapshot entries for these 10 cards (matched by
-- name + number) are replaced; all other entries in the snapshot are left
-- untouched. If the user has no snapshot row yet, one is created.

DO $$
DECLARE
  demo_email TEXT := 'hungergamesareawesome@gmail.com';
  new_entries JSONB := '[
    {"name": "Charizard ex",   "number": "006/165", "market_price": 70},
    {"name": "Pikachu VMAX",   "number": "044/185", "market_price": 40},
    {"name": "Mewtwo V",       "number": "072/172", "market_price": 25},
    {"name": "Umbreon VMAX",   "number": "095/203", "market_price": 60},
    {"name": "Rayquaza VMAX",  "number": "111/203", "market_price": 30},
    {"name": "Lugia V",        "number": "186/195", "market_price": 20},
    {"name": "Mew VMAX",       "number": "114/264", "market_price": 7},
    {"name": "Giratina VSTAR", "number": "131/196", "market_price": 27},
    {"name": "Arceus VSTAR",   "number": "123/172", "market_price": 17},
    {"name": "Palkia VSTAR",   "number": "040/189", "market_price": 16}
  ]'::jsonb;
  existing JSONB;
  merged JSONB;
BEGIN
  SELECT cards_json::jsonb INTO existing
  FROM label_snapshots
  WHERE user_email = demo_email;

  IF existing IS NULL THEN
    existing := '[]'::jsonb;
  END IF;

  -- Drop any existing entries for these 10 cards, then append the new ones.
  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO merged
  FROM jsonb_array_elements(existing) elem
  WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(new_entries) ne
    WHERE ne ->> 'name' = elem ->> 'name'
      AND ne ->> 'number' = elem ->> 'number'
  );

  merged := merged || new_entries;

  INSERT INTO label_snapshots (user_email, downloaded_at, cards_json)
  VALUES (demo_email, now(), merged::text)
  ON CONFLICT (user_email) DO UPDATE
    SET cards_json = EXCLUDED.cards_json,
        downloaded_at = EXCLUDED.downloaded_at;
END $$;
