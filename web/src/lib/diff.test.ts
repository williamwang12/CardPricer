import { describe, it, expect } from "vitest";
import { diffShowSnapshots, cardKey } from "./diff";
import type { SnapshotCardWithQty } from "./types";

function card(
  name: string,
  number: string,
  quantity: number,
  market_price: number | null = null
): SnapshotCardWithQty {
  return { name, number, quantity, market_price };
}

describe("cardKey", () => {
  it("lowercases name and joins with pipe", () => {
    expect(cardKey("Charizard VSTAR", "18")).toBe("charizard vstar|18");
  });

  it("handles empty number", () => {
    expect(cardKey("Pikachu", "")).toBe("pikachu|");
  });
});

describe("diffShowSnapshots", () => {
  it("returns empty results for empty snapshots", () => {
    const result = diffShowSnapshots([], []);
    expect(result.sold).toEqual([]);
    expect(result.acquired).toEqual([]);
    expect(result.unsold).toEqual([]);
    expect(result.revenue).toBe(0);
  });

  it("detects a fully sold card (in pre, missing from post)", () => {
    const pre = [card("Charizard", "6", 1, 50)];
    const post: SnapshotCardWithQty[] = [];

    const result = diffShowSnapshots(pre, post);
    expect(result.sold).toHaveLength(1);
    expect(result.sold[0]).toEqual({
      name: "Charizard",
      number: "6",
      qty_sold: 1,
      qty_before: 1,
      market_price: 50,
    });
    expect(result.revenue).toBe(50);
    expect(result.unsold).toHaveLength(0);
    expect(result.acquired).toHaveLength(0);
  });

  it("detects partial sell (quantity decrease)", () => {
    const pre = [card("Pikachu", "25", 3, 10)];
    const post = [card("Pikachu", "25", 1, 10)];

    const result = diffShowSnapshots(pre, post);
    expect(result.sold).toHaveLength(1);
    expect(result.sold[0].qty_sold).toBe(2);
    expect(result.sold[0].qty_before).toBe(3);
    expect(result.revenue).toBe(20);
    expect(result.unsold).toHaveLength(0);
  });

  it("detects acquired-at-show (in post, missing from pre)", () => {
    const pre: SnapshotCardWithQty[] = [];
    const post = [card("Mewtwo", "150", 2, 30)];

    const result = diffShowSnapshots(pre, post);
    expect(result.acquired).toHaveLength(1);
    expect(result.acquired[0]).toEqual({
      name: "Mewtwo",
      number: "150",
      quantity: 2,
      market_price: 30,
    });
    expect(result.sold).toHaveLength(0);
    expect(result.revenue).toBe(0);
  });

  it("detects acquired copies of existing card (quantity increase)", () => {
    const pre = [card("Eevee", "55", 1, 5)];
    const post = [card("Eevee", "55", 3, 5)];

    const result = diffShowSnapshots(pre, post);
    expect(result.acquired).toHaveLength(1);
    expect(result.acquired[0].quantity).toBe(2); // bought 2 more
    expect(result.unsold).toHaveLength(1); // original copy is unsold
    expect(result.sold).toHaveLength(0);
  });

  it("marks unchanged cards as unsold", () => {
    const pre = [card("Bulbasaur", "1", 2, 3)];
    const post = [card("Bulbasaur", "1", 2, 3)];

    const result = diffShowSnapshots(pre, post);
    expect(result.unsold).toHaveLength(1);
    expect(result.sold).toHaveLength(0);
    expect(result.acquired).toHaveLength(0);
    expect(result.revenue).toBe(0);
  });

  it("handles mixed scenario: some sold, some unsold, some acquired", () => {
    const pre = [
      card("Charizard", "6", 1, 50),
      card("Pikachu", "25", 3, 10),
      card("Bulbasaur", "1", 2, 3),
    ];
    const post = [
      // Charizard gone — sold
      card("Pikachu", "25", 1, 10), // sold 2
      card("Bulbasaur", "1", 2, 3), // unsold
      card("Mewtwo", "150", 1, 30), // acquired
    ];

    const result = diffShowSnapshots(pre, post);
    expect(result.sold).toHaveLength(2);
    expect(result.unsold).toHaveLength(1);
    expect(result.acquired).toHaveLength(1);
    // Revenue: Charizard (1×50) + Pikachu (2×10) = 70
    expect(result.revenue).toBe(70);
  });

  it("handles null market_price — sold card excluded from revenue", () => {
    const pre = [card("Unknown Card", "99", 1, null)];
    const post: SnapshotCardWithQty[] = [];

    const result = diffShowSnapshots(pre, post);
    expect(result.sold).toHaveLength(1);
    expect(result.sold[0].market_price).toBeNull();
    expect(result.revenue).toBe(0);
  });

  it("is case-insensitive on card names", () => {
    const pre = [card("charizard", "6", 1, 50)];
    const post = [card("Charizard", "6", 1, 50)];

    const result = diffShowSnapshots(pre, post);
    expect(result.unsold).toHaveLength(1);
    expect(result.sold).toHaveLength(0);
  });

  it("treats all pre cards as sold when post is empty", () => {
    const pre = [
      card("A", "1", 2, 10),
      card("B", "2", 1, 20),
    ];

    const result = diffShowSnapshots(pre, []);
    expect(result.sold).toHaveLength(2);
    expect(result.revenue).toBe(2 * 10 + 1 * 20);
  });

  it("treats all post cards as acquired when pre is empty", () => {
    const post = [
      card("A", "1", 2, 10),
      card("B", "2", 1, 20),
    ];

    const result = diffShowSnapshots([], post);
    expect(result.acquired).toHaveLength(2);
    expect(result.sold).toHaveLength(0);
    expect(result.revenue).toBe(0);
  });
});
