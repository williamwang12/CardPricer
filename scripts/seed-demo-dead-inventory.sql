-- Seed demo dead-inventory data for hungergamesareawesome@gmail.com
-- Re-runnable: cleans up existing data first, then inserts fresh rows.
--
-- Scenario: 10 cards bought at various points, brought to 6 shows over
-- ~8 months (Nov 2025 – Jun 2026), never sold.  Most have depreciated
-- since purchase — cost basis > current market — so the counterfactual
-- chart clearly shows the opportunity cost of holding vs. investing.

DO $$
DECLARE
  demo_email TEXT := 'hungergamesareawesome@gmail.com';
  show1_id   INT;
  show2_id   INT;
  show3_id   INT;
  show4_id   INT;
  show5_id   INT;
  show6_id   INT;
  cards_json  TEXT;
BEGIN

  -- ==================== CLEANUP ====================
  DELETE FROM card_shelf_life WHERE user_email = demo_email;
  DELETE FROM show_snapshots  WHERE user_email = demo_email;
  DELETE FROM shows           WHERE user_email = demo_email;
  DELETE FROM cards           WHERE user_email = demo_email;

  -- ==================== CARDS ====================
  -- cost_basis reflects what was actually paid (typically above current market
  -- for dead inventory — these cards have depreciated while sitting unsold).
  -- Total current market value ≈ $785.  Total cost basis ≈ $1,230.
  INSERT INTO cards (name, number, quantity, market_price, cost_basis, tcgplayer_url, manual_price, user_email)
  VALUES
    ('Charizard ex',           '006/165', 1,  95.00, 185.00, NULL, false, demo_email),
    ('Pikachu VMAX',           '044/185', 2,  28.00,  55.00, NULL, false, demo_email),
    ('Mewtwo V',               '072/172', 1,  18.00,  42.00, NULL, false, demo_email),
    ('Umbreon VMAX',           '095/203', 1,  72.00, 155.00, NULL, false, demo_email),
    ('Rayquaza VMAX',          '111/203', 2,  22.00,  48.00, NULL, false, demo_email),
    ('Lugia V',                '186/195', 1,  14.00,  30.00, NULL, false, demo_email),
    ('Mew VMAX',               '114/264', 3,   8.50,  18.00, NULL, false, demo_email),
    ('Giratina VSTAR',         '131/196', 1,  32.00,  65.00, NULL, false, demo_email),
    ('Arceus VSTAR',           '123/172', 2,  12.00,  28.00, NULL, false, demo_email),
    ('Palkia VSTAR',           '040/189', 1,  19.00,  40.00, NULL, false, demo_email)
  ON CONFLICT (name, number, user_email)
  DO UPDATE SET
    quantity     = EXCLUDED.quantity,
    market_price = EXCLUDED.market_price,
    cost_basis   = EXCLUDED.cost_basis;

  -- ==================== SHOWS (6 finalized, spanning ~8 months) ====================
  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'Fall Collectors Meet', '2025-11-15', 'collector_show', 60.00,
          '2025-11-15T18:00:00Z', '2025-11-13T10:00:00Z')
  RETURNING id INTO show1_id;

  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'Holiday Mall Pop-Up', '2025-12-20', 'mall_show', 50.00,
          '2025-12-20T17:00:00Z', '2025-12-18T09:00:00Z')
  RETURNING id INTO show2_id;

  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'New Year TCG Tournament', '2026-01-25', 'tcg_tournament', 55.00,
          '2026-01-25T20:00:00Z', '2026-01-23T11:00:00Z')
  RETURNING id INTO show3_id;

  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'Spring Pokemon Convention', '2026-03-08', 'convention', 100.00,
          '2026-03-08T19:00:00Z', '2026-03-06T08:00:00Z')
  RETURNING id INTO show4_id;

  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'Downtown Card Expo', '2026-05-03', 'collector_show', 75.00,
          '2026-05-03T18:00:00Z', '2026-05-01T10:00:00Z')
  RETURNING id INTO show5_id;

  INSERT INTO shows (user_email, name, date, venue_type, table_fee, finalized_at, created_at)
  VALUES (demo_email, 'Summer League Night', '2026-06-14', 'tcg_tournament', 40.00,
          '2026-06-14T21:00:00Z', '2026-06-12T09:00:00Z')
  RETURNING id INTO show6_id;

  -- ==================== SHOW SNAPSHOTS ====================
  -- All 10 cards in every pre & post snapshot with identical quantities
  -- (simulating zero sales at each show).

  cards_json := '[
    {"name":"Charizard ex","number":"006/165","quantity":1,"market_price":95.00},
    {"name":"Pikachu VMAX","number":"044/185","quantity":2,"market_price":28.00},
    {"name":"Mewtwo V","number":"072/172","quantity":1,"market_price":18.00},
    {"name":"Umbreon VMAX","number":"095/203","quantity":1,"market_price":72.00},
    {"name":"Rayquaza VMAX","number":"111/203","quantity":2,"market_price":22.00},
    {"name":"Lugia V","number":"186/195","quantity":1,"market_price":14.00},
    {"name":"Mew VMAX","number":"114/264","quantity":3,"market_price":8.50},
    {"name":"Giratina VSTAR","number":"131/196","quantity":1,"market_price":32.00},
    {"name":"Arceus VSTAR","number":"123/172","quantity":2,"market_price":12.00},
    {"name":"Palkia VSTAR","number":"040/189","quantity":1,"market_price":19.00}
  ]';

  -- Show 1 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show1_id, demo_email, 'pre',  cards_json, '2025-11-15T08:00:00Z'),
    (show1_id, demo_email, 'post', cards_json, '2025-11-15T18:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- Show 2 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show2_id, demo_email, 'pre',  cards_json, '2025-12-20T08:00:00Z'),
    (show2_id, demo_email, 'post', cards_json, '2025-12-20T17:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- Show 3 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show3_id, demo_email, 'pre',  cards_json, '2026-01-25T09:00:00Z'),
    (show3_id, demo_email, 'post', cards_json, '2026-01-25T20:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- Show 4 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show4_id, demo_email, 'pre',  cards_json, '2026-03-08T08:00:00Z'),
    (show4_id, demo_email, 'post', cards_json, '2026-03-08T19:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- Show 5 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show5_id, demo_email, 'pre',  cards_json, '2026-05-03T08:00:00Z'),
    (show5_id, demo_email, 'post', cards_json, '2026-05-03T18:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- Show 6 snapshots
  INSERT INTO show_snapshots (show_id, user_email, type, cards_json, created_at)
  VALUES
    (show6_id, demo_email, 'pre',  cards_json, '2026-06-14T09:00:00Z'),
    (show6_id, demo_email, 'post', cards_json, '2026-06-14T21:00:00Z')
  ON CONFLICT (show_id, type) DO UPDATE SET cards_json = EXCLUDED.cards_json;

  -- ==================== CARD SHELF LIFE ====================
  -- Varying consecutive_shows (3–6). Cards frozen earliest have more shows.
  -- last_show_id points to the most recent show (show6).

  INSERT INTO card_shelf_life (user_email, card_key, consecutive_shows, last_show_id)
  VALUES
    (demo_email, 'charizard ex|006/165',    6, show6_id),
    (demo_email, 'pikachu vmax|044/185',    6, show6_id),
    (demo_email, 'mewtwo v|072/172',        5, show6_id),
    (demo_email, 'umbreon vmax|095/203',    6, show6_id),
    (demo_email, 'rayquaza vmax|111/203',   5, show6_id),
    (demo_email, 'lugia v|186/195',         4, show6_id),
    (demo_email, 'mew vmax|114/264',        4, show6_id),
    (demo_email, 'giratina vstar|131/196',  5, show6_id),
    (demo_email, 'arceus vstar|123/172',    3, show6_id),
    (demo_email, 'palkia vstar|040/189',    3, show6_id)
  ON CONFLICT (user_email, card_key)
  DO UPDATE SET
    consecutive_shows = EXCLUDED.consecutive_shows,
    last_show_id      = EXCLUDED.last_show_id;

END $$;
