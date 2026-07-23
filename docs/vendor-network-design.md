# Vendor Network: Registrations, Showcases & Messaging — Design Doc

## Status

**IMPLEMENTED — all 5 slices complete + two lifecycle gaps closed.** As of 2026-07-23
the whole feature is built and tested (297 unit tests + build green), committed on
branch **`vendor-network-v1`** (main checkout), **NOT pushed / NOT deployed** — the user
is testing locally first. See "Implementation progress log" immediately below for the
authoritative current state before doing anything else. The original design (spec
reconciliation, data model, authz rules) is preserved further down for reference.

This doc adapts the "Shows feature (vendor-to-vendor v1)" build prompt to the **actual**
CardParser web architecture, which differs from the prompt's assumptions in fundamental
ways. Read "Spec reconciliation" (further down) for why several pillars of the original
prompt do not apply as written.

---

## Implementation progress log

### Where things stand (2026-07-23)
- **All 5 build slices are DONE** (see "Build order" below): 1 profiles, 2 registration
  workflow, 3 showcase + directory, 4 messaging, 5 seed + in-app badge (email deferred).
- **Migration applied** to the production Supabase (incl. the permissive RLS policies —
  app connects as anon, so every table needs them or reads return 0 / writes 42501).
- **Branch `vendor-network-v1`** (main checkout). Key commits: `2bfc0d6` (lifecycle +
  offer UX + seed), `4e3bc2d` (un-hide Events/Messages in nav), `ef22673` (organizer
  self-application fix). **Not pushed; not deployed.** Merge to `main` to ship (push to
  main auto-deploys via Vercel git integration; Root Directory must stay `web`).
- **Local testing:** dev server on **:3001** (NEXTAUTH_URL is localhost:3001, so Google
  login only works on that port). Seed: `web/scripts/seed-vendor-network.mjs` (idempotent;
  writes to prod DB). "Events" + "Messages" are back in the nav; "/feedback" stays hidden.

### Work done beyond the original 5 slices (2026-07-23)
- **Event lifecycle auto-transition.** `web/src/lib/event-status.ts` `deriveEventStatus()`
  derives `live`/`ended` from `date`/`date_end` (day-granular, UTC "today"); only overrides
  a stored `published`/`live`, never explicit states (draft/pending/rejected/cancelled/
  stored-ended). Wired into all `db/events.ts` read paths; `listPublishedEvents` filters
  out derived-`ended` shows; `applyToEventAction` blocks `ended`. `EventLifecycleBadge`
  ("Live now" / "Ended") in EventsClient + EventDetailClient. **No cron — derived on read;
  stored status stays `published`.** `starts_at`/`ends_at` deliberately ignored (mostly
  unset; avoids tz math). 14 unit tests (`event-status.test.ts`).
- **Offer settlement = handshake only** (decision 2026-07-23). Accepting an offer still
  just flips status — no inventory move, no transaction (matches payments-out-of-scope +
  in-person shows). Added clearer "arrange pickup at the show" toast + row hint in
  OffersPanel.
- **Organizer self-application fix** (bug found in testing). An organizer/admin who
  manages a show is no longer treated as a vendor in it: `applyToEventAction` rejects when
  the caller `canManageEvent`; `listRegistrationsAction` excludes the show's creator from
  the applications list; the `/events` browse card shows "Manage show" (not Apply) + no
  reg badge for shows you organize. Deleted 2 stale self-application rows from prod. +3 tests.

