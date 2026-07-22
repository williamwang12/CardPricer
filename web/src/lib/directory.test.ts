import { describe, it, expect } from "vitest";
import { buildVendorDirectory, featuredFirst } from "./directory";
import type { EventAttendee, EventListing, Profile, ListedCard } from "@/lib/types";

function attendee(email: string, extra: Partial<EventAttendee> = {}): EventAttendee {
  return {
    id: 1,
    event_id: 1,
    user_email: email,
    table_number: null,
    created_at: "",
    status: "approved",
    booth_label: null,
    vendor_notes: null,
    organizer_notes: null,
    reviewed_at: null,
    reviewed_by: null,
    ...extra,
  };
}

function listing(email: string, cards: ListedCard[], visibility: EventListing["visibility"] = "show_vendors"): EventListing {
  return { id: 1, event_id: 1, user_email: email, cards, visibility, updated_at: "" };
}

function card(name: string, is_featured = false): ListedCard {
  return { name, number: "1", quantity: 1, market_price: 1, asking_price: 1, is_featured };
}

function profile(email: string, extra: Partial<Profile> = {}): Profile {
  return {
    user_email: email,
    store_name: null,
    avatar_path: null,
    bio: null,
    specialties: [],
    location_city: null,
    location_region: null,
    links: {},
    is_vendor: true,
    is_organizer: false,
    profile_visibility: "everyone",
    notify_new_message: true,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

const urlOf = (p: string | null) => (p ? `https://cdn/${p}` : null);

describe("featuredFirst", () => {
  it("moves featured cards ahead of the rest", () => {
    const out = featuredFirst([card("A"), card("B", true), card("C")]);
    expect(out.map((c) => c.name)).toEqual(["B", "A", "C"]);
  });
  it("does not mutate the input", () => {
    const input = [card("A"), card("B", true)];
    featuredFirst(input);
    expect(input.map((c) => c.name)).toEqual(["A", "B"]);
  });
});

describe("buildVendorDirectory", () => {
  const me = "me@x.com";

  it("excludes the viewer from their own directory", () => {
    const dir = buildVendorDirectory(
      me,
      [attendee(me), attendee("a@x.com")],
      [],
      [],
      urlOf
    );
    expect(dir.map((d) => d.email)).toEqual(["a@x.com"]);
  });

  it("joins profile fields and resolves the avatar url", () => {
    const dir = buildVendorDirectory(
      me,
      [attendee("a@x.com", { booth_label: "B2" })],
      [profile("a@x.com", { store_name: "Ace Cards", avatar_path: "a/av.png", specialties: ["vintage"] })],
      [],
      urlOf
    );
    expect(dir[0]).toMatchObject({
      email: "a@x.com",
      storeName: "Ace Cards",
      avatarUrl: "https://cdn/a/av.png",
      specialties: ["vintage"],
      boothLabel: "B2",
      cards: [],
    });
  });

  it("falls back gracefully when a vendor has no profile", () => {
    const dir = buildVendorDirectory(me, [attendee("a@x.com")], [], [], urlOf);
    expect(dir[0]).toMatchObject({
      storeName: null,
      avatarUrl: null,
      specialties: [],
    });
  });

  it("hides a vendor's cards when their listing is hidden", () => {
    const dir = buildVendorDirectory(
      me,
      [attendee("a@x.com")],
      [],
      [listing("a@x.com", [card("Charizard")], "hidden")],
      urlOf
    );
    expect(dir[0].cards).toEqual([]);
  });

  it("shows visible cards featured-first", () => {
    const dir = buildVendorDirectory(
      me,
      [attendee("a@x.com")],
      [],
      [listing("a@x.com", [card("A"), card("B", true)])],
      urlOf
    );
    expect(dir[0].cards.map((c) => c.name)).toEqual(["B", "A"]);
  });

  it("never leaks the viewer's own listing into the directory", () => {
    // Even if my listing is in the set, I'm filtered out as an attendee AND
    // my listing is filtered from the visible map.
    const dir = buildVendorDirectory(
      me,
      [attendee("a@x.com")],
      [],
      [listing(me, [card("Mine")]), listing("a@x.com", [card("Theirs")])],
      urlOf
    );
    const allCardNames = dir.flatMap((d) => d.cards.map((c) => c.name));
    expect(allCardNames).toEqual(["Theirs"]);
  });

  it("gives a vendor with no listing an empty showcase", () => {
    const dir = buildVendorDirectory(me, [attendee("a@x.com")], [], [], urlOf);
    expect(dir[0].cards).toEqual([]);
  });
});
