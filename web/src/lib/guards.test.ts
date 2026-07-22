import { describe, it, expect, vi, beforeEach } from "vitest";

// admin.ts reads ADMIN_EMAILS from env (setup.ts → admin@example.com,boss@example.com).
const {
  authMock,
  getProfileMock,
  sharesMock,
  isApprovedMock,
  getEventMock,
  isParticipantMock,
  isBlockedMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getProfileMock: vi.fn(),
  sharesMock: vi.fn(),
  isApprovedMock: vi.fn(),
  getEventMock: vi.fn(),
  isParticipantMock: vi.fn(),
  isBlockedMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/profiles", () => ({
  getProfile: getProfileMock,
  sharesApprovedShow: sharesMock,
}));
vi.mock("@/lib/db/event-attendees", () => ({ isApprovedAttendee: isApprovedMock }));
vi.mock("@/lib/db/events", () => ({ getEvent: getEventMock }));
vi.mock("@/lib/db/messaging", () => ({ isParticipant: isParticipantMock }));
vi.mock("@/lib/db/blocks", () => ({ isBlockedBetween: isBlockedMock }));

import {
  isGuestEmail,
  getUserEmail,
  requireRealUser,
  requireOrganizer,
  canManageEvent,
  requireEventOrganizer,
  requireApprovedAttendee,
  canMessage,
  requireCanMessage,
  requireConversationParticipant,
} from "./guards";

/** Sets what `auth()` resolves to for the next call(s). */
function signedInAs(email: string | null) {
  authMock.mockResolvedValue(email ? { user: { email } } : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  getProfileMock.mockResolvedValue(null);
  sharesMock.mockResolvedValue(false);
  isApprovedMock.mockResolvedValue(false);
  getEventMock.mockResolvedValue(null);
  isParticipantMock.mockResolvedValue(false);
  isBlockedMock.mockResolvedValue(false);
});

describe("isGuestEmail", () => {
  it("flags guest emails", () => {
    expect(isGuestEmail("guest-abc@cardparser.guest")).toBe(true);
    expect(isGuestEmail("GUEST-ABC@CARDPARSER.GUEST")).toBe(true);
  });
  it("passes real emails and empties", () => {
    expect(isGuestEmail("real@gmail.com")).toBe(false);
    expect(isGuestEmail(null)).toBe(false);
    expect(isGuestEmail(undefined)).toBe(false);
  });
});

describe("getUserEmail", () => {
  it("returns the session email", async () => {
    signedInAs("real@gmail.com");
    expect(await getUserEmail()).toBe("real@gmail.com");
  });
  it("throws when unauthenticated", async () => {
    signedInAs(null);
    await expect(getUserEmail()).rejects.toThrow("Not authenticated");
  });
});

describe("requireRealUser", () => {
  it("allows a real signed-in user", async () => {
    signedInAs("real@gmail.com");
    expect(await requireRealUser()).toBe("real@gmail.com");
  });
  it("rejects guests (browse-only)", async () => {
    signedInAs("guest-1@cardparser.guest");
    await expect(requireRealUser()).rejects.toThrow(/Sign in/);
  });
  it("rejects the unauthenticated", async () => {
    signedInAs(null);
    await expect(requireRealUser()).rejects.toThrow("Not authenticated");
  });
});

describe("requireOrganizer", () => {
  it("allows an ADMIN_EMAILS admin", async () => {
    signedInAs("admin@example.com");
    expect(await requireOrganizer()).toBe("admin@example.com");
    expect(getProfileMock).not.toHaveBeenCalled(); // short-circuits on admin
  });
  it("allows a granted organizer", async () => {
    signedInAs("vendor@gmail.com");
    getProfileMock.mockResolvedValue({ is_organizer: true });
    expect(await requireOrganizer()).toBe("vendor@gmail.com");
  });
  it("rejects a plain vendor", async () => {
    signedInAs("vendor@gmail.com");
    getProfileMock.mockResolvedValue({ is_organizer: false });
    await expect(requireOrganizer()).rejects.toThrow("Organizer access required");
  });
  it("rejects guests", async () => {
    signedInAs("guest-1@cardparser.guest");
    await expect(requireOrganizer()).rejects.toThrow(/Sign in/);
  });
});

