import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import { applyToEvent, isApprovedAttendee } from "./event-attendees";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "neq", "order", "range", "limit", "single", "maybeSingle", "in",
  ];
  for (const m of methods) obj[m] = vi.fn().mockReturnThis();
  obj.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  return obj;
}

beforeEach(() => vi.clearAllMocks());

describe("isApprovedAttendee", () => {
  it("true only when status is approved", async () => {
    mockFrom.mockReturnValue(chainable({ data: { status: "approved" }, error: null }));
    expect(await isApprovedAttendee(1, "a@x.com")).toBe(true);
  });

  it("false for pending", async () => {
    mockFrom.mockReturnValue(chainable({ data: { status: "pending" }, error: null }));
    expect(await isApprovedAttendee(1, "a@x.com")).toBe(false);
  });

  it("false when no registration", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: null }));
    expect(await isApprovedAttendee(1, "a@x.com")).toBe(false);
  });
});

describe("applyToEvent", () => {
  it("is idempotent when already approved (no write)", async () => {
    // getRegistration returns an approved row → return as-is, no upsert.
    mockFrom.mockReturnValue(
      chainable({ data: { user_email: "a@x.com", status: "approved" }, error: null })
    );
    const result = await applyToEvent(1, "a@x.com");
    expect(result.status).toBe("approved");
    expect(mockFrom).toHaveBeenCalledTimes(1); // read only
  });

  it("creates a pending registration when none exists", async () => {
    const readBuilder = chainable({ data: null, error: null });
    const upsertBuilder = chainable({
      data: { user_email: "a@x.com", status: "pending" },
      error: null,
    });
    let call = 0;
    mockFrom.mockImplementation(() => (call++ === 0 ? readBuilder : upsertBuilder));
    const result = await applyToEvent(1, "a@x.com", "bringing vintage");
    expect(result.status).toBe("pending");
    expect(mockFrom).toHaveBeenCalledTimes(2); // read + upsert
  });

  it("reactivates a rejected registration back to pending", async () => {
    const readBuilder = chainable({
      data: { user_email: "a@x.com", status: "rejected" },
      error: null,
    });
    const upsertBuilder = chainable({
      data: { user_email: "a@x.com", status: "pending" },
      error: null,
    });
    let call = 0;
    mockFrom.mockImplementation(() => (call++ === 0 ? readBuilder : upsertBuilder));
    const result = await applyToEvent(1, "a@x.com");
    expect(result.status).toBe("pending");
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
