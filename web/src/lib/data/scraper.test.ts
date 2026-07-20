import { describe, it, expect, vi } from "vitest";

// Mock supabase before importing scraper functions
vi.mock("@/lib/supabase", () => ({
  supabase: {},
}));

import { pickBestVariant, matchFromRows } from "./scraper";

describe("pickBestVariant", () => {
  it("prefers Holofoil over Normal", () => {
    const rows = [
      { market_price: 5, url: "/normal", sub_type_name: "Normal", number: "1" },
      { market_price: 10, url: "/holo", sub_type_name: "Holofoil", number: "1" },
    ];
    const result = pickBestVariant(rows);
    expect(result.url).toBe("/holo");
  });

  it("prefers Normal over other types when no Holofoil", () => {
    const rows = [
      { market_price: 3, url: "/reverse", sub_type_name: "Reverse Holofoil", number: "1" },
      { market_price: 5, url: "/normal", sub_type_name: "Normal", number: "1" },
    ];
    const result = pickBestVariant(rows);
    expect(result.url).toBe("/normal");
  });

  it("returns first row when no Holofoil or Normal", () => {
    const rows = [
      { market_price: 3, url: "/reverse", sub_type_name: "Reverse Holofoil", number: "1" },
      { market_price: 7, url: "/art", sub_type_name: "Full Art", number: "1" },
    ];
    const result = pickBestVariant(rows);
    expect(result.url).toBe("/reverse");
  });

  it("handles single row", () => {
    const rows = [
      { market_price: 10, url: "/only", sub_type_name: "Normal", number: "1" },
    ];
    const result = pickBestVariant(rows);
    expect(result.url).toBe("/only");
  });
});

describe("matchFromRows", () => {
  const rows = [
    { market_price: 5, url: "/card-76", sub_type_name: "Normal", number: "076/198" },
    { market_price: 10, url: "/card-77", sub_type_name: "Holofoil", number: "077/198" },
    { market_price: 8, url: "/card-76-holo", sub_type_name: "Holofoil", number: "076/198" },
  ];

  it("filters by normalized number and picks best variant", () => {
    const result = matchFromRows(rows, "76");
    expect(result).not.toBeNull();
    expect(result!.price).toBe(8); // Holofoil version of 076
    expect(result!.url).toBe("/card-76-holo");
  });

  it("returns null when number provided but no match", () => {
    const result = matchFromRows(rows, "99");
    expect(result).toBeNull();
  });

  it("picks best variant from all rows when no number provided", () => {
    const result = matchFromRows(rows, "");
    expect(result).not.toBeNull();
    // Should pick first Holofoil found (card-77)
    expect(result!.url).toBe("/card-77");
  });

  it("rounds price to 2 decimal places", () => {
    const priceRows = [
      { market_price: 5.555, url: "/x", sub_type_name: "Normal", number: "1/1" },
    ];
    const result = matchFromRows(priceRows, "1");
    expect(result!.price).toBe(5.56);
  });
});
