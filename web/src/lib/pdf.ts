import PDFDocument from "pdfkit";
import type { Card } from "@/lib/types";
import { LABEL_FORMATS } from "@/lib/label-formats";

export { LABEL_FORMATS };

function labelOrigin(
  col: number,
  row: number,
  fmt: (typeof LABEL_FORMATS)[string]
): { x: number; y: number } {
  // pdfkit uses top-left origin
  const x = fmt.leftMargin + col * (fmt.width + fmt.hGap);
  const y = fmt.topMargin + row * (fmt.height + fmt.vGap);
  return { x, y };
}

function drawRectLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  _name: string,
  price: number | null,
  _logoBuffer: Buffer | null,
  fmt: (typeof LABEL_FORMATS)[string]
) {
  const priceFontSize = 16;
  const priceStr = price != null ? `$${price.toFixed(2)}` : "N/A";
  doc.font("Helvetica-Bold").fontSize(priceFontSize).fillColor("#000000");
  const priceW = doc.widthOfString(priceStr);
  const priceX = x + (fmt.width - priceW) / 2;
  const priceY = y + (fmt.height - priceFontSize) / 2;
  doc.text(priceStr, priceX, priceY, { lineBreak: false });
}

function drawSquareLabel(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  _name: string,
  price: number | null,
  _logoBuffer: Buffer | null,
  fmt: (typeof LABEL_FORMATS)[string]
) {
  const priceFontSize = 14;
  const priceStr = price != null ? `$${price.toFixed(2)}` : "N/A";
  doc.font("Helvetica-Bold").fontSize(priceFontSize).fillColor("#000000");
  const priceW = doc.widthOfString(priceStr);
  const priceX = x + (fmt.width - priceW) / 2;
  const priceY = y + (fmt.height - priceFontSize) / 2;
  doc.text(priceStr, priceX, priceY, { lineBreak: false });
}

export function labelsPerPage(formatKey = "avery5167"): number {
  const fmt = LABEL_FORMATS[formatKey];
  return fmt.cols * fmt.rows;
}

export function stickerCount(cards: Card[]): number {
  return cards.reduce(
    (sum, c) =>
      sum + (c.market_price != null && c.market_price > 1 ? c.quantity : 0),
    0
  );
}

export async function generateStickerPdf(
  cards: Card[],
  logoBuffer: Buffer | null = null,
  formatKey = "avery5167"
): Promise<Buffer> {
  const fmt = LABEL_FORMATS[formatKey];
  const lpp = fmt.cols * fmt.rows;
  const drawFn = formatKey === "avery94102" ? drawSquareLabel : drawRectLabel;

  // Expand cards into individual stickers
  const stickers: Card[] = [];
  for (const card of cards) {
    if (card.market_price != null && card.market_price > 1) {
      for (let i = 0; i < card.quantity; i++) {
        stickers.push(card);
      }
    }
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "letter",
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    for (let i = 0; i < stickers.length; i++) {
      const posOnPage = i % lpp;
      const col = posOnPage % fmt.cols;
      const row = Math.floor(posOnPage / fmt.cols);

      if (posOnPage === 0 && i > 0) {
        doc.addPage();
      }

      const { x, y } = labelOrigin(col, row, fmt);
      drawFn(doc, x, y, stickers[i].name, stickers[i].market_price, logoBuffer, fmt);
    }

    doc.end();
  });
}
