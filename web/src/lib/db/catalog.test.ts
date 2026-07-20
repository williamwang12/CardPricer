import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom, mockRpc } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  return { mockFrom, mockRpc };
});

vi.mock("@/lib/supabase", () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: () => unknown) => fn,
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/db/cards", () => ({
  cardsTag: vi.fn().mockReturnValue("cards:user@test.com"),
}));

import { EXCLUDE_PATTERNS, getAllSets } from "./catalog";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = [
    "select", "insert", "upsert", "update", "delete",
    "eq", "neq", "in", "is", "ilike", "not", "gte", "lte",
    "order", "limit", "range", "single", "maybeSingle",
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

describe("EXCLUDE_PATTERNS", () => {
  const patterns = EXCLUDE_PATTERNS.map((p) =>
    p.replaceAll("%", "").toLowerCase()
  );

  it("rejects promo sets", () => {
    const name = "Sword & Shield Promo Cards";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(true);
  });

  it("rejects McDonald's sets", () => {
    const name = "McDonald's Collection 2023";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(true);
  });

  it("rejects Build & Battle sets", () => {
    const name = "Scarlet & Violet Build & Battle Box";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(true);
  });

  it("rejects Theme Deck sets", () => {
    const name = "XY Theme Deck: Resilient Life";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(true);
  });

  it("accepts mainline sets", () => {
    const name = "Scarlet & Violet 151";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(false);
  });

  it("accepts expansion sets", () => {
    const name = "Prismatic Evolutions";
    expect(patterns.some((kw) => name.toLowerCase().includes(kw))).toBe(false);
  });
});

describe("getAllSets", () => {
  it("filters out excluded sets and merges logos", async () => {
    mockRpc.mockResolvedValue({
      data: [
        { group_id: 1, group_name: "Scarlet & Violet 151", card_count: 200 },
        {
          group_id: 2,
          group_name: "Sword & Shield Promo Cards",
          card_count: 50,
        },
      ],
      error: null,
    });
    const logosBuilder = chainable({
      data: [
        {
          group_id: 1,
          logo_url: "https://logo.png",
          symbol_url: "https://sym.png",
          release_date: "2023-09-22",
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(logosBuilder);

    const sets = await getAllSets();
    expect(sets).toHaveLength(1);
    expect(sets[0].group_name).toBe("Scarlet & Violet 151");
    expect(sets[0].logo_url).toBe("https://logo.png");
  });

  it("throws on rpc error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "RPC failed" },
    });

    await expect(getAllSets()).rejects.toEqual({ message: "RPC failed" });
  });
});
