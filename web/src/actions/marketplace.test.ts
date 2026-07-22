import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  requireApprovedAttendee: vi.fn(),
  listEventListings: vi.fn(),
  createOffer: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/guards", () => ({ requireApprovedAttendee: h.requireApprovedAttendee }));
vi.mock("@/lib/db/event-listings", () => ({
  saveListing: vi.fn(),
  getMyListing: vi.fn(),
  deleteListing: vi.fn(),
  listEventListings: h.listEventListings,
}));
vi.mock("@/lib/db/offers", () => ({
  createOffer: h.createOffer,
  updateOfferStatus: vi.fn(),
  getOffer: vi.fn(),
  listOffersForEvent: vi.fn(),
}));

import { browseListingsAction, makeOfferAction } from "./marketplace";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireApprovedAttendee.mockResolvedValue("me@gmail.com");
});

describe("browseListingsAction (approved-only gate)", () => {
  it("rejects an unapproved vendor", async () => {
    h.requireApprovedAttendee.mockRejectedValue(
      new Error("You must be an approved vendor for this show")
    );
    await expect(browseListingsAction(1)).rejects.toThrow(/approved vendor/);
    expect(h.listEventListings).not.toHaveBeenCalled();
  });

  it("returns other vendors' listings, excluding my own", async () => {
    h.listEventListings.mockResolvedValue([
      { user_email: "me@gmail.com", cards: [] },
      { user_email: "other@gmail.com", cards: [] },
    ]);
    const result = await browseListingsAction(1);
    expect(result).toHaveLength(1);
    expect(result[0].user_email).toBe("other@gmail.com");
  });
});

describe("makeOfferAction", () => {
  it("blocks offering on your own listing", async () => {
    await expect(
      makeOfferAction(1, "me@gmail.com", "Pikachu", "25", 1, 10)
    ).rejects.toThrow(/your own listing/);
    expect(h.createOffer).not.toHaveBeenCalled();
  });

  it("rejects non-positive quantity or amount", async () => {
    await expect(
      makeOfferAction(1, "seller@gmail.com", "Pikachu", "25", 0, 10)
    ).rejects.toThrow(/Quantity/);
    await expect(
      makeOfferAction(1, "seller@gmail.com", "Pikachu", "25", 1, 0)
    ).rejects.toThrow(/amount/);
  });
});
