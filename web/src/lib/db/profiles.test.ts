import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import {
  getProfile,
  ensureProfile,
  sharesApprovedShow,
} from "./profiles";

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

describe("getProfile", () => {
  it("returns the row when present", async () => {
    const row = { user_email: "a@x.com", store_name: "A Cards" };
    mockFrom.mockReturnValue(chainable({ data: row, error: null }));
    expect(await getProfile("a@x.com")).toEqual(row);
    expect(mockFrom).toHaveBeenCalledWith("profiles");
  });

  it("returns null when absent", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: null }));
    expect(await getProfile("nobody@x.com")).toBeNull();
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));
    await expect(getProfile("a@x.com")).rejects.toEqual({ message: "boom" });
  });
});

describe("ensureProfile", () => {
  it("returns existing profile without inserting", async () => {
    const row = { user_email: "a@x.com" };
    mockFrom.mockReturnValue(chainable({ data: row, error: null }));
    await ensureProfile("a@x.com");
    // Only the read happened (getProfile), no second insert call.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("creates a default row when none exists", async () => {
    const readBuilder = chainable({ data: null, error: null });
    const insertBuilder = chainable({ data: { user_email: "new@x.com" }, error: null });
    let call = 0;
    mockFrom.mockImplementation(() => (call++ === 0 ? readBuilder : insertBuilder));
    const result = await ensureProfile("new@x.com");
    expect(result).toEqual({ user_email: "new@x.com" });
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});

describe("sharesApprovedShow", () => {
  it("is true for the same user without querying", async () => {
    expect(await sharesApprovedShow("a@x.com", "a@x.com")).toBe(true);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("is true when both are approved at the same event", async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: [
          { event_id: 5, user_email: "a@x.com" },
          { event_id: 5, user_email: "b@x.com" },
          { event_id: 9, user_email: "a@x.com" },
        ],
        error: null,
      })
    );
    expect(await sharesApprovedShow("a@x.com", "b@x.com")).toBe(true);
  });

  it("is false when they share no approved event", async () => {
    mockFrom.mockReturnValue(
      chainable({
        data: [
          { event_id: 1, user_email: "a@x.com" },
          { event_id: 2, user_email: "b@x.com" },
        ],
        error: null,
      })
    );
    expect(await sharesApprovedShow("a@x.com", "b@x.com")).toBe(false);
  });
});
