-- ============================================================================
-- Trade Calculator daily usage — run in the Supabase SQL Editor.
--
-- Enforces the per-user daily cap on trade calculations (DAILY_TRADE_LIMIT).
-- One row per (user, UTC day) with a running count. The app fails open if this
-- table is missing (no limiting) so the feature works before the migration is
-- run — running it activates the cap.
-- ============================================================================

CREATE TABLE IF NOT EXISTS trade_calc_usage (
  user_email text NOT NULL,
  day        date NOT NULL,
  count      integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_email, day)
);

ALTER TABLE trade_calc_usage ENABLE ROW LEVEL SECURITY;
