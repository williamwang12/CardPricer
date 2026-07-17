-- Fix + seed collection_snapshots so the dashboard's "Collection value over
-- time" chart has data to render for hungergamesareawesome@gmail.com.
--
-- BUG FOUND: `collection_snapshots` has RLS enabled but no permissive policy,
-- so inserts fail for the app's Supabase key (a "publishable" key, not a
-- service-role key -- it does NOT bypass RLS). This means the
-- /api/cron/refresh-prices job has never been able to save a daily snapshot
-- for ANY user (the table is completely empty). Run part 1 once to fix this
-- for everyone going forward; run part 2 to backfill 60 days of history for
-- the demo account so the chart has something to show right now.

-- ── 1. Fix RLS so the app can write snapshots (affects all users) ──
ALTER TABLE collection_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS collection_snapshots_app_access ON collection_snapshots;
CREATE POLICY collection_snapshots_app_access
  ON collection_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── 2. Re-runnable seed: 60 days of trending collection value ──
-- Ends today at $399.50 to match the demo account's current 10-card,
-- 15-quantity inventory total, with a gentle upward trend + daily noise.
DELETE FROM collection_snapshots WHERE user_email = 'hungergamesareawesome@gmail.com';

INSERT INTO collection_snapshots (user_email, captured_at, total_value, card_count, unique_count)
VALUES
    ('hungergamesareawesome@gmail.com', '2026-05-17', 328.91, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-18', 329.11, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-19', 336.62, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-20', 334.36, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-21', 336.43, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-22', 336.61, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-23', 335.12, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-24', 330.42, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-25', 329.97, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-26', 334, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-27', 336.18, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-28', 348.72, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-29', 345.33, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-30', 345.91, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-05-31', 342.16, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-01', 341.67, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-02', 340.45, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-03', 354.35, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-04', 354.75, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-05', 355.79, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-06', 350.78, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-07', 349.26, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-08', 359.42, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-09', 347.89, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-10', 360.61, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-11', 364.95, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-12', 363.63, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-13', 353.8, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-14', 358.54, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-15', 364.74, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-16', 356.45, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-17', 361.05, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-18', 366.02, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-19', 371.43, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-20', 364.69, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-21', 369.8, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-22', 362.79, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-23', 373.17, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-24', 374.01, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-25', 376.75, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-26', 378.76, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-27', 382.38, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-28', 382.93, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-29', 374.81, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-06-30', 385.69, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-01', 380.37, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-02', 389.4, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-03', 378.16, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-04', 390.65, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-05', 382.96, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-06', 379.81, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-07', 388.53, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-08', 382.33, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-09', 385.58, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-10', 399.29, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-11', 389.37, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-12', 391.92, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-13', 397.73, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-14', 400.83, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-15', 399.65, 15, 10),
    ('hungergamesareawesome@gmail.com', '2026-07-16', 399.5, 15, 10)
ON CONFLICT (user_email, captured_at) DO UPDATE
  SET total_value = EXCLUDED.total_value,
      card_count = EXCLUDED.card_count,
      unique_count = EXCLUDED.unique_count;
