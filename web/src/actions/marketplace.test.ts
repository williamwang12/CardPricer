import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  requireApprovedAttendee: vi.fn(),
  listEventListings: vi.fn(),
  saveListing: vi.fn(),
  createOffer: vi.fn(),
  getOffer: vi.fn(),
  updateOfferStatus: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/guards", () => ({ requireApprovedAttendee: h.requireApprovedAttendee }));
vi.mock("@/lib/db/event-listings", () => ({
  saveListing: h.saveListing,
  getMyListing: vi.fn(),
  deleteListing: vi.fn(),
  listEventListings: h.listEventListings,
}));
vi.mock("@/lib/db/offers", () => ({
  createOffer: h.createOffer,
  updateOfferStatus: h.updateOfferStatus,
  getOffer: h.getOffer,
  listOffersForEvent: vi.fn(),
}));

import {
  browseListingsAction,
  makeOfferAction,
  saveListingAction,
  acceptOfferAction,
  declineOfferAction,
  withdrawOfferAction,
} from "./marketplace";

/** Sets who getUserEmail() resolves to (marketplace.ts reads auth() directly). */
function signedInAs(email: string) {
  h.auth.mockResolvedValue({ user: { email } });
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireApprovedAttendee.mockResolvedValue("me@gmail.com");
  h.saveListing.mockResolvedValue({ id: 1, visibility: "hidden", cards: [] });
  signedInAs("seller@gmail.com");
});

const pendingOffer = {
  id: 7,
  event_id: 1,
  seller_email: "seller@gmail.com",
  buyer_email: "buyer@gmail.com",
  status: "pending",
};

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

describe("saveListingAction", () => {
  it("requires an approved attendee", async () => {
    h.requireApprovedAttendee.mockRejectedValue(new Error("approved vendor"));
    await expect(saveListingAction(1, [])).rejects.toThrow(/approved vendor/);
    expect(h.saveListing).not.toHaveBeenCalled();
  });

  it("defaults visibility to show_vendors", async () => {
    await saveListingAction(1, []);
    expect(h.saveListing).toHaveBeenCalledWith(1, "me@gmail.com", [], "show_vendors");
  });

  it("forwards an explicit visibility", async () => {
    await saveListingAction(1, [], "hidden");
    expect(h.saveListing).toHaveBeenCalledWith(1, "me@gmail.com", [], "hidden");
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

describe("acceptOfferAction (seller-only, pending-only)", () => {
  it("lets the seller accept a pending offer", async () => {
    signedInAs("seller@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await acceptOfferAction(7);
    expect(h.updateOfferStatus).toHaveBeenCalledWith(7, "accepted");
  });

  it("rejects a non-seller (e.g. the buyer) trying to accept", async () => {
    signedInAs("buyer@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await expect(acceptOfferAction(7)).rejects.toThrow(/Not your offer/);
    expect(h.updateOfferStatus).not.toHaveBeenCalled();
  });

  it("rejects accepting an already-resolved offer", async () => {
    signedInAs("seller@gmail.com");
    h.getOffer.mockResolvedValue({ ...pendingOffer, status: "accepted" });
    await expect(acceptOfferAction(7)).rejects.toThrow(/no longer pending/);
  });

  it("rejects a missing offer", async () => {
    signedInAs("seller@gmail.com");
    h.getOffer.mockResolvedValue(null);
    await expect(acceptOfferAction(7)).rejects.toThrow(/not found/i);
  });
});

describe("declineOfferAction (seller-only)", () => {
  it("lets the seller decline", async () => {
    signedInAs("seller@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await declineOfferAction(7);
    expect(h.updateOfferStatus).toHaveBeenCalledWith(7, "declined");
  });

  it("rejects a non-seller", async () => {
    signedInAs("buyer@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await expect(declineOfferAction(7)).rejects.toThrow(/Not your offer/);
  });
});

describe("withdrawOfferAction (buyer-only, pending-only)", () => {
  it("lets the buyer withdraw a pending offer", async () => {
    signedInAs("buyer@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await withdrawOfferAction(7);
    expect(h.updateOfferStatus).toHaveBeenCalledWith(7, "withdrawn");
  });

  it("rejects the seller trying to withdraw the buyer's offer", async () => {
    signedInAs("seller@gmail.com");
    h.getOffer.mockResolvedValue(pendingOffer);
    await expect(withdrawOfferAction(7)).rejects.toThrow(/Not your offer/);
    expect(h.updateOfferStatus).not.toHaveBeenCalled();
  });

  it("rejects withdrawing a non-pending offer", async () => {
    signedInAs("buyer@gmail.com");
    h.getOffer.mockResolvedValue({ ...pendingOffer, status: "declined" });
    await expect(withdrawOfferAction(7)).rejects.toThrow(/no longer pending/);
  });
});
