import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  auth: vi.fn(),
  requireRealUser: vi.fn(),
  requireOrganizer: vi.fn(),
  requireEventOrganizer: vi.fn(),
  canManageEvent: vi.fn(),
  requireAdmin: vi.fn(),
  isAdmin: vi.fn(),
  getEvent: vi.fn(),
  createEvent: vi.fn(),
  setShowStatus: vi.fn(),
  setOrganizer: vi.fn(),
  applyToEvent: vi.fn(),
  cancelRegistration: vi.fn(),
  getRegistration: vi.fn(),
  reviewRegistration: vi.fn(),
  listRegistrations: vi.fn(),
  countApprovedAttendees: vi.fn(),
  deleteListing: vi.fn(),
  deleteOffersForListing: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: h.auth }));
vi.mock("@/lib/admin", () => ({ requireAdmin: h.requireAdmin, isAdmin: h.isAdmin }));
vi.mock("@/lib/guards", () => ({
  requireRealUser: h.requireRealUser,
  requireOrganizer: h.requireOrganizer,
  requireEventOrganizer: h.requireEventOrganizer,
  canManageEvent: h.canManageEvent,
}));
vi.mock("@/lib/db/profiles", () => ({ setOrganizer: h.setOrganizer }));
vi.mock("@/lib/db/events", () => ({
  getEvent: h.getEvent,
  createEvent: h.createEvent,
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  listAllEvents: vi.fn(),
  listPublishedEvents: vi.fn(),
  listPendingShows: vi.fn(),
  listShowsByCreator: vi.fn(),
  setShowStatus: h.setShowStatus,
}));
vi.mock("@/lib/db/event-attendees", () => ({
  applyToEvent: h.applyToEvent,
  cancelRegistration: h.cancelRegistration,
  getRegistration: h.getRegistration,
  reviewRegistration: h.reviewRegistration,
  listRegistrations: h.listRegistrations,
  listApprovedAttendees: vi.fn(),
  countApprovedAttendees: h.countApprovedAttendees,
  getMyRegistrations: vi.fn(),
}));
vi.mock("@/lib/db/event-listings", () => ({ deleteListing: h.deleteListing }));
vi.mock("@/lib/db/offers", () => ({ deleteOffersForListing: h.deleteOffersForListing }));

import {
  applyToEventAction,
  cancelRegistrationAction,
  reviewRegistrationAction,
  listRegistrationsAction,
  createShowAction,
  approveShowAction,
  setOrganizerAction,
} from "./events";

const publishedEvent = {
  id: 1,
  status: "published",
  vendor_capacity: null,
  registration_opens_at: null,
  registration_closes_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRealUser.mockResolvedValue("vendor@gmail.com");
  h.requireOrganizer.mockResolvedValue("organizer@gmail.com");
  h.requireEventOrganizer.mockResolvedValue("owner@gmail.com");
  h.requireAdmin.mockResolvedValue("admin@example.com");
  h.isAdmin.mockReturnValue(false);
  h.canManageEvent.mockResolvedValue(false);
  h.getEvent.mockResolvedValue(publishedEvent);
  h.getRegistration.mockResolvedValue(null);
  h.countApprovedAttendees.mockResolvedValue(0);
  h.applyToEvent.mockResolvedValue({ status: "pending" });
  h.createEvent.mockImplementation((_input, _by, status) => ({ id: 9, status }));
});

describe("applyToEventAction", () => {
  it("rejects guests (requireRealUser gate)", async () => {
    h.requireRealUser.mockRejectedValue(new Error("Sign in with Google"));
    await expect(applyToEventAction(1)).rejects.toThrow(/Sign in/);
    expect(h.applyToEvent).not.toHaveBeenCalled();
  });

  it("rejects a draft show", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, status: "draft" });
    await expect(applyToEventAction(1)).rejects.toThrow(/isn't accepting/);
  });

  it("rejects a cancelled show", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, status: "cancelled" });
    await expect(applyToEventAction(1)).rejects.toThrow(/isn't accepting/);
  });

  it("rejects an ended show", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, status: "ended" });
    await expect(applyToEventAction(1)).rejects.toThrow(/isn't accepting/);
  });

  it("rejects the show's own organizer applying as a vendor", async () => {
    h.canManageEvent.mockResolvedValue(true);
    await expect(applyToEventAction(1)).rejects.toThrow(/organize this show/);
    expect(h.applyToEvent).not.toHaveBeenCalled();
  });

  it("rejects when the registration window has closed", async () => {
    h.getEvent.mockResolvedValue({
      ...publishedEvent,
      registration_closes_at: "2000-01-01T00:00:00Z",
    });
    await expect(applyToEventAction(1)).rejects.toThrow(/closed/);
  });

  it("rejects a new applicant when at vendor capacity", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, vendor_capacity: 2 });
    h.getRegistration.mockResolvedValue(null);
    h.countApprovedAttendees.mockResolvedValue(2);
    await expect(applyToEventAction(1)).rejects.toThrow(/capacity/);
  });

  it("creates a pending registration on the happy path", async () => {
    const reg = await applyToEventAction(1, "bringing vintage");
    expect(reg.status).toBe("pending");
    expect(h.applyToEvent).toHaveBeenCalledWith(1, "vendor@gmail.com", "bringing vintage");
  });
});

