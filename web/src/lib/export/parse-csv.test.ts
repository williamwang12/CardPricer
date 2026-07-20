import { describe, it, expect } from "vitest";
import {
  parseTcgPlayerCsv,
  parseDeckTradrCsv,
  parseCollectrCsv,
} from "./parse-csv";

describe("parseTcgPlayerCsv", () => {
  it("parses standard rows", () => {
    const csv = `Product Name,Number,TCG Market Price
Charizard ex - 183/165,183,45.08
Pikachu VMAX - 185/185,185,18.50`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      name: "Charizard EX",
      number: "183",
      quantity: 1,
      market_price: 45.08,
    });
    expect(cards[1]).toEqual({
      name: "Pikachu VMAX",
      number: "185",
      quantity: 1,
      market_price: 18.5,
    });
  });

  it("applies name normalization (strips apostrophes)", () => {
    const csv = `Product Name,Number,TCG Market Price
Lillie's Determination - 168/142,168,5.00`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards[0].name).toBe("Lillies Determination");
  });

  it("handles null/empty price", () => {
    const csv = `Product Name,Number,TCG Market Price
Charizard ex - 183/165,183,`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards[0].market_price).toBeNull();
  });

  it("handles dollar sign in price", () => {
    const csv = `Product Name,Number,TCG Market Price
Charizard ex - 183/165,183,$45.08`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards[0].market_price).toBe(45.08);
  });

  it("skips empty rows", () => {
    const csv = `Product Name,Number,TCG Market Price
,,
Pikachu VMAX - 185/185,185,18.50`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards).toHaveLength(1);
  });

  it("always sets quantity to 1", () => {
    const csv = `Product Name,Number,TCG Market Price
Pikachu VMAX - 185/185,185,18.50`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards[0].quantity).toBe(1);
  });

  it("handles number with leading zeros via cleanNumber", () => {
    const csv = `Product Name,Number,TCG Market Price
Flareon ex - 014/131,014,10.00`;
    const cards = parseTcgPlayerCsv(csv);
    expect(cards[0].number).toBe("14");
  });
});

describe("parseDeckTradrCsv", () => {
  it("parses standard rows", () => {
    const csv = `Card Name,Number,Quantity,Market Price
Charizard ex,183/165,2,$45.08`;
    const cards = parseDeckTradrCsv(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      name: "Charizard EX",
      number: "183/165",
      quantity: 2,
      market_price: 45.08,
    });
  });

  it("defaults quantity to 1 when missing", () => {
    const csv = `Card Name,Number,Quantity,Market Price
Pikachu VMAX,185,,18.50`;
    const cards = parseDeckTradrCsv(csv);
    expect(cards[0].quantity).toBe(1);
  });

  it("defaults quantity to 1 for invalid values", () => {
    const csv = `Card Name,Number,Quantity,Market Price
Pikachu VMAX,185,abc,18.50`;
    const cards = parseDeckTradrCsv(csv);
    expect(cards[0].quantity).toBe(1);
  });

  it("handles null market price", () => {
    const csv = `Card Name,Number,Quantity,Market Price
Pikachu VMAX,185,1,`;
    const cards = parseDeckTradrCsv(csv);
    expect(cards[0].market_price).toBeNull();
  });

  it("skips rows with empty card name", () => {
    const csv = `Card Name,Number,Quantity,Market Price
,185,1,18.50
Pikachu VMAX,185,1,18.50`;
    const cards = parseDeckTradrCsv(csv);
    expect(cards).toHaveLength(1);
  });
});

describe("parseCollectrCsv", () => {
  it("parses standard rows with date-varying price column", () => {
    const csv = `Product Name,Card Number,Quantity,Market Price (As of 2024-01-15)
Charizard VSTAR (Secret) - 174/172,174,3,$45.00`;
    const cards = parseCollectrCsv(csv);
    expect(cards).toHaveLength(1);
    expect(cards[0]).toEqual({
      name: "Charizard VSTAR",
      number: "174",
      quantity: 3,
      market_price: 45.0,
    });
  });

  it("extracts pokemon name from product name", () => {
    const csv = `Product Name,Card Number,Quantity,Market Price (As of 2024-01-15)
Flareon ex - 014/131 (Prismatic Evolutions Stamp),014,1,$10.00`;
    const cards = parseCollectrCsv(csv);
    expect(cards[0].name).toBe("Flareon EX");
  });

  it("handles missing price column", () => {
    const csv = `Product Name,Card Number,Quantity
Charizard VSTAR (Secret) - 174/172,174,3`;
    const cards = parseCollectrCsv(csv);
    expect(cards[0].market_price).toBeNull();
  });

  it("defaults quantity to 1 when missing", () => {
    const csv = `Product Name,Card Number,Quantity,Market Price (As of 2024-01-15)
Pikachu VMAX - 185/185,185,,18.50`;
    const cards = parseCollectrCsv(csv);
    expect(cards[0].quantity).toBe(1);
  });

  it("skips rows with empty product name", () => {
    const csv = `Product Name,Card Number,Quantity,Market Price (As of 2024-01-15)
,,1,$5.00
Pikachu VMAX - 185/185,185,1,$18.50`;
    const cards = parseCollectrCsv(csv);
    expect(cards).toHaveLength(1);
  });
});
