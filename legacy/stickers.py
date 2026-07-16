"""Generate printable sticker sheets as PDF (Avery 5167 & Avery Presta 94102)."""

from __future__ import annotations

import io
from typing import Optional

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader

from models import Card

PAGE_WIDTH, PAGE_HEIGHT = letter

# ── Label format specifications ──────────────────────────────────────────────

LABEL_FORMATS = {
    "avery5167": {
        "label": "Avery 5167 (0.5\" × 1.75\")",
        "cols": 4,
        "rows": 20,
        "width": 1.75 * inch,
        "height": 0.5 * inch,
        "left_margin": 0.28125 * inch,
        "top_margin": 0.5 * inch,
        "h_gap": 0.3125 * inch,
        "v_gap": 0,
    },
    "avery94102": {
        "label": "Avery Presta 94102 (0.75\" square)",
        "cols": 8,
        "rows": 10,
        "width": 0.75 * inch,
        "height": 0.75 * inch,
        "left_margin": 0.375 * inch,
        "top_margin": 0.625 * inch,
        "h_gap": 0.25 * inch,
        "v_gap": 0.25 * inch,
    },
}


def _label_origin(col: int, row: int, fmt: dict) -> tuple[float, float]:
    """Return the bottom-left (x, y) of the label at (col, row) in PDF coords."""
    x = fmt["left_margin"] + col * (fmt["width"] + fmt["h_gap"])
    y = PAGE_HEIGHT - fmt["top_margin"] - fmt["height"] - row * (fmt["height"] + fmt["v_gap"])
    return x, y


def _draw_label(
    c: Canvas,
    x: float,
    y: float,
    name: str,
    price: Optional[float],
    logo_reader: Optional[ImageReader],
    fmt: dict,
) -> None:
    """Draw a single rectangular label (Avery 5167) at position (x, y) bottom-left."""
    padding = 2
    logo_padding = 2
    label_w = fmt["width"]
    label_h = fmt["height"]

    text_left = x + padding
    if logo_reader is not None:
        logo_h = label_h - 2 * logo_padding
        iw, ih = logo_reader.getSize()
        logo_w = logo_h * (iw / ih)
        logo_x = x + logo_padding
        logo_y = y + logo_padding
        c.drawImage(logo_reader, logo_x, logo_y, logo_w, logo_h, mask="auto")
        text_left = logo_x + logo_w + padding + 1

    text_right = x + label_w - padding
    max_text_width = text_right - text_left

    name_font_size = 5.5
    price_font_size = 16

    price_str = f"${price:.2f}" if price is not None else "N/A"
    price_y = y + (label_h - price_font_size) / 2 - 3
    c.setFillColor("#000000")
    c.setFont("Helvetica-Bold", price_font_size)
    c.drawString(text_left, price_y, price_str)

    name_y = price_y + price_font_size + 1
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


def _draw_square_label(
    c: Canvas,
    x: float,
    y: float,
    name: str,
    price: Optional[float],
    logo_reader: Optional[ImageReader],
    fmt: dict,
) -> None:
    """Draw a single square label (Avery Presta 94102) at position (x, y) bottom-left.

    Layout (top to bottom): optional logo, card name (small), price (large centered).
    """
    padding = 2
    label_w = fmt["width"]
    label_h = fmt["height"]

    name_font_size = 5
    price_font_size = 14

    # Vertical layout from top of label downward
    cursor_y_top = y + label_h - padding  # top inner edge

    # -- Optional logo (centered, ~18pt tall) --
    if logo_reader is not None:
        logo_h = 18
        iw, ih = logo_reader.getSize()
        logo_w = logo_h * (iw / ih)
        logo_x = x + (label_w - logo_w) / 2
        logo_y = cursor_y_top - logo_h
        c.drawImage(logo_reader, logo_x, logo_y, logo_w, logo_h, mask="auto")
        cursor_y_top = logo_y - 1

    # -- Card name (centered, small) --
    max_text_width = label_w - 2 * padding
    c.setFillColor("#444444")
    c.setFont("Helvetica", name_font_size)

    display_name = name
    if max_text_width > 0:
        while (c.stringWidth(display_name, "Helvetica", name_font_size) > max_text_width
               and len(display_name) > 1):
            display_name = display_name[:-1]
        if display_name != name and len(display_name) > 1:
            display_name = display_name[:-1] + "\u2026"

    name_w = c.stringWidth(display_name, "Helvetica", name_font_size)
    name_x = x + (label_w - name_w) / 2
    name_y = cursor_y_top - name_font_size
    c.drawString(name_x, name_y, display_name)

    # -- Price (centered, large bold) --
    price_str = f"${price:.2f}" if price is not None else "N/A"
    c.setFillColor("#000000")
    c.setFont("Helvetica-Bold", price_font_size)
    price_w = c.stringWidth(price_str, "Helvetica-Bold", price_font_size)
    price_x = x + (label_w - price_w) / 2
    # Center price vertically in remaining space below name
    remaining_top = name_y - 1
    remaining_bottom = y + padding
    price_y = remaining_bottom + (remaining_top - remaining_bottom - price_font_size) / 2
    c.drawString(price_x, price_y, price_str)


def generate_sticker_pdf(
    cards: list[Card],
    logo_bytes: Optional[bytes] = None,
    label_format: str = "avery5167",
) -> bytes:
    """Generate a sticker-sheet PDF and return it as bytes.

    Each card with qty > 1 produces one sticker per copy.
    """
    fmt = LABEL_FORMATS[label_format]
    labels_per_page = fmt["cols"] * fmt["rows"]
    draw_fn = _draw_square_label if label_format == "avery94102" else _draw_label

    stickers: list[Card] = []
    for card in cards:
        if card.market_price is not None and card.market_price > 1:
            stickers.extend([card] * card.quantity)

    buf = io.BytesIO()
    c = Canvas(buf, pagesize=letter)

    logo_reader = None
    if logo_bytes:
        logo_reader = ImageReader(io.BytesIO(logo_bytes))

    for i, card in enumerate(stickers):
        pos_on_page = i % labels_per_page
        col = pos_on_page % fmt["cols"]
        row = pos_on_page // fmt["cols"]

        if pos_on_page == 0 and i > 0:
            c.showPage()

        if logo_bytes and pos_on_page == 0:
            logo_reader = ImageReader(io.BytesIO(logo_bytes))

        x, y = _label_origin(col, row, fmt)
        draw_fn(c, x, y, card.name, card.market_price, logo_reader, fmt)

    c.save()
    return buf.getvalue()


def labels_per_page(label_format: str = "avery5167") -> int:
    """Return the number of labels per page for the given format."""
    fmt = LABEL_FORMATS[label_format]
    return fmt["cols"] * fmt["rows"]


def sticker_count(cards: list[Card]) -> int:
    """Return total number of stickers (expanded by quantity) for cards above $1."""
    return sum(c.quantity for c in cards if c.market_price is not None and c.market_price > 1)
