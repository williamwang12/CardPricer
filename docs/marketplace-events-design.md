# Vendor Marketplace / Public Events — Design Doc

## Overview

Add an **admin-curated events catalog**, distinct from the existing personal
`shows` feature (which is a vendor's private pre/post inventory snapshot +
shelf-life tracker). Flow:

1. Admin publishes a show event (name, date, venue).
2. Vendors browse published events and mark themselves as **attending**.
3. For events they're attending, vendors **publish a listing** — a curated
   subset of their inventory they're willing to sell/trade at that show.
4. Any vendor attending the same event can **browse other attendees'
   listings** (never non-attendees, never the vendor's full private
   inventory — only what they explicitly listed).
5. Vendors can **make an offer** on another attendee's listed card(s). The
   seller can accept/decline; the buyer can withdraw a pending offer.

This is purely additive — it does not touch `shows`, `show_snapshots`, or
`card_shelf_life`.

---

## Why not reuse the existing `shows` table?

`shows` is single-tenant per row (`user_email` = the vendor who created it) —
it's each vendor's *private* record of one show they went to. This feature
needs a *shared* row multiple vendors reference (the event) plus per-vendor
attendance/listing/offer records hanging off it. Keeping them separate avoids
overloading one table with two different ownership models. A future,
optional enhancement (not in scope here) could add a nullable `event_id` FK
on `shows` so a vendor can link "my private show tracking" to "the public
event," but that's deferred.

---

## Admin access model

There's currently no `role`/`is_admin` concept anywhere in the app —
multi-tenancy is just `user_email` string matching in server actions, using
a service-role Supabase key (RLS is enabled but bypassed by that key, same
as the existing `shows` tables). Simplest fit for this codebase:

```ts
// web/src/lib/admin.ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export async function requireAdmin(email: string): Promise<void> {
  if (!isAdmin(email)) throw new Error("Admin access required");
}
```

`ADMIN_EMAILS` is a new comma-separated env var (e.g.
`ADMIN_EMAILS=you@example.com,partner@example.com`). No schema change
needed. All admin-only server actions call `requireAdmin(email)` first,
mirroring the `getUserEmail()` guard pattern already used in
`actions/shows.ts`.

---

## New Supabase Tables

### 1. `events` (admin-managed)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `name` | `text` | NOT NULL | e.g. "Pokemon League June 2026" |
| `date` | `date` | NOT NULL | |
| `date_end` | `date` | nullable | |
| `venue_name` | `text` | nullable | |
| `venue_address` | `text` | nullable | |
| `venue_type` | `text` | NOT NULL, default `'other'` | reuses existing `VenueType` values |
| `description` | `text` | nullable | Shown to vendors browsing |
| `published` | `boolean` | NOT NULL, default `true` | Unpublished = admin draft, hidden from vendors |
| `created_by` | `text` | NOT NULL | Admin email who created it |
| `created_at` | `timestamptz` | default `now()` | |

### 2. `event_attendees` (vendor RSVPs)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `event_id` | `bigint` | NOT NULL, FK -> `events.id` ON DELETE CASCADE | |
| `user_email` | `text` | NOT NULL | |
| `table_number` | `text` | nullable | Optional, vendor can self-report |
| `created_at` | `timestamptz` | default `now()` | |
| UNIQUE | | `(event_id, user_email)` | One RSVP per vendor per event; un-RSVP = row delete |

### 3. `event_listings` (what a vendor is bringing/selling)

One row per vendor per event, JSON blob — same pattern as `show_snapshots`
(Design Decision #1 in the shows doc: JSON blob keeps this a single read,
avoids a second normalized table, and this is a *curated* export, not raw
inventory).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `event_id` | `bigint` | NOT NULL, FK -> `events.id` ON DELETE CASCADE | |
| `user_email` | `text` | NOT NULL | Listing owner/seller |
| `cards_json` | `text` | NOT NULL | JSON array of `ListedCard[]` (see below) |
| `updated_at` | `timestamptz` | default `now()` | |
| UNIQUE | | `(event_id, user_email)` | One listing per vendor per event; re-publish overwrites |

```ts
interface ListedCard {
  name: string;
  number: string;
  quantity: number;
  asking_price: number | null; // vendor's price at this show, can differ from market_price
  market_price: number | null; // snapshot for buyer reference
}
```

