-- ============================================================================
-- Vendor Network migration — run in the Supabase SQL Editor.
-- Design: docs/vendor-network-design.md
--
-- Idempotent where practical (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) so it is
-- safe to re-run. RLS is ENABLEd on every new table for safety, but it is NOT the
-- enforcement layer — the app talks to Postgres with a server-only publishable
-- key and enforces access in server actions (see the design doc).
-- ============================================================================

-- ── A. profiles (email-keyed, not UUID) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  user_email          text PRIMARY KEY,
  store_name          text,
  avatar_path         text,
  bio                 text,
  specialties         text[]  NOT NULL DEFAULT '{}',
  location_city       text,
  location_region     text,
  links               jsonb   NOT NULL DEFAULT '{}'::jsonb,
  is_vendor           boolean NOT NULL DEFAULT true,
  is_organizer        boolean NOT NULL DEFAULT false,
  profile_visibility  text    NOT NULL DEFAULT 'everyone'
                        CHECK (profile_visibility IN ('everyone','show_connected')),
  notify_new_message  boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── B. events (EXTEND) ──────────────────────────────────────────────────────
ALTER TABLE events ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published';
-- Backfill lifecycle from the legacy `published` flag before adding the CHECK.
UPDATE events SET status = CASE WHEN published THEN 'published' ELSE 'draft' END
  WHERE status NOT IN ('draft','published','live','ended','cancelled');
-- Two-tier show approval: organizer-submitted shows sit in 'pending_approval'
-- until an admin approves ('published') or rejects ('rejected'). review_note
-- carries the admin's rejection feedback back to the organizer.
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_status_check;
ALTER TABLE events ADD CONSTRAINT events_status_check
  CHECK (status IN ('draft','pending_approval','published','live','ended','cancelled','rejected'));
ALTER TABLE events ADD COLUMN IF NOT EXISTS review_note text;

ALTER TABLE events ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_image_path text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS country text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS timezone text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS starts_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_opens_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_closes_at timestamptz;
ALTER TABLE events ADD COLUMN IF NOT EXISTS vendor_capacity int;
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_slug ON events (slug) WHERE slug IS NOT NULL;

-- ── C. event_attendees (EXTEND → registration/approval record) ──────────────
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
-- Existing rows were open RSVPs = already attending → grandfather them to approved.
UPDATE event_attendees SET status = 'approved'
  WHERE status NOT IN ('pending','approved','waitlisted','rejected','cancelled');
ALTER TABLE event_attendees DROP CONSTRAINT IF EXISTS event_attendees_status_check;
ALTER TABLE event_attendees ADD CONSTRAINT event_attendees_status_check
  CHECK (status IN ('pending','approved','waitlisted','rejected','cancelled'));

ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS booth_label text;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS vendor_notes text;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS organizer_notes text;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS reviewed_by text;
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees (event_id, status);

-- ── D. event_listings (EXTEND → showcase visibility) ────────────────────────
ALTER TABLE event_listings ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'show_vendors';
ALTER TABLE event_listings DROP CONSTRAINT IF EXISTS event_listings_visibility_check;
ALTER TABLE event_listings ADD CONSTRAINT event_listings_visibility_check
  CHECK (visibility IN ('show_vendors','hidden'));
-- Per-card is_featured lives inside cards_json (ListedCard) — no column needed.

-- ── E. Messaging ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at          timestamptz NOT NULL DEFAULT now(),
  event_id            bigint REFERENCES events(id) ON DELETE SET NULL,
  listing_owner_email text
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_email      text   NOT NULL,
  last_read_at    timestamptz,
  PRIMARY KEY (conversation_id, user_email)
);
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_conv_participants_user ON conversation_participants (user_email);

CREATE TABLE IF NOT EXISTS messages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  conversation_id bigint NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_email    text   NOT NULL,
  body            text   NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_email text NOT NULL,
  blocked_email text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_email, blocked_email)
);
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS reports (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_email      text NOT NULL,
  reported_email      text,
  reported_message_id bigint REFERENCES messages(id) ON DELETE SET NULL,
  reason              text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ── F. Storage buckets (avatars + event covers, public-read) ────────────────
-- Uploads are performed by the server action via the server-side client; public
-- read lets the browser render images by path without a signed URL.
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('event-covers', 'event-covers', true)
  ON CONFLICT (id) DO NOTHING;

-- storage.objects has RLS on by default. Public buckets serve downloads without
-- a policy, but INSERT/UPDATE (our server-action uploads via the anon key) still
-- need one. Access is gated in the server actions (requireRealUser), so a
-- bucket-scoped policy for these two buckets is consistent with the app model.
DROP POLICY IF EXISTS "vendor_network_read"   ON storage.objects;
DROP POLICY IF EXISTS "vendor_network_insert" ON storage.objects;
DROP POLICY IF EXISTS "vendor_network_update" ON storage.objects;
CREATE POLICY "vendor_network_read" ON storage.objects
  FOR SELECT USING (bucket_id IN ('avatars','event-covers'));
CREATE POLICY "vendor_network_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('avatars','event-covers'));
CREATE POLICY "vendor_network_update" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('avatars','event-covers'))
  WITH CHECK (bucket_id IN ('avatars','event-covers'));

-- ── G. RLS policies for the new tables ──────────────────────────────────────
-- The app connects as the anon/publishable role (server-only key) and enforces
-- who-can-do-what in server actions, so these tables need permissive policies —
-- otherwise RLS-enabled-with-no-policy denies every write (Postgres 42501).
-- This mirrors how the existing tables (cards, events, …) are reachable by the
-- same key. Real access control lives in src/actions/* + src/lib/guards.ts.
-- Includes the pre-existing events-family tables: they had RLS ENABLEd (per the
-- marketplace design doc) but NO policies were ever added, so every read was
-- filtered to zero rows and every write failed with 42501. This is the first
-- migration to actually make them reachable by the anon key.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','conversations','conversation_participants',
    'messages','blocks','reports',
    'events','event_attendees','event_listings','card_offers'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO public USING (true) WITH CHECK (true)',
      t || '_all', t
    );
  END LOOP;
END $$;