### Decisions locked this session (2026-07-23)
1. **Offers → handshake only** (no txn, no inventory move). UX made clearer instead.
2. **Event lifecycle → auto-derive by date** (no organizer buttons, no cron; on-read).
3. **Email notifications → in-app badge only** (Resend deferred, unchanged from decision #7).

### Known constraint (important for testing)
**A global admin (`ADMIN_EMAILS`) has `canManageEvent = true` on EVERY show**, so the
event detail page always renders the OrganizerPanel for them and never the vendor
marketplace/showcase/offers/messaging view. An admin therefore **cannot experience the
vendor side** from their own account, and (by the new fix) cannot be a vendor at a show
they manage. To test the vendor flow: log in with a **non-admin** Google account (apply →
admin approves → marketplace), or temporarily remove your email from `ADMIN_EMAILS`. The
seed reflects this: the admin *organizes* the main "Demo:" show; all vendor data lives on
`@cardparser.demo` accounts.

### Remaining / open (pick up here next time)
- [ ] **Ship it:** merge `vendor-network-v1` → `main` once local testing passes.
- [ ] **Clean up seed data** in prod (`DELETE FROM events WHERE name LIKE 'Demo:%'`) before
      or after launch; the demo shows are currently live in the prod DB.
- [ ] **`card_offers` has no migration file** in `docs/` — table exists in the DB but the
      `CREATE TABLE` was never checked in. Add one for schema reproducibility.
- [ ] **Two divergent admin event-create paths:** `/admin/events` (legacy `published` bool,
      ignores the `status` enum/approval flow) vs `/events/manage` (status-driven).
      `togglePublishAction` can leave `status` stale. Consider retiring the legacy path.
- [ ] **Optional:** let an admin act as a vendor at shows they don't organize (currently the
      global-admin constraint above blocks it). Only if desired.
- [ ] **Email notifications (Resend)** — deferred; needs provider + `RESEND_API_KEY` + domain.
- [ ] **No e2e for authed multi-role flows** (Google OAuth blocks headless auth); coverage is
      vitest at the server-action layer + manual walkthrough via the seed.

---

---

## Spec reconciliation (what the prompt assumed vs. what this repo is)

The prompt was written for a Supabase-Auth + RLS app with a `profiles`/UUID identity
model. This repo is not that. Confirmed by reading the codebase:

| Prompt assumed | Reality in `web/` | Consequence |
|---|---|---|
| Supabase Auth, identity = `auth.uid()` (UUID) | **next-auth** (Google / Facebook / Guest, JWT). Identity = **`user_email` string**. `src/lib/auth.ts` | Every FK and authz check is email-keyed, not UUID. |
| RLS keyed to `auth.uid()` is the security boundary; pgTAP policy tests | Single shared server client with a **publishable (anon) key** (`sb_pub…`), **server-only** (never `NEXT_PUBLIC`). `src/lib/supabase.ts`. All access control is in **server actions + DB helpers** via `.eq("user_email", …)`. `auth.uid()` is always null. | Spec-style `auth.uid()` RLS + pgTAP are **architecturally impossible** without migrating auth. RLS is `ENABLE`d on every table for safety but is not the enforcement layer (documented precedent in `docs/marketplace-events-design.md`). |
| New `profiles` (UUID), `shows`, `show_vendor_registrations`, `show_listings` | No `profiles` table exists. A near-complete equivalent is already built: `events` (organizer-published), `event_attendees` (RSVP), `event_listings` (curated cards blob), `MarketplaceBrowser` (vendor↔vendor browsing), `card_offers`. | Extend the existing `events` domain in place; do **not** build a parallel `shows` schema. |
| No structured offers — negotiate in chat | A working structured `card_offers` state machine exists; **no chat** exists. | Add chat as a new capability; keep `card_offers` working alongside it. |
| Listings FK to inventory, never copy card data | `event_listings.cards_json` **copies** a curated card subset (deliberate — private cost basis must not leak; matches `show_snapshots`). | Keep the blob model; add visibility/featured fields to it. |
| Tests = pgTAP | Tests = **vitest** (mock the supabase client) + **playwright** e2e. | Test the real enforcement layer (server-action authz guards), not DB policies. |

### Decisions locked with the user (2026-07-21)

1. **Security model → keep app-layer authz.** Identity stays `user_email`; all access
   control enforced in server actions / DB helpers. No `auth.uid()` RLS, no pgTAP.
