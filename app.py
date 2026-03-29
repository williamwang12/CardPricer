import io
import os
from typing import Optional

import streamlit as st
import openpyxl
import pandas as pd

from models import Card
from scraper import price_cards
from stickers import generate_sticker_pdf, sticker_count

st.set_page_config(page_title="Pokemon Card Pricer", layout="wide")
st.title("Pokemon Card Pricer")
st.caption("Upload your card spreadsheet, map columns, and get TCGPlayer Near Mint market prices.")


# ── Helpers ──────────────────────────────────────────────────────────────────

def read_excel(file) -> pd.DataFrame:
    """Read an uploaded Excel file into a DataFrame."""
    return pd.read_excel(file, engine="openpyxl")


def cards_from_df(
    df: pd.DataFrame,
    col_name: str,
    col_number: Optional[str],
    col_quantity: Optional[str],
) -> list[Card]:
    """Convert a DataFrame to a list of Card objects using the column mapping."""
    cards = []
    for _, row in df.iterrows():
        name = str(row[col_name]).strip() if pd.notna(row[col_name]) else ""
        if not name:
            continue

        number = str(row[col_number]).strip() if col_number and pd.notna(row.get(col_number)) else ""

        quantity = 1
        if col_quantity and pd.notna(row.get(col_quantity)):
            try:
                quantity = int(row[col_quantity])
            except (ValueError, TypeError):
                quantity = 1

        cards.append(Card(name=name, number=number, quantity=quantity))
    return cards


def cards_to_df(cards: list[Card]) -> pd.DataFrame:
    """Convert a list of Card objects to a DataFrame for display."""
    rows = []
    for c in cards:
        rows.append({
            "Name": c.name,
            "Number": c.number,
            "Qty": c.quantity,
            "Market Price": f"${c.market_price:.2f}" if c.market_price is not None else "N/A",
            "Total Value": f"${c.total_value():.2f}" if c.total_value() is not None else "N/A",
            "TCGPlayer URL": c.tcgplayer_url or "",
        })
    return pd.DataFrame(rows)


def export_excel(cards: list[Card]) -> bytes:
    """Export priced cards to an Excel file and return as bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Priced Cards"

    headers = ["Name", "Number", "Qty", "Market Price", "Total Value", "TCGPlayer URL"]
    ws.append(headers)

    for c in cards:
        ws.append([
            c.name,
            c.number,
            c.quantity,
            c.market_price,
            c.total_value(),
            c.tcgplayer_url or "",
        ])

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── Session state ────────────────────────────────────────────────────────────

if "cards" not in st.session_state:
    st.session_state.cards = None
if "priced" not in st.session_state:
    st.session_state.priced = False


# ── Upload ───────────────────────────────────────────────────────────────────

uploaded_file = st.file_uploader("Upload your card spreadsheet (.xlsx)", type=["xlsx"])

if uploaded_file is not None:
    df = read_excel(uploaded_file)
    st.subheader("Preview")
    st.dataframe(df, use_container_width=True)

    # ── Column mapping ───────────────────────────────────────────────────────
    st.subheader("Map Columns")
    columns = list(df.columns)
    none_option = ["(none)"]

    col1, col2, col3 = st.columns(3)
    with col1:
        col_name = st.selectbox("Card Name *", columns, index=0)
    with col2:
        col_number = st.selectbox("Card Number", none_option + columns, index=0)
    with col3:
        col_quantity = st.selectbox("Quantity", none_option + columns, index=0)

    # Convert "(none)" selections to None
    col_number = None if col_number == "(none)" else col_number
    col_quantity = None if col_quantity == "(none)" else col_quantity

    # ── Price button ─────────────────────────────────────────────────────────
    if st.button("Price Cards", type="primary"):
        cards = cards_from_df(df, col_name, col_number, col_quantity)

        if not cards:
            st.error("No valid cards found. Check your column mapping.")
        else:
            progress_bar = st.progress(0, text="Starting...")
            status_text = st.empty()

            def on_progress(idx, total, card):
                pct = idx / total
                progress_bar.progress(pct, text=f"Looking up {idx + 1}/{total}: {card.name}")
                status_text.text(f"Searching: {card.search_query()}")

            with st.spinner("Fetching prices from TCGPlayer..."):
                price_cards(cards, progress_callback=on_progress)

            progress_bar.progress(1.0, text="Done!")
            status_text.empty()

            st.session_state.cards = cards
            st.session_state.priced = True

    # ── Results ──────────────────────────────────────────────────────────────
    if st.session_state.priced and st.session_state.cards:
        cards = st.session_state.cards
        st.subheader("Results")

        result_df = cards_to_df(cards)
        st.dataframe(
            result_df,
            use_container_width=True,
            column_config={
                "TCGPlayer URL": st.column_config.LinkColumn("TCGPlayer URL"),
            },
        )

        # Summary stats
        priced = [c for c in cards if c.market_price is not None]
        total_value = sum(c.total_value() for c in priced)
        col_a, col_b, col_c = st.columns(3)
        col_a.metric("Cards Priced", f"{len(priced)}/{len(cards)}")
        col_b.metric("Total Market Value", f"${total_value:.2f}")
        col_c.metric("Unique Cards", str(len(cards)))

        # Export
        excel_bytes = export_excel(cards)
        st.download_button(
            label="Download Results (.xlsx)",
            data=excel_bytes,
            file_name="priced_cards.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # Sticker sheet
        st.subheader("Sticker Sheet (Avery 5167)")
        show_logo = st.toggle("Include logo on stickers", value=True)
        if show_logo:
            logo_file = st.file_uploader("Upload logo (override default)", type=["png", "jpg", "jpeg"])
            if logo_file:
                logo_bytes = logo_file.read()
            elif os.path.exists("Logo.png"):
                with open("Logo.png", "rb") as f:
                    logo_bytes = f.read()
                st.caption("Using Logo.png from project folder")
            else:
                logo_bytes = None
        else:
            logo_bytes = None

        total_stickers = sticker_count(cards)
        num_sheets = (total_stickers + 79) // 80
        st.info(f"{total_stickers} sticker{'s' if total_stickers != 1 else ''}, {num_sheets} sheet{'s' if num_sheets != 1 else ''}")

        if total_stickers > 0:
            pdf_bytes = generate_sticker_pdf(cards, logo_bytes)
            st.download_button(
                label="Download Sticker Sheet (PDF)",
                data=pdf_bytes,
                file_name="sticker_sheet.pdf",
                mime="application/pdf",
            )
