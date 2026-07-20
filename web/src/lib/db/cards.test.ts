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

import { loadAllCards, addCard, deleteCards, replaceAllCards } from "./cards";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "neq", "order", "range", "limit", "single", "in",
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

describe("loadAllCards", () => {
  it("returns cards from a single page (< 1000)", async () => {
    const cards = [
      { id: 1, name: "Pikachu", number: "25", quantity: 1, user_email: "user@test.com" },
    ];
    const builder = chainable({ data: cards, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await loadAllCards("user@test.com");
    expect(result).toEqual(cards);
    expect(mockFrom).toHaveBeenCalledWith("cards");
  });

  it("paginates when first page is full (1000 rows)", async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: i,
      name: `Card ${i}`,
    }));
    const page2 = [{ id: 1000, name: "Card 1000" }];

    let callCount = 0;
    const builder: Record<string, unknown> = {};
    const methods = ["select", "eq", "order", "range"];
    for (const m of methods) {
      builder[m] = vi.fn().mockReturnThis();
    }
    builder.then = (resolve: (v: unknown) => void) => {
      const result =
        callCount === 0
          ? { data: page1, error: null }
          : { data: page2, error: null };
      callCount++;
      resolve(result);
      return Promise.resolve(result);
    };
    mockFrom.mockReturnValue(builder);

    const result = await loadAllCards("user@test.com");
    expect(result).toHaveLength(1001);
  });

  it("returns empty array when no data", async () => {
    const builder = chainable({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await loadAllCards("user@test.com");
    expect(result).toEqual([]);
  });

  it("throws on supabase error", async () => {
    const builder = chainable({ data: null, error: { message: "DB error" } });
    mockFrom.mockReturnValue(builder);

    await expect(loadAllCards("user@test.com")).rejects.toEqual({
      message: "DB error",
    });
  });
});

describe("addCard", () => {
  it("inserts new card when no existing match", async () => {
    const selectBuilder = chainable({ data: [], error: null });
    const upsertBuilder = chainable({ data: null, error: null });

    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      return callIdx++ === 0 ? selectBuilder : upsertBuilder;
    });

    await addCard(
      { name: "pikachu", number: "25", quantity: 1, market_price: 5.0 },
      "user@test.com"
    );

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("merges quantity when card already exists", async () => {
    const selectBuilder = chainable({
      data: [{ id: 42, quantity: 2 }],
      error: null,
    });
    const updateBuilder = chainable({ data: null, error: null });

    let callIdx = 0;
    mockFrom.mockImplementation(() => {
      return callIdx++ === 0 ? selectBuilder : updateBuilder;
    });

    await addCard(
      { name: "pikachu", number: "25", quantity: 3 },
      "user@test.com"
    );

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});

describe("deleteCards", () => {
  it("deletes each card by ID", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await deleteCards([1, 2, 3]);
    expect(mockFrom).toHaveBeenCalledTimes(3);
  });

  it("handles empty array", async () => {
    await deleteCards([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("replaceAllCards", () => {
  it("deletes all then inserts new cards", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const count = await replaceAllCards(
      [
        { name: "Pikachu", number: "25", quantity: 1 },
        { name: "Charizard", number: "6", quantity: 2 },
      ],
      "user@test.com"
    );

    expect(count).toBe(2);
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("returns 0 for empty card array (delete only)", async () => {
    const builder = chainable({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    const count = await replaceAllCards([], "user@test.com");
    expect(count).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