2. **Shows vs events → extend `events` in place.** Add an approval workflow, showcase
   visibility, and a vendor directory onto the existing events/attendees/listings stack.
   Reuse `MarketplaceBrowser`.
3. **Offers vs chat → add chat, keep offers.** Messaging is additive; `card_offers`
   continues to work.
4. **Messaging scope → shared show only.** Two users may start a conversation only when
   they share an event where **both are approved** attendees.
5. **Guests → browse-only.** Guest logins (`guest-…@cardparser.guest`) may browse public
   events and (visibility-permitting) profiles, but **cannot** apply to shows, publish a
   showcase, make offers, or message. Those actions require a real (Google/Facebook) login.

6. **Organizer model → admin or granted organizer.** Event creation is allowed for an
   `ADMIN_EMAILS` admin **or** a user with `profiles.is_organizer=true`, where
   `is_organizer` is granted by an admin (not a self-serve toggle).
7. **Email notifications → in-app only for v1.** No email provider is added this release;
   ship the in-app unread badge + per-thread markers. Email is deferred to a later phase.

---

## Scope

**In:** vendor application + organizer approval workflow; per-show showcase with
visibility/featured; vendor directory + profiles (email-keyed); vendor↔vendor messaging
(conversations, threads, unread state) with block & report; in-app new-message badge.

**Out (unchanged from prompt):** payments; a buyer/attendee role; an admin moderation UI
(the `reports` table + a server-only read path is enough); browser-side Supabase Realtime
(see "Messaging transport"); any change to the import → match → price → snapshot pipeline
or to `src/lib/auth.ts`.

---

## Data model changes

All new tables mirror existing conventions: `bigint … GENERATED ALWAYS AS IDENTITY` PK,
`user_email text` identity, `ALTER TABLE … ENABLE ROW LEVEL SECURITY` (safety, not
enforcement), FKs `ON DELETE CASCADE`. `text[]` and `jsonb` are used where the prompt asks
for arrays/links.

### A. `profiles` (NEW — email-keyed, not UUID)

One row per user, created lazily on first profile save (or first login via an upsert in
the auth flow — see "Profile bootstrap").

| Column | Type | Notes |
|---|---|---|
| `user_email` | `text` PRIMARY KEY | matches app identity; **no UUID** |
| `store_name` | `text` | display name for the directory |
| `avatar_path` | `text` | key in the `avatars` Storage bucket (nullable) |
| `bio` | `text` | |
| `specialties` | `text[]` | e.g. `{vintage,graded,japanese}` |
| `location_city` | `text` | |
| `location_region` | `text` | |
| `links` | `jsonb` | `{ ebay?, instagram?, whatnot?, … }` |
| `is_vendor` | `boolean` NOT NULL DEFAULT `true` | everyone is a vendor in v1 |
| `is_organizer` | `boolean` NOT NULL DEFAULT `false` | see "Open decisions" |
| `profile_visibility` | `text` NOT NULL DEFAULT `'everyone'` | CHECK `IN ('everyone','show_connected')` |
| `notify_new_message` | `boolean` NOT NULL DEFAULT `true` | mute switch for message notifications |
| `created_at` / `updated_at` | `timestamptz` DEFAULT `now()` | |

**`show_connected`** = the viewer shares ≥1 event where both viewer and profile owner are
**approved** attendees. Computed in a DB helper, not RLS.

### B. `events` (EXTEND existing)

The existing `events` table has `published boolean` and no lifecycle/registration fields.
Add, all `ADD COLUMN IF NOT EXISTS` so existing rows survive:

| New column | Type | Notes |
|---|---|---|
| `status` | `text` NOT NULL DEFAULT `'published'` | CHECK `IN ('draft','published','live','ended','cancelled')`. Backfill: `published=true → 'published'`, else `'draft'`. `published` is **kept** and mirrored for back-compat this release. |
| `slug` | `text` UNIQUE | nullable until backfilled |
| `cover_image_path` | `text` | Storage key |
| `city` / `region` / `country` | `text` | prompt's address split; `venue_address` already exists |
| `timezone` | `text` | IANA string, e.g. `America/New_York` — store it, never assume server tz |
| `starts_at` / `ends_at` | `timestamptz` | precise times; existing `date`/`date_end` stay for back-compat |
| `registration_opens_at` / `registration_closes_at` | `timestamptz` | nullable = always open |
| `vendor_capacity` | `int` | nullable = uncapped |

