import { describe, it, expect } from "vitest";
import { deriveEventStatus, withDerivedStatus, isVendorVisibleStatus } from "./event-status";
import type { Event } from "./types";

function ev(partial: Partial<Event>): Event {
  return {
    id: 1,
    name: "Test Show",
    date: "2026-07-20",
    date_end: null,
    venue_name: null,
    venue_address: null,
    venue_type: "lgs",
    description: null,
    published: true,
    created_by: "org@example.com",
    created_at: "2026-07-01T00:00:00Z",
    status: "published",
    slug: null,
    cover_image_path: null,
    city: null,
    region: null,
    country: null,
    timezone: null,
    starts_at: null,
    ends_at: null,
    registration_opens_at: null,
    registration_closes_at: null,
    vendor_capacity: null,
    review_note: null,
    ...partial,
  } as Event;
}

describe("deriveEventStatus", () => {
  it("is 'published' before the show date", () => {
    expect(deriveEventStatus(ev({ date: "2026-07-20" }), "2026-07-19")).toBe("published");
  });

  it("is 'live' on the show date (single-day show)", () => {
    expect(deriveEventStatus(ev({ date: "2026-07-20" }), "2026-07-20")).toBe("live");
  });

  it("is 'ended' the day after a single-day show", () => {
    expect(deriveEventStatus(ev({ date: "2026-07-20" }), "2026-07-21")).toBe("ended");
  });

  it("is 'live' across a multi-day window (inclusive of both ends)", () => {
    const e = ev({ date: "2026-07-20", date_end: "2026-07-22" });
    expect(deriveEventStatus(e, "2026-07-20")).toBe("live");
    expect(deriveEventStatus(e, "2026-07-21")).toBe("live");
    expect(deriveEventStatus(e, "2026-07-22")).toBe("live");
  });

  it("is 'published' before, 'ended' after a multi-day window", () => {
    const e = ev({ date: "2026-07-20", date_end: "2026-07-22" });
    expect(deriveEventStatus(e, "2026-07-19")).toBe("published");
    expect(deriveEventStatus(e, "2026-07-23")).toBe("ended");
  });

  it("re-derives a stored 'live' by the clock too", () => {
    expect(deriveEventStatus(ev({ status: "live", date: "2026-07-20" }), "2026-07-25")).toBe("ended");
  });

  it.each(["draft", "pending_approval", "rejected", "cancelled", "ended"] as const)(
    "never overrides the explicit status '%s'",
    (status) => {
      // Even with a date far in the past/future, explicit states pass through.
      expect(deriveEventStatus(ev({ status, date: "2020-01-01" }), "2026-07-20")).toBe(status);
      expect(deriveEventStatus(ev({ status, date: "2099-01-01" }), "2026-07-20")).toBe(status);
    }
  );

  it("falls back to the current status when there is no date", () => {
    // date is required in practice, but guard against empty just in case.
    expect(deriveEventStatus(ev({ date: "" }), "2026-07-20")).toBe("published");
  });
});

describe("withDerivedStatus", () => {
  it("returns a copy with the derived status, leaving other fields intact", () => {
    const e = ev({ date: "2026-07-20", name: "Keep me" });
    const out = withDerivedStatus(e, "2026-07-25");
    expect(out.status).toBe("ended");
    expect(out.name).toBe("Keep me");
    expect(e.status).toBe("published"); // original untouched
  });
});

describe("isVendorVisibleStatus", () => {
  it("shows published and live, hides everything else", () => {
    expect(isVendorVisibleStatus("published")).toBe(true);
    expect(isVendorVisibleStatus("live")).toBe(true);
    for (const s of ["draft", "pending_approval", "ended", "cancelled", "rejected"] as const) {
      expect(isVendorVisibleStatus(s)).toBe(false);
    }
  });
});