Vendors build this by picking cards out of their existing `cards` table in
the UI (checkbox list + optional asking price override) — it's a deliberate
export, not their live full inventory, so private cost basis / cards they
don't want to sell never leak to other vendors.

### 4. `card_offers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `bigint` | PK, auto-increment | |
| `event_id` | `bigint` | NOT NULL, FK -> `events.id` ON DELETE CASCADE | |
| `seller_email` | `text` | NOT NULL | Listing owner |
| `buyer_email` | `text` | NOT NULL | Offerer |
| `card_key` | `text` | NOT NULL | `cardKey(name, number)`, same helper as `diff.ts` |
| `card_name` | `text` | NOT NULL | Denormalized for display |
| `card_number` | `text` | NOT NULL | |
| `quantity` | `int` | NOT NULL | |
| `offer_amount` | `numeric` | NOT NULL | Total offer, not per-card |
| `message` | `text` | nullable | Optional note from buyer |
| `status` | `text` | NOT NULL, default `'pending'`, CHECK `IN ('pending','accepted','declined','withdrawn')` | |
| `created_at` | `timestamptz` | default `now()` | |
| `responded_at` | `timestamptz` | nullable | Set on accept/decline/withdraw |
| CHECK | | `buyer_email <> seller_email` | Can't offer on your own listing |

Indexes: `(event_id, seller_email)`, `(event_id, buyer_email)`.

---

## SQL Migration

```sql
-- 1. Events (admin-managed)
CREATE TABLE events (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name           text NOT NULL,
  date           date NOT NULL,
  date_end       date,
  venue_name     text,
  venue_address  text,
  venue_type     text NOT NULL DEFAULT 'other',
  description    text,
  published      boolean NOT NULL DEFAULT true,
  created_by     text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_published ON events (published, date);

-- 2. Attendees (RSVPs)
CREATE TABLE event_attendees (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id      bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_email    text NOT NULL,
  table_number  text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_email)
);
CREATE INDEX idx_event_attendees_event ON event_attendees (event_id);
CREATE INDEX idx_event_attendees_user ON event_attendees (user_email);

-- 3. Listings (curated per-vendor inventory for an event)
CREATE TABLE event_listings (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id    bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  cards_json  text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_email)
);
CREATE INDEX idx_event_listings_event ON event_listings (event_id);

-- 4. Offers
CREATE TABLE card_offers (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id       bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  seller_email   text NOT NULL,
  buyer_email    text NOT NULL,
  card_key       text NOT NULL,
  card_name      text NOT NULL,
  card_number    text NOT NULL,
  quantity       int NOT NULL,
  offer_amount   numeric NOT NULL,
  message        text,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','declined','withdrawn')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  responded_at   timestamptz,
  CHECK (buyer_email <> seller_email)
);
CREATE INDEX idx_card_offers_event_seller ON card_offers (event_id, seller_email);
CREATE INDEX idx_card_offers_event_buyer ON card_offers (event_id, buyer_email);

-- 5. RLS (service key bypasses; enabled for safety, same as other tables)
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_offers ENABLE ROW LEVEL SECURITY;
```

---

## Authorization rules (enforced in server actions, not DB RLS)

