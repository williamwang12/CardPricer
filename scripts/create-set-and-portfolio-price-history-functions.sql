-- Adds two Postgres aggregation functions for the /charts page, mirroring
-- get_pokemon_index_history (create-pokemon-index-history-function.sql):
--
--   get_set_price_history(group_id, days_back)      — total value per day for one set
--   get_portfolio_price_history(product_ids, days_back) — total value per day for an
--                                                          arbitrary set of products
--
-- WHY: the previous TS implementations (loadSetPriceHistory /
-- loadPortfolioPriceHistory) pulled EVERY card_price_history row for the set
-- or portfolio to the client and summed them in JS, ordered captured_at ASC
-- with no LIMIT. PostgREST caps unbounded queries at 1000 rows, so once a set
-- accumulated more than 1000 history rows (hundreds of cards over a handful of
-- days) the cap silently dropped the NEWEST dates — including today. Charts
-- froze on the oldest ~1-2 days ever recorded and never advanced. Aggregating
-- with SUM/GROUP BY in Postgres returns one row per day, so the row cap is
-- irrelevant no matter how much history accumulates.
--
-- These also adopt the app-wide "one representative price per card" convention
-- (MAX(market_price) per product_id per date — the higher-priced variant when a
-- product has both e.g. Normal and Reverse Holofoil rows) already used by
-- get_pokemon_index_history and loadCardPriceHistory. The old TS summed ALL
-- sub_type rows, double-counting multi-variant cards; these functions fix that
-- so set, portfolio, per-card, and index charts all agree.
--
-- Run this once in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION get_set_price_history(
  group_id_param INT,
  days_back INT DEFAULT NULL
)
RETURNS TABLE (captured_at DATE, total_value NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT per_product.captured_at, SUM(per_product.market_price) AS total_value
  FROM (
    SELECT captured_at, product_id, MAX(market_price) AS market_price
    FROM card_price_history
    WHERE product_id IN (
        SELECT product_id FROM tcg_catalog WHERE group_id = group_id_param
      )
      AND (days_back IS NULL OR captured_at >= (CURRENT_DATE - days_back))
    GROUP BY captured_at, product_id
  ) AS per_product
  GROUP BY per_product.captured_at
  ORDER BY per_product.captured_at;
$$;

CREATE OR REPLACE FUNCTION get_portfolio_price_history(
  product_ids_param INT[],
  days_back INT DEFAULT NULL
)
RETURNS TABLE (captured_at DATE, total_value NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT per_product.captured_at, SUM(per_product.market_price) AS total_value
  FROM (
    SELECT captured_at, product_id, MAX(market_price) AS market_price
    FROM card_price_history
    WHERE product_id = ANY(product_ids_param)
      AND (days_back IS NULL OR captured_at >= (CURRENT_DATE - days_back))
    GROUP BY captured_at, product_id
  ) AS per_product
  GROUP BY per_product.captured_at
  ORDER BY per_product.captured_at;
$$;
