import { describe, it, expect } from "vitest";
import {
  normalizeName,
  normalizeNumber,
  extractPokemonName,
  deriveCleanName,
  cleanNumber,
} from "./utils";

describe("normalizeName", () => {
  it("converts to title case", () => {
    expect(normalizeName("charizard vstar")).toBe("Charizard VSTAR");
  });

  it("uppercases EX suffix", () => {
    expect(normalizeName("flareon ex")).toBe("Flareon EX");
  });

  it("uppercases VSTAR suffix", () => {
    expect(normalizeName("arceus vstar")).toBe("Arceus VSTAR");
  });

  it("uppercases VMAX suffix", () => {
    expect(normalizeName("pikachu vmax")).toBe("Pikachu VMAX");
  });

  it("strips straight apostrophes", () => {
    expect(normalizeName("Lillie's Determination")).toBe(
      "Lillies Determination"
    );
  });

  it("strips curly apostrophes", () => {
    expect(normalizeName("Lillie\u2019s Determination")).toBe(
      "Lillies Determination"
    );
  });

  it("strips left curly apostrophes", () => {
    expect(normalizeName("Lillie\u2018s Determination")).toBe(
      "Lillies Determination"
    );
  });

  it("handles empty string", () => {
    expect(normalizeName("")).toBe("");
  });

  it("handles already-normalized input", () => {
    expect(normalizeName("Charizard EX")).toBe("Charizard EX");
  });

  it("handles multi-word names", () => {
    expect(normalizeName("MEGA GENGAR EX")).toBe("Mega Gengar EX");
  });
});

describe("normalizeNumber", () => {
  it("strips leading zeros from numeric strings", () => {
    expect(normalizeNumber("076/198")).toBe("76");
  });

  it("returns just the part before slash", () => {
    expect(normalizeNumber("123/456")).toBe("123");
  });

  it("preserves non-numeric prefix", () => {
    expect(normalizeNumber("TG14/TG30")).toBe("TG14");
  });

  it("handles plain number without slash", () => {
    expect(normalizeNumber("76")).toBe("76");
  });

  it("handles '0' edge case (all zeros)", () => {
    expect(normalizeNumber("000")).toBe("0");
  });

  it("handles single zero", () => {
    expect(normalizeNumber("0")).toBe("0");
  });

  it("trims whitespace", () => {
    expect(normalizeNumber(" 076/198 ")).toBe("76");
  });
});

describe("extractPokemonName", () => {
  it("strips ' - 123/456' suffix", () => {
    expect(extractPokemonName("Flareon ex - 014/131")).toBe("Flareon ex");
  });

  it("strips '(variant)' suffix", () => {
    expect(extractPokemonName("Charizard VSTAR (Secret)")).toBe(
      "Charizard VSTAR"
    );
  });

  it("strips both suffix and variant annotation", () => {
    expect(
      extractPokemonName(
        "Flareon ex - 014/131 (Prismatic Evolutions Stamp)"
      )
    ).toBe("Flareon ex");
  });

  it("no-op when neither pattern is present", () => {
    expect(extractPokemonName("Mega Gengar ex")).toBe("Mega Gengar ex");
  });

  it("handles name with multiple dashes (keeps non-number dashes)", () => {
    expect(extractPokemonName("Ho-Oh V - 140/195")).toBe("Ho-Oh V");
  });
});

describe("deriveCleanName", () => {
  it("combines extraction and apostrophe stripping", () => {
    expect(deriveCleanName("Lillie's Determination - 168/142")).toBe(
      "Lillies Determination"
    );
  });

  it("strips curly quotes", () => {
    expect(deriveCleanName("Ethan\u2019s Typhlosion - 190/182")).toBe(
      "Ethans Typhlosion"
    );
  });

  it("no-op when name is already clean", () => {
    expect(deriveCleanName("Pikachu")).toBe("Pikachu");
  });
});

describe("cleanNumber", () => {
  it("converts Excel float 107.0 to '107'", () => {
    expect(cleanNumber(107.0)).toBe("107");
  });

  it("converts string '107.0' to '107'", () => {
    expect(cleanNumber("107.0")).toBe("107");
  });

  it("preserves real decimal", () => {
    expect(cleanNumber("107.5")).toBe("107.5");
  });

  it("leaves '284/217' untouched", () => {
    expect(cleanNumber("284/217")).toBe("284/217");
  });

  it("returns empty string for null", () => {
    expect(cleanNumber(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(cleanNumber(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(cleanNumber("")).toBe("");
  });

  it("handles integer string", () => {
    expect(cleanNumber("42")).toBe("42");
  });

  it("trims whitespace", () => {
    expect(cleanNumber(" 107.0 ")).toBe("107");
  });
});