| Action | Who |
|--------|-----|
| Create/edit/publish/delete event | `isAdmin(email)` only |
| List published events, RSVP / un-RSVP | Any authenticated vendor |
| Publish/update/delete **my own** listing for an event | Any attendee of that event (must have RSVP'd) |
| **View** another vendor's listing for an event | Only vendors who are themselves attendees of that same event |
| Create an offer | Attendee of the event, `buyer_email !== seller_email`, listing must still exist |
| Accept/decline an offer | Only the `seller_email` on that offer |
| Withdraw an offer | Only the `buyer_email` on that offer, only while `status = 'pending'` |

---

## Offer semantics (key decision)

Offers are a **negotiation/communication tool only**. Accepting an offer:
- Flips `status` to `'accepted'` and stamps `responded_at`
- Does **not** automatically decrement the seller's `cards` inventory or
  create a `transactions` row

Rationale: the actual card-for-cash exchange happens in person at the show,
so trusting a remote "accept" click to represent a completed physical
transaction is risky (no-shows, partial fulfillment, disputes). After
accepting, the seller is expected to log the sale afterward through the
existing Transactions / show-snapshot flow, same as any other sale.

*(Noted as a possible Phase 2+ enhancement once there's a need for stronger
guarantees: e.g., auto-suggest logging a transaction when an offer is marked
accepted, prefilled with the offer's card/amount.)*

---

## New Files

| File | Purpose |
|------|---------|
| `web/src/lib/admin.ts` | `isAdmin()`, `requireAdmin()` helpers reading `ADMIN_EMAILS` |
| `web/src/lib/db/events.ts` | CRUD for `events` |
| `web/src/lib/db/event-attendees.ts` | RSVP / un-RSVP, list attendees, check "am I attending" |
| `web/src/lib/db/event-listings.ts` | Save/load a vendor's listing blob for an event |
| `web/src/lib/db/offers.ts` | Create/accept/decline/withdraw offers, list by seller/buyer |
| `web/src/actions/events.ts` | Server actions: admin event CRUD, list published events, RSVP |
| `web/src/actions/marketplace.ts` | Server actions: publish my listing, browse other attendees' listings (gated), offer CRUD |
| `web/src/app/(auth)/events/page.tsx` | Public events list + RSVP button (server component) |
| `web/src/app/(auth)/events/[id]/page.tsx` | Event detail: my listing editor, marketplace browser, offers panel |
| `web/src/app/(auth)/admin/events/page.tsx` | Admin-only event management (create/edit/publish), redirects non-admins |
| `web/src/components/events/EventsClient.tsx` | Events list UI + RSVP toggle |
| `web/src/components/events/EventDetailClient.tsx` | Tabs: My Listing / Browse Marketplace / My Offers |
| `web/src/components/events/MarketplaceBrowser.tsx` | Grid of other attendees' listed cards + "Make Offer" dialog |
| `web/src/components/events/OffersPanel.tsx` | Incoming offers (accept/decline) + outgoing offers (withdraw), with status badges |
| `web/src/components/admin/AdminEventsClient.tsx` | Admin create/edit/publish form + event list |

## Modified Files

| File | Change |
|------|--------|
| `web/src/components/nav.tsx` | Add "Events" link for all users; add "Admin" link only when `isAdmin(session.user.email)` |
| `web/src/lib/types.ts` | Add `Event`, `EventAttendee`, `ListedCard`, `EventListing`, `CardOffer`, `OfferStatus` types |
| `.env.local` / deployment env | Add `ADMIN_EMAILS` |

---

## Implementation Phases

### Phase 1 — Schema + admin gate
- Run SQL migration
- `lib/admin.ts` + `ADMIN_EMAILS` env var
- `db/events.ts`, `actions/events.ts` (admin CRUD only)
- Admin events page (create/edit/publish), guarded by `requireAdmin`
- *Test*: non-admin gets rejected, admin can create/publish an event

### Phase 2 — Vendor RSVP
- `db/event-attendees.ts`
- Public `/events` list page (published events only) + "I'm Going" / "Cancel" button
- *Test*: RSVP, un-RSVP, attendee count updates

### Phase 3 — Listings
- `db/event-listings.ts`
- "Publish my listing" UI on event detail page: checkbox-select from current
  `cards`, override asking price per card, save as `ListedCard[]` blob
- *Test*: publish listing, edit it, verify only the selected cards appear

### Phase 4 — Marketplace browse (attendee-gated)
- `getEventListingsAction`: reject if caller isn't an attendee of that event
- `MarketplaceBrowser.tsx`: list other attendees' listings, card search/filter
- *Test*: non-attendee is blocked; attendee sees other vendors' listings but not their own again

### Phase 5 — Offers
- `db/offers.ts`, offer CRUD actions with authorization checks above
- "Make Offer" dialog on a listed card → creates pending offer
- `OffersPanel.tsx`: incoming (accept/decline) and outgoing (withdraw) tabs, toast notifications
- *Test*: full offer lifecycle (create → accept / decline / withdraw), cross-user authorization rejects wrong actors

### Phase 6 — Polish
- Nav links ("Events", conditional "Admin")
- Empty states, offer status badges, revalidatePath wiring
- Optional: link a vendor's personal `shows` row to an `event_id` (deferred/no scope yet)

---

## Resolved questions

1. **Admin identification** — `ADMIN_EMAILS` env var (comma-separated). No schema change.
2. **Offer amount granularity** — total offer amount for the whole quantity, not per-card.
3. **Multiple listings per event** — one listing blob per vendor per event (edit in place via upsert).
4. **Table/booth number** — yes, included as optional field on `event_attendees`.

---

## Implementation Details

### Types (`web/src/lib/types.ts` — MODIFY)

Append after `ShelfLifeEntry`:

```ts
// ── Events / Marketplace ─────────────────────────────────────────────────────

export interface Event {
  id: number;
  name: string;
  date: string;
  date_end: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_type: VenueType;
  description: string | null;
  published: boolean;
  created_by: string;
  created_at: string;
}

export interface EventInput {
  name: string;
  date: string;
  date_end?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_type: VenueType;
  description?: string | null;
  published?: boolean;
}

export interface EventAttendee {
  id: number;
  event_id: number;
  user_email: string;
  table_number: string | null;
  created_at: string;
}

export interface ListedCard {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
  asking_price: number | null;
}

export interface EventListing {
  id: number;
  event_id: number;
  user_email: string;
  cards_json: ListedCard[];
  updated_at: string;
}

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface CardOffer {
  id: number;
  event_id: number;
  seller_email: string;
  buyer_email: string;
  card_key: string;
  card_name: string;
  card_number: string;
  quantity: number;
  offer_amount: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
  responded_at: string | null;
}
```

### Admin utility (`web/src/lib/admin.ts` — NEW)

```ts
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

// For server actions — authenticates + authorizes, returns email
export async function requireAdmin(): Promise<string> {
  const { auth } = await import("@/lib/auth");
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  if (!isAdmin(email)) throw new Error("Admin access required");
  return email;
}
```

### Database layer

All follow the pattern in `lib/db/shows.ts`: `const TABLE`, supabase queries, throw on error.

#### `web/src/lib/db/events.ts` — NEW
- `createEvent(event: EventInput, createdBy: string): Promise<Event>`
- `updateEvent(eventId: number, fields: Partial<EventInput>): Promise<void>`
- `deleteEvent(eventId: number): Promise<void>`
- `getEvent(eventId: number): Promise<Event | null>`
- `listAllEvents(): Promise<Event[]>` — ordered by date desc (admin)
- `listPublishedEvents(): Promise<Event[]>` — `.eq("published", true)`

#### `web/src/lib/db/event-attendees.ts` — NEW
- `rsvpToEvent(eventId, userEmail, tableNumber?): Promise<EventAttendee>` — upsert
- `unRsvp(eventId, userEmail): Promise<void>`
- `listAttendees(eventId): Promise<EventAttendee[]>`
- `isAttendee(eventId, userEmail): Promise<boolean>` — maybeSingle
- `updateTableNumber(eventId, userEmail, tableNumber): Promise<void>`
- `getMyRsvps(userEmail): Promise<EventAttendee[]>` — all RSVPs for a user (for attendeeMap)

#### `web/src/lib/db/event-listings.ts` — NEW
- `saveListing(eventId, userEmail, cards: ListedCard[]): Promise<EventListing>` — upsert, JSON.stringify
- `getMyListing(eventId, userEmail): Promise<EventListing | null>` — JSON.parse cards_json
- `deleteListing(eventId, userEmail): Promise<void>`
- `listEventListings(eventId): Promise<EventListing[]>` — JSON.parse each

#### `web/src/lib/db/offers.ts` — NEW
- `createOffer({...}): Promise<CardOffer>`
- `updateOfferStatus(offerId, status): Promise<void>` — also sets responded_at
- `getOffer(offerId): Promise<CardOffer | null>`
- `listOffersForEvent(eventId, userEmail): Promise<{incoming, outgoing}>`
- `deleteOffersForListing(eventId, userEmail): Promise<void>` — cleanup

### Server actions

Follow `actions/shows.ts` pattern: `"use server"`, private `getUserEmail()`, thin wrappers, `revalidatePath()`.

#### `web/src/actions/events.ts` — NEW

Admin actions (call `requireAdmin()`):
- `createEventAction(input: EventInput): Promise<Event>`
- `updateEventAction(eventId, fields): Promise<void>`
- `deleteEventAction(eventId): Promise<void>`
- `togglePublishAction(eventId, published): Promise<void>`

Vendor actions (call `getUserEmail()`):
- `rsvpAction(eventId, tableNumber?): Promise<EventAttendee>` — validates published
- `unRsvpAction(eventId): Promise<void>` — cleans up listing + offers first
- `updateTableNumberAction(eventId, tableNumber): Promise<void>`

#### `web/src/actions/marketplace.ts` — NEW

Private `requireAttendee(eventId)` — getUserEmail + isAttendee.

- `saveListingAction(eventId, cards: ListedCard[]): Promise<EventListing>`
- `deleteListingAction(eventId): Promise<void>` — also deletes offers
- `browseListingsAction(eventId): Promise<EventListing[]>` — excludes own
- `makeOfferAction(eventId, sellerEmail, cardKey, cardName, cardNumber, quantity, offerAmount, message?): Promise<CardOffer>`
- `acceptOfferAction(offerId): Promise<void>` — seller only, pending only
- `declineOfferAction(offerId): Promise<void>` — seller only, pending only
- `withdrawOfferAction(offerId): Promise<void>` — buyer only, pending only
- `listMyOffersAction(eventId): Promise<{incoming, outgoing}>`

### Nav + layout updates

#### `web/src/components/nav.tsx` — MODIFY
- Add `isAdmin?: boolean` to `NavProps`
- Add `{ href: "/events", label: "Events" }` to NAV_LINKS
- Compute `links` inside component: append `{ href: "/admin/events", label: "Admin" }` when `isAdmin`
- Replace `NAV_LINKS.map(...)` with `links.map(...)` (desktop line 61 + mobile line 129)

#### `web/src/app/(auth)/layout.tsx` — MODIFY
- Import `isAdmin` from `@/lib/admin`, compute `adminFlag`, pass to `<Nav>`

#### `web/src/app/(public)/layout.tsx` — MODIFY
- Same: import `isAdmin`, compute from optional email, pass to `<Nav>`

### Pages + components

#### `web/src/app/(auth)/events/page.tsx` — NEW
Server component. Fetch published events + build attendeeMap via single
`getMyRsvps(email)` query. Render `<EventsClient>`.

#### `web/src/components/events/EventsClient.tsx` — NEW
- Event list with name, date range, venue, "Attending" badge
- RSVP / Un-RSVP button per event, optimistic updates + toast
- Links to `/events/[id]`

#### `web/src/app/(auth)/events/[id]/page.tsx` — NEW
Server component. Loads event, attending status, attendees, myListing,
myInventory (if attending), otherListings (if attending), offers.
Passes all to `<EventDetailClient>`.

#### `web/src/components/events/EventDetailClient.tsx` — NEW
Header + three shadcn Tabs when attending:
- **My Listing** — checkbox table from inventory, asking price inputs, save/delete
- **Browse** — renders `<MarketplaceBrowser>`
- **Offers** — renders `<OffersPanel>`

When not attending: "RSVP to access the marketplace" prompt.

#### `web/src/components/events/MarketplaceBrowser.tsx` — NEW
- Groups cards by vendor, card table per vendor
- "Offer" button opens shadcn Dialog with price input + message
- Calls `makeOfferAction`, toast feedback

#### `web/src/components/events/OffersPanel.tsx` — NEW
- Sub-tabs: Incoming / Outgoing with pending counts
- Status badges (yellow/green/red/gray)
- Accept/Decline buttons for incoming, Withdraw for outgoing
- Optimistic updates

#### `web/src/app/(auth)/admin/events/page.tsx` — NEW
Server component. `isAdmin` check, redirect non-admins. Render `<AdminEventsClient>`.

#### `web/src/components/admin/AdminEventsClient.tsx` — NEW
- Mirrors ShowsClient pattern: Dialog form + list with action buttons
- Publish/Draft badge, eye toggle, edit, delete
- Form: name, dates, venue fields, venue type select, description textarea

### Implementation order

1. SQL migration (Supabase SQL Editor)
2. `lib/types.ts` (append types)
3. `lib/admin.ts` (new)
4. DB layer: `events.ts`, `event-attendees.ts`, `event-listings.ts`, `offers.ts`
5. Actions: `events.ts`, `marketplace.ts`
6. Nav + layouts (modify)
7. Components: all five client components
8. Pages: `events/page.tsx`, `events/[id]/page.tsx`, `admin/events/page.tsx`
9. Environment: `ADMIN_EMAILS` in `.env.local` + Vercel
10. Build verification + deploy
