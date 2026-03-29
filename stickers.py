"""Generate printable Avery 5167 sticker sheets as PDF."""

from __future__ import annotations

import io
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader

from models import Card

# Avery 5167 specs (US Letter 8.5" x 11")
LABELS_PER_ROW = 4
LABELS_PER_COL = 20
LABELS_PER_PAGE = LABELS_PER_ROW * LABELS_PER_COL  # 80

LABEL_WIDTH = 1.75 * inch
LABEL_HEIGHT = 0.5 * inch

TOP_MARGIN = 0.5 * inch
LEFT_MARGIN = 0.28125 * inch
H_GAP = 0.3125 * inch
V_GAP = 0  # labels touch vertically

PAGE_WIDTH, PAGE_HEIGHT = letter


def _label_origin(col: int, row: int) -> tuple[float, float]:
    """Return the bottom-left (x, y) of the label at (col, row) in PDF coords."""
    x = LEFT_MARGIN + col * (LABEL_WIDTH + H_GAP)
    # PDF y=0 is bottom; row 0 is the top row
    y = PAGE_HEIGHT - TOP_MARGIN - (row + 1) * (LABEL_HEIGHT + V_GAP)
    return x, y


def _draw_label(
    c: Canvas,
    x: float,
    y: float,
    name: str,
    price: Optional[float],
    logo_reader: Optional[ImageReader],
) -> None:
    """Draw a single label at position (x, y) bottom-left.

    Two-line layout: card name (small, gray) on top, price (large, bold) below.
    """
    padding = 2  # points from edges
    logo_padding = 2  # points around logo

    # -- Logo (left-aligned, spans full label height) --
    text_left = x + padding
    if logo_reader is not None:
        logo_h = LABEL_HEIGHT - 2 * logo_padding  # ~0.4" / 29pt
        iw, ih = logo_reader.getSize()
        logo_w = logo_h * (iw / ih)
        logo_x = x + logo_padding
        logo_y = y + logo_padding
        c.drawImage(logo_reader, logo_x, logo_y, logo_w, logo_h, mask="auto")
        text_left = logo_x + logo_w + padding + 1

    # -- Text area bounds --
    text_right = x + LABEL_WIDTH - padding
    max_text_width = text_right - text_left

    # Vertical positions: split label into upper and lower halves
    mid_y = y + LABEL_HEIGHT / 2
    name_font_size = 5.5
    price_font_size = 10

    # -- Card name (top line): small, gray --
    name_y = mid_y + 3  # a few points above midline
    c.setFillColor("#444444")
    c.setFont("Helvetica", name_font_size)

    display_name = name
    if max_text_width > 0:
        while (c.stringWidth(display_name, "Helvetica", name_font_size) > max_text_width
               and len(display_name) > 1):
            display_name = display_name[:-1]
        if display_name != name and len(display_name) > 1:
            display_name = display_name[:-1] + "\u2026"
        c.drawString(text_left, name_y, display_name)

    # -- Price (bottom line): large, bold, black --
    price_str = f"${price:.2f}" if price is not None else "N/A"
    price_y = mid_y - price_font_size + 1  # below midline
    c.setFillColor("#000000")
    c.setFont("Helvetica-Bold", price_font_size)
    c.drawString(text_left, price_y, price_str)



def generate_sticker_pdf(
    cards: list[Card],
    logo_bytes: Optional[bytes] = None,
) -> bytes:
    """Generate an Avery 5167 sticker-sheet PDF and return it as bytes.

    Each card with qty > 1 produces one sticker per copy.
    """
    # Expand cards by quantity
    stickers: list[Card] = []
    for card in cards:
        if card.market_price is not None:
            stickers.extend([card] * card.quantity)

    buf = io.BytesIO()
    c = Canvas(buf, pagesize=letter)

    # Prepare logo reader once (reusable across labels)
    logo_reader = None
    if logo_bytes:
        logo_reader = ImageReader(io.BytesIO(logo_bytes))

    for i, card in enumerate(stickers):
        page_idx = i // LABELS_PER_PAGE
        pos_on_page = i % LABELS_PER_PAGE
        col = pos_on_page % LABELS_PER_ROW
        row = pos_on_page // LABELS_PER_ROW

        if pos_on_page == 0 and i > 0:
            c.showPage()

        # Need a fresh ImageReader per page since reportlab may consume it
        if logo_bytes and pos_on_page == 0:
            logo_reader = ImageReader(io.BytesIO(logo_bytes))

        x, y = _label_origin(col, row)
        _draw_label(c, x, y, card.name, card.market_price, logo_reader)

    c.save()
    return buf.getvalue()


def sticker_count(cards: list[Card]) -> int:
    """Return total number of stickers (expanded by quantity) for priced cards."""
    return sum(c.quantity for c in cards if c.market_price is not None)