### C. `event_attendees` (EXTEND — becomes the registration/approval record)

Currently an open RSVP (upsert = instantly attending). Becomes an application with a
review state. Add:

| New column | Type | Notes |
|---|---|---|
| `status` | `text` NOT NULL DEFAULT `'pending'` | CHECK `IN ('pending','approved','waitlisted','rejected','cancelled')`. **Backfill existing rows → `'approved'`** so current attendees keep access. |
| `booth_label` | `text` | prompt's `booth_label`; existing `table_number` is retained and used as the value |
| `vendor_notes` | `text` | applicant message to organizer |
| `organizer_notes` | `text` | internal |
| `reviewed_at` | `timestamptz` | |
| `reviewed_by` | `text` | organizer email |

`UNIQUE (event_id, user_email)` already exists. **Behavior change:** applying inserts
`status='pending'`; the organizer moves it to approved/waitlisted/rejected. Every
downstream gate ("attendee") becomes **"approved attendee."**

### D. `event_listings` (EXTEND — showcase visibility)

Keep the `cards_json` blob (do not normalize — private inventory must not leak). Add:

| New column | Type | Notes |
|---|---|---|
| `visibility` | `text` NOT NULL DEFAULT `'show_vendors'` | CHECK `IN ('show_vendors','hidden')` |

