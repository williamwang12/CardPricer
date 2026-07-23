// Seed the Vendor Network (events/marketplace) with a realistic, testable
// scenario. Idempotent: re-running wipes prior seed data (anything tagged
// "Demo:" or using an @cardparser.demo email) and recreates it fresh.
//
// Slice 5 deliverable from docs/vendor-network-design.md:
//   1 organizer + published show + approved vendors with showcases,
//   plus a review queue, offers, a message thread, and shows that exercise
//   the live/ended date-derived lifecycle.
//
// Run:  cd web && node scripts/seed-vendor-network.mjs
// Uses web/.env.local (points at production Supabase — this writes real rows).
//
// The ADMIN account is your own login; the @cardparser.demo vendors can't log
// in (no OAuth) but populate the directory/marketplace so you can test every
// role interaction from your single admin session.

import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ADMIN = "hungergamesareawesome@gmail.com";

const envRaw = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const env = (k) => {
  const m = envRaw.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const sb = createClient(env("SUPABASE_URL"), env("SUPABASE_KEY"));

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

// ── Vendors ──────────────────────────────────────────────────────────────
const VENDORS = [
  { email: "ash@cardparser.demo", store: "Pallet Town Cards", specialties: ["vintage", "graded"], city: "Pallet Town", region: "Kanto", organizer: false,
    cards: [
      { name: "Charizard", number: "4/102", quantity: 1, market_price: 420.0, asking_price: 399.0, is_featured: true },
      { name: "Blastoise", number: "2/102", quantity: 1, market_price: 180.0, asking_price: 175.0 },
      { name: "Pikachu", number: "58/102", quantity: 4, market_price: 12.5, asking_price: 10.0 },
    ] },
  { email: "misty@cardparser.demo", store: "Cerulean Collectibles", specialties: ["japanese", "sealed"], city: "Cerulean City", region: "Kanto", organizer: false,
    cards: [
      { name: "Gyarados", number: "6/102", quantity: 2, market_price: 60.0, asking_price: 55.0, is_featured: true },
      { name: "Starmie", number: "64/102", quantity: 3, market_price: 8.0, asking_price: 7.0 },
    ] },
  { email: "brock@cardparser.demo", store: "Pewter Pulls", specialties: ["modern", "slabs"], city: "Pewter City", region: "Kanto", organizer: true,
    cards: [
      { name: "Onix", number: "56/102", quantity: 5, market_price: 4.0, asking_price: 3.0 },
      { name: "Moltres", number: "12/62", quantity: 1, market_price: 45.0, asking_price: 40.0, is_featured: true },
    ] },
  { email: "gary@cardparser.demo", store: "Oak Rare Finds", specialties: ["vintage"], city: "Pallet Town", region: "Kanto", organizer: false, cards: [] }, // pending applicant
  { email: "jessie@cardparser.demo", store: "Team Rocket Trades", specialties: ["promos"], city: "Unknown", region: "Kanto", organizer: false, cards: [] }, // waitlisted
];

const cardKey = (name, number) => `${name.toLowerCase()}|${number}`;

async function run() {
  const demoEmails = VENDORS.map((v) => v.email);

  // ── 1. Clean prior seed data ────────────────────────────────────────────
  console.log("Cleaning prior seed data…");
  // Seed events (tagged "Demo:") — cascade removes their attendees/listings/offers.
  const { data: oldEvents } = await sb.from("events").select("id").like("name", "Demo:%");
  const oldIds = (oldEvents ?? []).map((e) => e.id);
  if (oldIds.length) {
    await sb.from("card_offers").delete().in("event_id", oldIds);
    await sb.from("event_listings").delete().in("event_id", oldIds);
    await sb.from("event_attendees").delete().in("event_id", oldIds);
    await sb.from("events").delete().in("id", oldIds);
  }
  // Messaging tied to demo vendors.
  const { data: demoConvos } = await sb
    .from("conversation_participants")
    .select("conversation_id")
    .in("user_email", demoEmails);
  const convoIds = [...new Set((demoConvos ?? []).map((c) => c.conversation_id))];
  if (convoIds.length) {
    await sb.from("messages").delete().in("conversation_id", convoIds);
    await sb.from("conversation_participants").delete().in("conversation_id", convoIds);
    await sb.from("conversations").delete().in("id", convoIds);
  }
  await sb.from("profiles").delete().in("user_email", demoEmails);

  // ── 2. Profiles ─────────────────────────────────────────────────────────
  console.log("Upserting profiles…");
  await sb.from("profiles").upsert(
    { user_email: ADMIN, store_name: "CardParser HQ", is_vendor: true, is_organizer: true, bio: "Admin + organizer test account.", specialties: ["graded", "vintage"], profile_visibility: "everyone" },
    { onConflict: "user_email" }
  );
  for (const v of VENDORS) {
    await sb.from("profiles").upsert(
      { user_email: v.email, store_name: v.store, is_vendor: true, is_organizer: v.organizer, bio: `${v.store}: demo vendor.`, specialties: v.specialties, location_city: v.city, location_region: v.region, profile_visibility: "everyone" },
      { onConflict: "user_email" }
    );
  }

  // ── 3. Events (lifecycle demo + the main populated show) ────────────────
  console.log("Creating shows…");
  const mk = (name, date, opts = {}) => ({
    name, date, date_end: opts.date_end ?? null,
    venue_name: opts.venue_name ?? "Community Center Hall A",
    venue_address: opts.venue_address ?? "100 Main St",
    venue_type: opts.venue_type ?? "collector_show",
    description: opts.description ?? "Demo show seeded for testing the vendor network.",
    status: opts.status ?? "published",
    published: (opts.status ?? "published") === "published" || (opts.status ?? "published") === "live",
    created_by: opts.created_by ?? ADMIN,
    vendor_capacity: opts.vendor_capacity ?? null,
    review_note: null,
  });

  const rows = [
    mk("Demo: Metro Pokémon Card Show", addDays(5), { vendor_capacity: 8, venue_name: "Metro Convention Center", venue_type: "collector_show", description: "The main demo show: approved vendors, showcases, offers, and a review queue." }),
    mk("Demo: Downtown Live Expo", iso(new Date()), { venue_name: "Downtown Expo Hall", venue_type: "convention", description: "Dated today, so it derives status 'live' (Live now badge)." }),
    mk("Demo: Last Month's Meetup", addDays(-20), { venue_name: "Old Town LGS", venue_type: "mall_show", description: "Past-dated, derives 'ended' and is hidden from the browse list." }),
    mk("Demo: Community Center Swap", addDays(12), { status: "pending_approval", created_by: "brock@cardparser.demo", venue_type: "other", description: "Submitted by organizer Brock; awaiting admin approval (review queue)." }),
  ];
  const { data: events, error: evErr } = await sb.from("events").insert(rows).select();
  if (evErr) throw evErr;
  const mainShow = events.find((e) => e.name.includes("Metro"));
  console.log(`  ${events.length} shows created; main show id=${mainShow.id}`);

  // ── 4. Attendees for the main show ──────────────────────────────────────
  // You (ADMIN) are the show's ORGANIZER — you manage it, you're not a vendor
  // in it (an organizer can't be a vendor at a show they run). All vendors are
  // demo accounts so you have a full review queue + roster to manage.
  console.log("Registering vendors at the main show…");
  const now = new Date().toISOString();
  const attendees = [
    { event_id: mainShow.id, user_email: "ash@cardparser.demo", status: "approved", booth_label: "B2", reviewed_at: now, reviewed_by: ADMIN },
    { event_id: mainShow.id, user_email: "misty@cardparser.demo", status: "approved", booth_label: "B3", reviewed_at: now, reviewed_by: ADMIN },
    { event_id: mainShow.id, user_email: "brock@cardparser.demo", status: "approved", booth_label: "B4", reviewed_at: now, reviewed_by: ADMIN },
    { event_id: mainShow.id, user_email: "gary@cardparser.demo", status: "pending", vendor_notes: "Vintage specialist, would love a table." },
    { event_id: mainShow.id, user_email: "jessie@cardparser.demo", status: "waitlisted", reviewed_at: now, reviewed_by: ADMIN },
  ];
  const { error: atErr } = await sb.from("event_attendees").upsert(attendees, { onConflict: "event_id,user_email" });
  if (atErr) throw atErr;

  // ── 5. Showcase listings (the approved demo vendors) ────────────────────
  console.log("Publishing showcases…");
  const listings = VENDORS.filter((v) => v.cards.length).map((v) => ({
    event_id: mainShow.id, user_email: v.email, cards_json: JSON.stringify(v.cards), visibility: "show_vendors", updated_at: now,
  }));
  const { error: liErr } = await sb.from("event_listings").upsert(listings, { onConflict: "event_id,user_email" });
  if (liErr) throw liErr;

  // ── 6. Offers between the demo vendors (pending + accepted) ──────────────
  // These live in the vendor-side marketplace, which a non-admin vendor login
  // sees. Kept realistic so a 2nd-account vendor test has ambient activity.
  console.log("Creating offers…");
  const offers = [
    { event_id: mainShow.id, seller_email: "ash@cardparser.demo", buyer_email: "misty@cardparser.demo", card_name: "Charizard", card_number: "4/102", card_key: cardKey("Charizard", "4/102"), quantity: 1, offer_amount: 385.0, message: "Would you take 385 cash?", status: "pending", created_at: now },
    { event_id: mainShow.id, seller_email: "brock@cardparser.demo", buyer_email: "ash@cardparser.demo", card_name: "Moltres", card_number: "12/62", card_key: cardKey("Moltres", "12/62"), quantity: 1, offer_amount: 38.0, message: "Trade toward your Blastoise?", status: "pending", created_at: now },
    { event_id: mainShow.id, seller_email: "misty@cardparser.demo", buyer_email: "brock@cardparser.demo", card_name: "Gyarados", card_number: "6/102", card_key: cardKey("Gyarados", "6/102"), quantity: 1, offer_amount: 52.0, message: "Deal?", status: "accepted", created_at: now, responded_at: now },
  ];
  const { error: ofErr } = await sb.from("card_offers").insert(offers);
  if (ofErr) throw ofErr;

  // ── 7. A message thread between two approved demo vendors ────────────────
  console.log("Seeding a message thread…");
  const { data: convo, error: cvErr } = await sb
    .from("conversations")
    .insert({ event_id: mainShow.id, listing_owner_email: "ash@cardparser.demo" })
    .select()
    .single();
  if (cvErr) throw cvErr;
  await sb.from("conversation_participants").insert([
    { conversation_id: convo.id, user_email: "misty@cardparser.demo", last_read_at: null },
    { conversation_id: convo.id, user_email: "ash@cardparser.demo", last_read_at: now },
  ]);
  await sb.from("messages").insert([
    { conversation_id: convo.id, sender_email: "misty@cardparser.demo", body: "Hey! Saw your Blastoise listing, still available at the show?" },
    { conversation_id: convo.id, sender_email: "ash@cardparser.demo", body: "Yep, come by booth B2." },
  ]);

  console.log("\n✅ Seed complete.");
  console.log(`   Main show: "${mainShow.name}" (id ${mainShow.id}), organized by YOU (${ADMIN}).`);
  console.log("   As organizer you manage it: 3 approved vendors + 1 pending + 1 waitlisted to review.");
  console.log("   Vendor-side data (showcases/offers/messages) is on the demo accounts — log in as a");
  console.log("   non-admin Google account and get approved to experience the vendor marketplace.");
  console.log("   'Demo: Community Center Swap' (by organizer Brock) awaits your admin approval.");
}

run().catch((e) => {
  console.error("Seed failed:", e.message || e);
  process.exit(1);
});
