-- Adds a Postgres function to compute a catalog-wide "Pokemon index" —
-- the total market value of every priced card in card_price_history per
-- day — for the new multi-series comparison chart on /charts.
--
-- WHY A DB FUNCTION INSTEAD OF A CLIENT QUERY: card_price_history already
-- has ~23k rows for a single day and will keep growing by one row per
-- (product_id, sub_type_name) every day the sync-catalog cron runs. Pulling
-- all of that to the client and aggregating in JS (like loadSetPriceHistory
-- does for a single set) doesn't scale once there are months of history.
-- Aggregating with SUM/GROUP BY in Postgres keeps this cheap regardless of
-- how much history accumulates.
--
-- Mirrors the existing "pick the higher-priced variant when a product_id
-- has multiple sub_type_name rows for the same date" convention used by
-- loadCardPriceHistory() (src/lib/db/card-price-history.ts) and the search/
-- movers queries elsewhere in the app.
--
-- Run this once in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION get_pokemon_index_history(days_back INT DEFAULT NULL)
RETURNS TABLE (captured_at DATE, total_value NUMERIC)
LANGUAGE sql
STABLE
AS $$
  SELECT per_product.captured_at, SUM(per_product.market_price) AS total_value
  FROM (
    SELECT captured_at, product_id, MAX(market_price) AS market_price
    FROM card_price_history
    WHERE days_back IS NULL OR captured_at >= (CURRENT_DATE - days_back)
    GROUP BY captured_at, product_id
  ) AS per_product
  GROUP BY per_product.captured_at
  ORDER BY per_product.captured_at;
$$;
