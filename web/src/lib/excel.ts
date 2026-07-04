import ExcelJS from "exceljs";
import { formatPrice, type CurrencyCode } from "@/lib/currency";
import type { Card, PriceMover } from "@/lib/types";

export async function exportInventory(
  cards: Card[],
  currency: CurrencyCode = "USD",
  rate = 1
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Inventory");
  ws.addRow(["Card", "Market Price"]);

  for (const c of cards) {
    if (c.market_price == null || Math.round(c.market_price) <= 1) continue;
    const label = c.number ? `${c.name} #${c.number}` : c.name;
    const price = formatPrice(c.market_price, currency, rate);
    for (let i = 0; i < c.quantity; i++) {
      ws.addRow([label, price]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportPriceList(
  cards: Card[],
  currency: CurrencyCode = "USD",
  rate = 1
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Price List");
  ws.addRow(["Card", "Market Price"]);

  for (const c of cards) {
    const label = c.number ? `${c.name} #${c.number}` : c.name;
    const price = c.market_price != null
      ? formatPrice(c.market_price, currency, rate, "ceil")
      : "";
    for (let i = 0; i < c.quantity; i++) {
      ws.addRow([label, price]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function exportMovers(
  movers: PriceMover[],
  minPrice = 0,
  currency: CurrencyCode = "USD",
  rate = 1
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Price Movers");
  ws.addRow(["Card", "Market Price"]);

  for (const m of movers) {
    if (m.newPrice != null && m.newPrice >= minPrice) {
      const label = m.number ? `${m.name} #${m.number}` : m.name;
      ws.addRow([label, formatPrice(m.newPrice, currency, rate)]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