Per-card `is_featured` is added inside the `ListedCard` shape (blob field), alongside the
existing `asking_price` (= prompt's `show_price`) and `quantity` (= `quantity_available`).
No schema change needed for those.

### E. Messaging (NEW tables)

```
conversations
  id            bigint PK
  created_at    timestamptz DEFAULT now()
  event_id      bigint NULL REFERENCES events(id) ON DELETE SET NULL   -- provenance
  listing_owner_email text NULL   -- "message about this vendor's showcase" provenance
  -- (no listing_id FK: listings are per-vendor blobs, not per-card rows; we record
  --  the event + the other vendor's email as context instead)

conversation_participants
  conversation_id bigint REFERENCES conversations(id) ON DELETE CASCADE
  user_email      text
  last_read_at    timestamptz NULL
  PRIMARY KEY (conversation_id, user_email)

messages
  id              bigint PK
  conversation_id bigint REFERENCES conversations(id) ON DELETE CASCADE
  sender_email    text NOT NULL
  body            text NOT NULL
  created_at      timestamptz DEFAULT now()
  INDEX (conversation_id, created_at)          -- insert-only; no edit/delete in v1

blocks
  blocker_email text
  blocked_email text
  created_at    timestamptz DEFAULT now()
  PRIMARY KEY (blocker_email, blocked_email)

reports
  id                  bigint PK
  reporter_email      text NOT NULL
  reported_email      text NULL
  reported_message_id bigint NULL REFERENCES messages(id) ON DELETE SET NULL
  reason              text NOT NULL
  created_at          timestamptz DEFAULT now()
```

Direct (1:1) conversations only in v1. Starting a conversation is idempotent: reuse the
existing 2-party conversation if one exists.

**Unread** = `messages` in a conversation with `created_at > participant.last_read_at`
(or `last_read_at IS NULL`). Badge = count of conversations with any unread.

---

## Authorization rules (enforced in server actions — the real boundary)

Mirrors the table in `docs/marketplace-events-design.md`. A private
`requireApprovedAttendee(eventId)` helper (getUserEmail + status='approved' check)
replaces the current `requireAttendee`.

| Action | Who |
|---|---|
| Create/edit/publish/delete an event | organizer of that event (see Open decisions) |
| Apply to an event (`status='pending'`) | any authenticated vendor, if registration open + not at capacity |
| Cancel own application | the applicant |
| Read applications for an event; set status; assign booth | the event's organizer only |
| Publish/edit/delete **my** showcase listing | approved attendee of that event |
| **Browse** another vendor's showcase | approved attendee of the same event, `visibility='show_vendors'` — **not** pending/waitlisted/rejected |
| Read the vendor directory for an event | approved attendee of that event |
| Read a profile's base fields | if `profile_visibility='everyone'`, anyone; if `'show_connected'`, only share-an-approved-show viewers |
| Start a conversation with X | both parties approved in a shared event **and** neither has blocked the other |
| Read/post in a conversation | participants only; messages insert-only |
| Block / report | any user, for themselves; reports readable only server-side (no client read path) |

Offer actions (`makeOffer`/accept/decline/withdraw) are unchanged, but their
`requireAttendee` gate is upgraded to `requireApprovedAttendee`.

**Guests are browse-only.** A `requireRealUser()` helper rejects
`…@cardparser.guest` emails (and any guest-provider session). It gates every write/social
action — apply, publish showcase, offer, start conversation, block, report — while leaving
public browsing and visibility-permitting profile reads open. `requireApprovedAttendee`
implies `requireRealUser` (a guest can never reach `approved`).

---

## Messaging transport (deviation from prompt — documented)

The prompt specifies a **Supabase Realtime browser subscription**. That is unsafe here:
the publishable key is server-only today, and RLS is effectively open (no `auth.uid()`).
A browser Realtime subscription would require shipping the key to the browser, where —
with open RLS — any user could read **all** messages directly, bypassing every app-layer
guard. That is a cross-vendor data leak.

**v1 transport:** near-real-time via **server-action polling** (React Query
`refetchInterval`, ~5s while a thread is open; the app already uses `@tanstack/react-query`).
Optimistic send is still done client-side. This keeps 100% of data access behind
server actions, consistent with the entire existing app.

True push Realtime is deferred: it requires either migrating to Supabase Auth or a
server-brokered socket — out of scope for v1 and noted for a future phase.

---

## Avatars & cover images (Storage)

Create a **public-read** `avatars` bucket (and `event-covers`). Uploads go through a
**server action** that receives the file and writes with the server-side client, then
stores the returned key in `profiles.avatar_path` / `events.cover_image_path`. No browser
Supabase client, no client-exposed key — consistent with the transport decision.

---

## Notifications

- **In-app (build now):** unread badge in `nav.tsx` from a `getUnreadCountAction`;
  per-thread unread markers; `notify_new_message` mute flag respected.
- **Email (FLAGGED — needs a decision, per prompt):** the repo has **no** email pathway
  (no provider dep, no `RESEND_*`/`SENDGRID_*`/SMTP env — only auth + supabase + admin
  envs). Recommendation: **Resend** (`resend` npm pkg + `RESEND_API_KEY`), triggered from
  the send-message server action when the recipient has no recent activity and
  `notify_new_message=true`. **Not implemented until the user approves the provider + env.**

---

## New / modified files

**New DB helpers** (`src/lib/db/`): `profiles.ts`, `registrations.ts` (or extend
`event-attendees.ts`), `conversations.ts`, `messages.ts`, `blocks.ts`, `reports.ts`.
**New actions** (`src/actions/`): `profiles.ts`, `registrations.ts`, `messaging.ts`.
**Extend actions:** `events.ts` (lifecycle/capacity/registration windows, review flow),
`marketplace.ts` (`requireApprovedAttendee`, listing visibility).
**New pages/components:** organizer applications inbox + show dashboard; vendor apply flow;
vendor directory (`VendorDirectory.tsx`) + showcase view; profile edit + public view;
conversations list + thread view; block/report menu. Reuse `MarketplaceBrowser`,
shadcn `ui/*`, and the `AdminEventsClient` form patterns.
**Modified:** `types.ts` (new interfaces + extended `Event`/`EventAttendee`/`ListedCard`);
`nav.tsx` (Messages link + unread badge, Directory); `(auth)/events/[id]/page.tsx`
(approved-gating). **Untouched:** `src/lib/auth.ts`, import/price/snapshot pipeline.

---

## Testing (vitest + playwright, not pgTAP)

The enforcement layer is server actions, so tests target that (mock the supabase client
the way `shows.test.ts` / `cards.test.ts` do). Minimum authz coverage, reframing the
prompt's four required policy tests onto the real boundary:

1. **Unapproved (pending) vendor cannot browse an event's showcases** (`browseListings` throws).
2. **Vendor A cannot read Vendor B's registration** (only the organizer can).
3. **Non-participant cannot read a conversation's messages.**
4. **Blocked user cannot start a conversation** with the blocker.

Plus: apply→approve→browse happy path; unread-count math; visibility='hidden' hides a
listing; profile `show_connected` visibility. One playwright e2e per role
(organizer, approved vendor, pending vendor).

---

## Build order (reviewable slices — commit + verify each)

1. **Migration + types + profiles.** All schema changes above (extend events/attendees/
   listings, new profiles + messaging + blocks/reports tables, backfill existing rows to
   `approved`/`published`). `profiles` DB helper + edit UI + avatar upload + visibility.
   Verify: existing events/marketplace/offers still work unchanged after backfill.
2. **Registration workflow.** Apply (pending) → organizer inbox (approve/waitlist/reject,
   assign booth) → gating flips to `requireApprovedAttendee`. Organizer show dashboard
   (counts only). Verify as organizer + pending + approved vendor.
3. **Showcase + directory.** Listing `visibility`/`is_featured`; vendor directory of
   approved vendors → showcase view; message button surfaces. Reuse `MarketplaceBrowser`.
4. **Messaging.** conversations/messages/participants; thread view with polling; unread
   state + nav badge; block + report actions on every profile and thread.
5. **Notifications + polish.** In-app badge wired; empty states; email **only if** provider
   approved. Seed script: 1 organizer, 1 published show, 3 approved vendors with showcases.

After each slice: run `npm run test`, `npm run build`, and exercise the slice as each role
before moving on. Summarize deviations from this doc as they arise.

---

## Two-tier approval (revision 2026-07-21)

Shows and vendors are BOTH approval-gated, in a chain:

1. **Organizer access** — an admin grants `profiles.is_organizer = true` directly
   (no request queue). Mechanism: a "Grant organizer" tool on the admin page.
2. **Show approval (Tier 1)** — an organizer creating a show submits it as
   `status = 'pending_approval'`; it is invisible to vendors until an **admin**
   approves it (`→ 'published'`) or rejects it (`→ 'rejected'`, terminal). Shows
   an **admin** creates auto-publish (`→ 'published'`, no queue).
3. **Vendor join (Tier 2)** — vendors apply to a published show (`pending`); the
   show's **organizer or an admin** approves (existing registration workflow).

Event `status` gains `'pending_approval'` and `'rejected'`; a `review_note` column
carries admin feedback on rejection. Vendor-facing listings show only
`status IN ('published','live')`. Gates: `createShowAction` → `requireOrganizer`
(admin ⇒ published, else pending); `approveShow`/`rejectShow`/`setOrganizer` →
`requireAdmin`; vendor review → `requireEventOrganizer` (creator or admin).

## Open decisions

All resolved 2026-07-21 — see locked decisions #5 (guests browse-only), #6 (organizer =
admin or admin-granted `is_organizer`), #7 (in-app notifications only; email deferred).
Slice 5's email half is dropped for v1; the seed script and in-app badge remain.

**Organizer gate:** a `requireOrganizer(eventId?)` helper allows the action when
`isAdmin(email)` **or** `profiles.is_organizer=true`; for edit/delete it additionally
requires the caller to own the event (`events.created_by = email`). Admins can grant
`is_organizer` (mechanism: extend the existing admin area — deferred UI, a DB flag flip is
enough for v1).
```
