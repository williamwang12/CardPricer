import { describe, it, expect } from "vitest";
import { parseCatalogQuery } from "@/lib/catalog-search";
import type { CatalogSet } from "@/lib/db/catalog";

const SETS = [
  { group_id: 1, group_name: "ex Battle Stadium" },
  { group_id: 2, group_name: "Scarlet & Violet 151" },
  { group_id: 3, group_name: "EX Ruby & Sapphire" },
] as CatalogSet[];

describe("parseCatalogQuery", () => {
  it("does not treat a trailing card qualifier as a set", () => {
    // "ex" appears in "ex Battle Stadium" / "EX Ruby & Sapphire", but here it's
    // the card suffix (Gardevoir ex), so the search must span all sets.
    const parsed = parseCatalogQuery("Gardevoir EX", SETS);
    expect(parsed.matchedSet).toBeNull();
    expect(parsed.namePart).toBe("Gardevoir EX");
    expect(parsed.numberPart).toBeNull();
  });

  it.each(["Charizard V", "Pikachu VMAX", "Mewtwo GX", "Giratina VSTAR"])(
    "keeps %s as a name search, not a set filter",
    (query) => {
      const parsed = parseCatalogQuery(query, SETS);
      expect(parsed.matchedSet).toBeNull();
      expect(parsed.namePart).toBe(query);
    }
  );

  it("still matches a set when the trailing phrase is more than a qualifier", () => {
    const parsed = parseCatalogQuery("Gardevoir ex Battle Stadium", SETS);
    expect(parsed.matchedSet?.group_id).toBe(1);
    expect(parsed.namePart).toBe("Gardevoir");
  });

  it("matches a set by a distinctive trailing token", () => {
    const parsed = parseCatalogQuery("Charizard 151", SETS);
    expect(parsed.matchedSet?.group_id).toBe(2);
    expect(parsed.namePart).toBe("Charizard");
    expect(parsed.numberPart).toBeNull();
  });

  it("treats a trailing plain number as a card number, not a set", () => {
    const parsed = parseCatalogQuery("Gardevoir 6", SETS);
    expect(parsed.matchedSet).toBeNull();
    expect(parsed.numberPart).toBe("6");
    expect(parsed.namePart).toBe("Gardevoir");
  });
});
