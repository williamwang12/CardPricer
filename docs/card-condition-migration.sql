-- ============================================================================
-- Card condition pricing — run in the Supabase SQL Editor.
--
-- Adds a per-card condition and a cache of condition-adjusted prices sourced
-- from TCGplayer live listings (average of the cheapest few per condition).
-- CONTAINED: this does NOT change cards.market_price (still Near Mint), so the
-- dashboard, daily snapshots, and exports are unaffected — the conditioned
-- price is an overlay used by Inventory and the Trade Calculator only.
--
-- Degrades gracefully: if card_condition_prices is missing, non-NM cards fall
-- back to a flat condition multiplier, so the app works before this is run.
-- ============================================================================

-- Per-card condition (Near Mint by default — existing cards are unaffected).
ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS condition text NOT NULL DEFAULT 'Near Mint';

-- Cache of condition-adjusted prices, keyed by (product_id, condition).
CREATE TABLE IF NOT EXISTS card_condition_prices (
  product_id    integer NOT NULL,
  condition     text    NOT NULL,
  price         numeric NOT NULL,        -- avg of the cheapest few live listings
  listing_count integer,                 -- live listings found for that condition
  source        text    NOT NULL DEFAULT 'listings'
                  CHECK (source IN ('listings','multiplier')),
  computed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, condition)
);

ALTER TABLE card_condition_prices ENABLE ROW LEVEL SECURITY;

-- Per-user daily cap on live condition-price lookups (cache hits don't count).
-- Fails open if missing (no cap), same as trade_calc_usage.
CREATE TABLE IF NOT EXISTS condition_usage (
  user_email text NOT NULL,
  day        date NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, day)
);

ALTER TABLE condition_usage ENABLE ROW LEVEL SECURITY;