describe("cancelRegistrationAction", () => {
  it("tears down offers and listing, then cancels", async () => {
    await cancelRegistrationAction(1);
    expect(h.deleteOffersForListing).toHaveBeenCalledWith(1, "vendor@gmail.com");
    expect(h.deleteListing).toHaveBeenCalledWith(1, "vendor@gmail.com");
    expect(h.cancelRegistration).toHaveBeenCalledWith(1, "vendor@gmail.com");
  });
});

describe("listRegistrationsAction", () => {
  it("excludes the show's own organizer from the applications list", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, created_by: "owner@gmail.com" });
    h.listRegistrations.mockResolvedValue([
      { user_email: "owner@gmail.com", status: "pending" },
      { user_email: "vendor@gmail.com", status: "pending" },
    ]);
    const regs = await listRegistrationsAction(1);
    expect(regs.map((r) => r.user_email)).toEqual(["vendor@gmail.com"]);
  });
});

describe("reviewRegistrationAction", () => {
  it("rejects a non-organizer", async () => {
    h.requireEventOrganizer.mockRejectedValue(new Error("Organizer access required"));
    await expect(
      reviewRegistrationAction(1, "vendor@gmail.com", { status: "approved" })
    ).rejects.toThrow("Organizer access required");
    expect(h.reviewRegistration).not.toHaveBeenCalled();
  });

  it("blocks approving past capacity (suggests waitlist)", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, vendor_capacity: 1 });
    h.getRegistration.mockResolvedValue({ status: "pending" });
    h.countApprovedAttendees.mockResolvedValue(1);
    await expect(
      reviewRegistrationAction(1, "vendor@gmail.com", { status: "approved" })
    ).rejects.toThrow(/capacity/);
  });

  it("approves within capacity and records the review", async () => {
    await reviewRegistrationAction(1, "vendor@gmail.com", {
      status: "approved",
      booth_label: "A3",
    });
    expect(h.reviewRegistration).toHaveBeenCalledWith(
      1,
      "vendor@gmail.com",
      { status: "approved", booth_label: "A3" },
      "owner@gmail.com"
    );
  });

  it("does not capacity-check a rejection", async () => {
    h.getEvent.mockResolvedValue({ ...publishedEvent, vendor_capacity: 1 });
    h.countApprovedAttendees.mockResolvedValue(5);
    await reviewRegistrationAction(1, "vendor@gmail.com", { status: "rejected" });
    expect(h.reviewRegistration).toHaveBeenCalled();
    expect(h.countApprovedAttendees).not.toHaveBeenCalled();
  });
});

describe("createShowAction (Tier 1 show approval)", () => {
  it("organizer-created shows go to pending_approval", async () => {
    h.requireOrganizer.mockResolvedValue("organizer@gmail.com");
    h.isAdmin.mockReturnValue(false);
    const show = await createShowAction({ name: "S", date: "2099-01-01", venue_type: "other" });
    expect(show.status).toBe("pending_approval");
    expect(h.createEvent).toHaveBeenCalledWith(expect.anything(), "organizer@gmail.com", "pending_approval");
  });

  it("admin-created shows auto-publish", async () => {
    h.requireOrganizer.mockResolvedValue("admin@example.com");
    h.isAdmin.mockReturnValue(true);
    const show = await createShowAction({ name: "S", date: "2099-01-01", venue_type: "other" });
    expect(show.status).toBe("published");
    expect(h.createEvent).toHaveBeenCalledWith(expect.anything(), "admin@example.com", "published");
  });

  it("rejects non-organizers", async () => {
    h.requireOrganizer.mockRejectedValue(new Error("Organizer access required"));
    await expect(
      createShowAction({ name: "S", date: "2099-01-01", venue_type: "other" })
    ).rejects.toThrow("Organizer access required");
    expect(h.createEvent).not.toHaveBeenCalled();
  });
});

describe("admin-only show actions", () => {
  it("approveShow requires admin", async () => {
    h.requireAdmin.mockRejectedValue(new Error("Admin access required"));
    await expect(approveShowAction(1)).rejects.toThrow("Admin access required");
    expect(h.setShowStatus).not.toHaveBeenCalled();
  });

  it("approveShow publishes the show", async () => {
    await approveShowAction(1);
    expect(h.setShowStatus).toHaveBeenCalledWith(1, "published");
  });

  it("setOrganizer requires admin and normalizes the email", async () => {
    await setOrganizerAction("  New@Vendor.COM ", true);
    expect(h.setOrganizer).toHaveBeenCalledWith("new@vendor.com", true);
  });
});
