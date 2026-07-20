import { describe, it, expect } from "vitest";
import { formatPrice, SUPPORTED_CURRENCIES } from "./currency";

describe("formatPrice", () => {
  it("returns em-dash for null", () => {
    expect(formatPrice(null)).toBe("\u2014");
  });

  it("formats zero as $0.00", () => {
    expect(formatPrice(0)).toBe("$0.00");
  });

  it("formats USD with 2 decimals by default", () => {
    expect(formatPrice(12.5)).toBe("$12.50");
  });

  it("rounds by default (round mode)", () => {
    expect(formatPrice(1.555)).toBe("$1.56");
  });

  it("rounds up with ceil mode", () => {
    expect(formatPrice(1.551, "USD", 1, "ceil")).toBe("$1.56");
  });

  it("rounds down with floor mode", () => {
    expect(formatPrice(1.559, "USD", 1, "floor")).toBe("$1.55");
  });

  it("formats JPY with 0 decimals and yen symbol", () => {
    expect(formatPrice(100, "JPY", 150)).toBe("\u00A515000");
  });

  it("formats GBP with pound symbol", () => {
    expect(formatPrice(10, "GBP", 0.8)).toBe("\u00A38.00");
  });

  it("formats EUR with euro symbol", () => {
    expect(formatPrice(10, "EUR", 0.92)).toBe("\u20AC9.20");
  });

  it("formats CAD with CA$ prefix", () => {
    expect(formatPrice(10, "CAD", 1.36)).toBe("CA$13.60");
  });

  it("formats AUD with A$ prefix", () => {
    expect(formatPrice(10, "AUD", 1.53)).toBe("A$15.30");
  });

  it("respects decimalOverride", () => {
    expect(formatPrice(12.345, "USD", 1, "round", 1)).toBe("$12.3");
  });
});

describe("SUPPORTED_CURRENCIES", () => {
  it("has 6 currencies", () => {
    expect(Object.keys(SUPPORTED_CURRENCIES)).toHaveLength(6);
  });

  it("JPY has 0 decimals", () => {
    expect(SUPPORTED_CURRENCIES.JPY.decimals).toBe(0);
  });

  it("USD has 2 decimals", () => {
    expect(SUPPORTED_CURRENCIES.USD.decimals).toBe(2);
  });
});