describe("canManageEvent", () => {
  it("admins can manage any event", async () => {
    expect(await canManageEvent(7, "admin@example.com")).toBe(true);
    expect(getEventMock).not.toHaveBeenCalled();
  });
  it("the event creator can manage it", async () => {
    getEventMock.mockResolvedValue({ created_by: "owner@gmail.com" });
    expect(await canManageEvent(7, "owner@gmail.com")).toBe(true);
  });
  it("a non-owner cannot", async () => {
    getEventMock.mockResolvedValue({ created_by: "owner@gmail.com" });
    expect(await canManageEvent(7, "other@gmail.com")).toBe(false);
  });
  it("returns false for a missing event", async () => {
    getEventMock.mockResolvedValue(null);
    expect(await canManageEvent(7, "someone@gmail.com")).toBe(false);
  });
});

describe("requireEventOrganizer", () => {
  it("allows the event's creator", async () => {
    signedInAs("owner@gmail.com");
    getEventMock.mockResolvedValue({ created_by: "owner@gmail.com" });
    expect(await requireEventOrganizer(7)).toBe("owner@gmail.com");
  });
  it("rejects a vendor who doesn't own the event", async () => {
    signedInAs("vendor@gmail.com");
    getEventMock.mockResolvedValue({ created_by: "owner@gmail.com" });
    await expect(requireEventOrganizer(7)).rejects.toThrow("Organizer access required");
  });
});

describe("requireApprovedAttendee", () => {
  it("allows an approved vendor", async () => {
    signedInAs("vendor@gmail.com");
    isApprovedMock.mockResolvedValue(true);
    expect(await requireApprovedAttendee(7)).toBe("vendor@gmail.com");
  });
  it("rejects a pending/unapproved vendor", async () => {
    signedInAs("vendor@gmail.com");
    isApprovedMock.mockResolvedValue(false);
    await expect(requireApprovedAttendee(7)).rejects.toThrow(/approved vendor/);
  });
  it("rejects guests before any DB check", async () => {
    signedInAs("guest-1@cardparser.guest");
    await expect(requireApprovedAttendee(7)).rejects.toThrow(/Sign in/);
    expect(isApprovedMock).not.toHaveBeenCalled();
  });
});

describe("canMessage", () => {
  it("allows two real vendors who share an approved show and aren't blocked", async () => {
    isBlockedMock.mockResolvedValue(false);
    sharesMock.mockResolvedValue(true);
    expect(await canMessage("a@x.com", "b@x.com")).toBe(true);
  });

  it("denies messaging yourself", async () => {
    expect(await canMessage("a@x.com", "a@x.com")).toBe(false);
    expect(sharesMock).not.toHaveBeenCalled();
  });

  it("denies when either side is a guest", async () => {
    expect(await canMessage("a@x.com", "guest-1@cardparser.guest")).toBe(false);
    expect(await canMessage("guest-1@cardparser.guest", "b@x.com")).toBe(false);
  });

  it("denies when a block exists in either direction (before checking shows)", async () => {
    isBlockedMock.mockResolvedValue(true);
    sharesMock.mockResolvedValue(true);
    expect(await canMessage("a@x.com", "b@x.com")).toBe(false);
    expect(sharesMock).not.toHaveBeenCalled();
  });

  it("denies when they share no approved show", async () => {
    isBlockedMock.mockResolvedValue(false);
    sharesMock.mockResolvedValue(false);
    expect(await canMessage("a@x.com", "b@x.com")).toBe(false);
  });
});

describe("requireCanMessage", () => {
  it("returns the caller when allowed", async () => {
    signedInAs("a@x.com");
    sharesMock.mockResolvedValue(true);
    expect(await requireCanMessage("b@x.com")).toBe("a@x.com");
  });

  it("throws when a block prevents it", async () => {
    signedInAs("a@x.com");
    isBlockedMock.mockResolvedValue(true);
    await expect(requireCanMessage("b@x.com")).rejects.toThrow(/share a show/);
  });

  it("throws for a guest caller", async () => {
    signedInAs("guest-1@cardparser.guest");
    await expect(requireCanMessage("b@x.com")).rejects.toThrow(/Sign in/);
  });
});

describe("requireConversationParticipant", () => {
  it("allows a participant", async () => {
    signedInAs("a@x.com");
    isParticipantMock.mockResolvedValue(true);
    expect(await requireConversationParticipant(5)).toBe("a@x.com");
  });

  it("rejects a non-participant (thread privacy)", async () => {
    signedInAs("stranger@x.com");
    isParticipantMock.mockResolvedValue(false);
    await expect(requireConversationParticipant(5)).rejects.toThrow(/not a participant/);
  });

  it("rejects a guest before the DB check", async () => {
    signedInAs("guest-1@cardparser.guest");
    await expect(requireConversationParticipant(5)).rejects.toThrow(/Sign in/);
    expect(isParticipantMock).not.toHaveBeenCalled();
  });
});
