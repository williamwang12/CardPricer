-- ============================================================================
-- Card liquidity cache — run in the Supabase SQL Editor.
--
-- Backs the Trade Calculator's liquidity factor. Populated on-demand from
-- TCGplayer's latest-sales endpoint (sales velocity) for the cards in a given
-- trade, with a 24h freshness window. The app degrades gracefully if this
-- table does not exist yet (it just recomputes live each time), so the feature
-- works before this migration is run — running it simply enables caching.
-- ============================================================================

CREATE TABLE IF NOT EXISTS card_liquidity (
  product_id    integer PRIMARY KEY,
  sales_per_day numeric,          -- null when derived from the proxy fallback
  score         numeric NOT NULL, -- 0..1 liquidity score
  source        text    NOT NULL DEFAULT 'sales'
                  CHECK (source IN ('sales','proxy')),
  window_days   numeric,          -- span of the sales sample, for transparency
  computed_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE card_liquidity ENABLE ROW LEVEL SECURITY;
