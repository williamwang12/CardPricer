import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

import {
  createShow,
  listShows,
  getShow,
  deleteShow,
  markShowFinalized,
} from "./shows";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "update", "delete", "eq", "order", "single",
  ];
  for (const m of methods) {
    obj[m] = vi.fn().mockReturnThis();
  }
  obj.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  return obj;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createShow", () => {
  it("inserts and returns the created show", async () => {
    const show = {
      id: 1,
      user_email: "user@test.com",
      name: "Local Show",
      date: "2024-03-15",
      date_end: null,
      venue_type: "collector_show" as const,
      table_fee: 50,
      notes: null,
      created_at: "2024-03-01",
      finalized_at: null,
    };
    const builder = chainable({ data: show, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await createShow(
      {
        name: "Local Show",
        date: "2024-03-15",
        venue_type: "collector_show",
        table_fee: 50,
      },
      "user@test.com"
    );
    expect(result).toEqual(show);
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Insert failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(
      createShow(
        { name: "Show", date: "2024-03-15", venue_type: "collector_show" },
        "user@test.com"
      )
    ).rejects.toEqual({ message: "Insert failed" });
  });
});

describe("listShows", () => {
  it("returns shows ordered by date desc", async () => {
    const shows = [
      { id: 2, name: "Show B", date: "2024-04-01" },
      { id: 1, name: "Show A", date: "2024-03-01" },
    ];
    const builder = chainable({ data: shows, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await listShows("user@test.com");
    expect(result).toEqual(shows);
  });

  it("returns empty array when no shows", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await listShows("user@test.com");
    expect(result).toEqual([]);
  });
});

describe("getShow", () => {
  it("returns show filtered by id and user_email", async () => {
    const show = { id: 1, name: "Show", user_email: "user@test.com" };
    const builder = chainable({ data: show, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await getShow(1, "user@test.com");
    expect(result).toEqual(show);
  });

  it("returns null on error (e.g. not found)", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Not found" },
    });
    mockFrom.mockReturnValue(builder);

    const result = await getShow(999, "user@test.com");
    expect(result).toBeNull();
  });
});

describe("deleteShow", () => {
  it("deletes show by id and user_email", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(deleteShow(1, "user@test.com")).resolves.toBeUndefined();
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Delete failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(deleteShow(1, "user@test.com")).rejects.toEqual({
      message: "Delete failed",
    });
  });
});

describe("markShowFinalized", () => {
  it("updates finalized_at timestamp", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await expect(
      markShowFinalized(1, "user@test.com")
    ).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("shows");
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Update failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(markShowFinalized(1, "user@test.com")).rejects.toEqual({
      message: "Update failed",
    });
  });
});
