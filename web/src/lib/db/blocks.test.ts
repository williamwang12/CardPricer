import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mockFrom } }));

import { isBlockedBetween, blockUser, listBlocked } from "./blocks";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  for (const m of ["select", "insert", "upsert", "update", "delete", "eq", "in"]) {
    obj[m] = vi.fn().mockReturnThis();
  }
  obj.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  return obj;
}

beforeEach(() => vi.clearAllMocks());

describe("isBlockedBetween", () => {
  it("true when A blocked B", async () => {
    mockFrom.mockReturnValue(
      chainable({ data: [{ blocker_email: "a@x.com", blocked_email: "b@x.com" }], error: null })
    );
    expect(await isBlockedBetween("a@x.com", "b@x.com")).toBe(true);
  });

  it("true when B blocked A (the reverse direction)", async () => {
    mockFrom.mockReturnValue(
      chainable({ data: [{ blocker_email: "b@x.com", blocked_email: "a@x.com" }], error: null })
    );
    expect(await isBlockedBetween("a@x.com", "b@x.com")).toBe(true);
  });

  it("false when no block row exists", async () => {
    mockFrom.mockReturnValue(chainable({ data: [], error: null }));
    expect(await isBlockedBetween("a@x.com", "b@x.com")).toBe(false);
  });

  it("ignores a row that isn't the a↔b pair", async () => {
    // e.g. a self-row or unrelated pairing that slipped through the .in() filter
    mockFrom.mockReturnValue(
      chainable({ data: [{ blocker_email: "a@x.com", blocked_email: "a@x.com" }], error: null })
    );
    expect(await isBlockedBetween("a@x.com", "b@x.com")).toBe(false);
  });

  it("throws on error", async () => {
    mockFrom.mockReturnValue(chainable({ data: null, error: { message: "boom" } }));
    await expect(isBlockedBetween("a@x.com", "b@x.com")).rejects.toEqual({ message: "boom" });
  });
});

describe("blockUser / listBlocked", () => {
  it("upserts a block", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    await blockUser("a@x.com", "b@x.com");
    expect((builder.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      { blocker_email: "a@x.com", blocked_email: "b@x.com" },
      expect.anything()
    );
  });

  it("lists blocked emails", async () => {
    mockFrom.mockReturnValue(
      chainable({ data: [{ blocked_email: "b@x.com" }, { blocked_email: "c@x.com" }], error: null })
    );
    expect(await listBlocked("a@x.com")).toEqual(["b@x.com", "c@x.com"]);
  });
});
