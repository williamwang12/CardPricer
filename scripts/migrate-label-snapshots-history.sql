-- Migrate label_snapshots from single-snapshot-per-user to full history.
--
-- The original table used user_email as the sole primary key, so only the
-- latest snapshot was kept (via UPSERT). This migration changes the primary
-- key to (user_email, downloaded_at) so every export is preserved.
--
-- Run this in the Supabase SQL editor.

-- 1. Drop the old primary key constraint
ALTER TABLE label_snapshots DROP CONSTRAINT label_snapshots_pkey;

-- 2. Add a composite primary key allowing multiple snapshots per user
ALTER TABLE label_snapshots ADD PRIMARY KEY (user_email, downloaded_at);

-- 3. Add an index for fast lookups of a user's snapshots sorted by date
CREATE INDEX IF NOT EXISTS idx_label_snapshots_user_date
  ON label_snapshots (user_email, downloaded_at DESC);
