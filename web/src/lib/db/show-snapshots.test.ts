import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("./cards", () => ({
  loadAllCards: vi.fn().mockResolvedValue([
    { name: "Pikachu", number: "25", quantity: 2, market_price: 5.0 },
    { name: "Charizard", number: "6", quantity: 1, market_price: 45.0 },
  ]),
  cardsTag: vi.fn().mockReturnValue("cards:user@test.com"),
}));

import {
  takeSnapshot,
  findShowsNeedingPreSnapshot,
  loadSnapshotStatuses,
  loadShowSnapshots,
} from "./show-snapshots";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "neq", "in", "is", "gte", "lte", "order", "range", "single",
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

describe("takeSnapshot", () => {
  it("serializes card data and upserts snapshot", async () => {
    const snapshotRow = {
      id: 1,
      show_id: 10,
      type: "pre",
      cards_json: JSON.stringify([
        { name: "Pikachu", number: "25", quantity: 2, market_price: 5.0 },
        { name: "Charizard", number: "6", quantity: 1, market_price: 45.0 },
      ]),
      created_at: "2024-03-15T00:00:00Z",
    };
    const builder = chainable({ data: snapshotRow, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await takeSnapshot(10, "pre", "user@test.com");
    expect(result.show_id).toBe(10);
    expect(result.type).toBe("pre");
    expect(result.cards).toHaveLength(2);
    expect(result.cards[0].name).toBe("Pikachu");
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Upsert failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(takeSnapshot(10, "pre", "user@test.com")).rejects.toEqual({
      message: "Upsert failed",
    });
  });
});

describe("findShowsNeedingPreSnapshot", () => {
  it("returns shows that need pre-snapshot", async () => {
    const showsBuilder = chainable({
      data: [
        { id: 1, user_email: "a@test.com" },
        { id: 2, user_email: "b@test.com" },
      ],
      error: null,
    });
    const snapsBuilder = chainable({
      data: [{ show_id: 1 }],
      error: null,
    });

    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      return callIdx++ === 0 ? showsBuilder : snapsBuilder;
    });

    const result = await findShowsNeedingPreSnapshot();
    expect(result).toEqual([{ show_id: 2, user_email: "b@test.com" }]);
  });

  it("returns empty when no shows in range", async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await findShowsNeedingPreSnapshot();
    expect(result).toEqual([]);
  });

  it("throws on shows query error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Query failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(findShowsNeedingPreSnapshot()).rejects.toEqual({
      message: "Query failed",
    });
  });
});

describe("loadSnapshotStatuses", () => {
  it("returns hasPre/hasPost map", async () => {
    const builder = chainable({
      data: [
        { show_id: 1, type: "pre" },
        { show_id: 1, type: "post" },
        { show_id: 2, type: "pre" },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const result = await loadSnapshotStatuses([1, 2, 3], "user@test.com");
    expect(result.get(1)).toEqual({ hasPre: true, hasPost: true });
    expect(result.get(2)).toEqual({ hasPre: true, hasPost: false });
    expect(result.get(3)).toEqual({ hasPre: false, hasPost: false });
  });

  it("returns empty map for empty showIds", async () => {
    const result = await loadSnapshotStatuses([], "user@test.com");
    expect(result.size).toBe(0);
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(
      loadSnapshotStatuses([1], "user@test.com")
    ).rejects.toEqual({ message: "Failed" });
  });
});

describe("loadShowSnapshots", () => {
  it("returns pre and post snapshots", async () => {
    const builder = chainable({
      data: [
        {
          id: 1,
          show_id: 10,
          type: "pre",
          cards_json: JSON.stringify([
            { name: "A", number: "1", quantity: 1, market_price: 5 },
          ]),
          created_at: "2024-03-15T00:00:00Z",
        },
        {
          id: 2,
          show_id: 10,
          type: "post",
          cards_json: JSON.stringify([
            { name: "A", number: "1", quantity: 0, market_price: 5 },
          ]),
          created_at: "2024-03-16T00:00:00Z",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const result = await loadShowSnapshots(10, "user@test.com");
    expect(result.pre).not.toBeNull();
    expect(result.post).not.toBeNull();
    expect(result.pre!.cards[0].name).toBe("A");
    expect(result.post!.type).toBe("post");
  });

  it("returns nulls when no snapshots exist", async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await loadShowSnapshots(10, "user@test.com");
    expect(result.pre).toBeNull();
    expect(result.post).toBeNull();
  });

  it("throws on error", async () => {
    const builder = chainable({
      data: null,
      error: { message: "Failed" },
    });
    mockFrom.mockReturnValue(builder);

    await expect(
      loadShowSnapshots(10, "user@test.com")
    ).rejects.toEqual({ message: "Failed" });
  });
});
