import io
import os
from typing import Optional

import streamlit as st
import openpyxl
import pandas as pd

from models import Card
from scraper import price_cards, search_tcgplayer
from stickers import generate_sticker_pdf, sticker_count, labels_per_page, LABEL_FORMATS
from db import (
    load_all_cards,
    add_card,
    replace_all_cards,
    update_prices,
    save_edits,
    delete_cards,
    seed_from_excel,
    card_count,
    buy_card,
    sell_card,
    get_transactions,
)

st.set_page_config(page_title="Pokemon Card Inventory", layout="wide")

# ── Password gate ────────────────────────────────────────────────────────────

def check_password() -> bool:
    """Show a login form and return True if the password is correct."""
    if st.session_state.get("authenticated"):
        return True

    st.title("Pokemon Card Inventory")
    password = st.text_input("Password", type="password", key="login_pw")
    if st.button("Log in", type="primary"):
        if password == st.secrets.get("APP_PASSWORD", ""):
            st.session_state.authenticated = True
            st.rerun()
        else:
            st.error("Incorrect password.")
    return False

if not check_password():
    st.stop()

st.title("Pokemon Card Inventory")
st.caption("Track your collection, update prices from TCGPlayer, and export.")


# ── Helpers ──────────────────────────────────────────────────────────────────


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

        number = ""
        if col_number and pd.notna(row.get(col_number)):
            raw = row[col_number]
            if isinstance(raw, float) and raw == int(raw):
                number = str(int(raw))
            else:
                number = str(raw).strip()

        quantity = 1
        if col_quantity and pd.notna(row.get(col_quantity)):
            try:
                quantity = int(row[col_quantity])
            except (ValueError, TypeError):
                quantity = 1

        cards.append(Card(name=name, number=number, quantity=quantity))
    return cards


def export_excel(cards: list[Card]) -> bytes:
    """Export cards to an Excel file and return as bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Inventory"

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


# ── Seed DB on first boot ────────────────────────────────────────────────────

if "seeded" not in st.session_state:
    n = seed_from_excel("ExistingInventory.xlsx")
    if n > 0:
        st.toast(f"Imported {n} cards from ExistingInventory.xlsx")
    st.session_state.seeded = True


# ── Load inventory ───────────────────────────────────────────────────────────

cards = load_all_cards()


# ── Stats bar ────────────────────────────────────────────────────────────────

priced = [c for c in cards if c.market_price is not None]
total_qty = sum(c.quantity for c in cards)
total_value = sum(c.total_value() for c in priced)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Unique Cards", len(cards))
c2.metric("Total Cards", total_qty)
c3.metric("Priced", f"{len(priced)}/{len(cards)}")
c4.metric("Total Value", f"${total_value:.2f}")


# ── Log Transaction ──────────────────────────────────────────────────────────

with st.expander("Log Transaction"):
    if "tx_form_key" not in st.session_state:
        st.session_state.tx_form_key = 0
    tk = st.session_state.tx_form_key

    tx_type = st.radio("Type", ["Buy", "Sell"], horizontal=True, key=f"tx_type_{tk}")

    tc1, tc2, tc3, tc4 = st.columns([3, 2, 1, 1])
    with tc1:
        tx_name = st.text_input("Card Name *", key=f"tx_name_{tk}")
    with tc2:
        tx_number = st.text_input("Card Number", key=f"tx_number_{tk}")
    with tc3:
        tx_qty = st.number_input("Qty", min_value=1, value=1, step=1, key=f"tx_qty_{tk}")
    with tc4:
        tx_amount = st.number_input("Amount ($)", min_value=0.0, value=0.0, step=0.01,
                                     format="%.2f", key=f"tx_amount_{tk}")

    if st.button("Log Transaction", type="primary"):
        if tx_name.strip():
            if tx_type == "Buy":
                buy_card(tx_name.strip(), tx_number.strip(), tx_qty, round(tx_amount, 2))
                st.toast(f"Logged buy: {tx_qty}x {tx_name.strip()}")
                st.session_state.tx_form_key += 1
                st.rerun()
            else:
                err = sell_card(tx_name.strip(), tx_number.strip(), tx_qty, round(tx_amount, 2))
                if err:
                    st.error(err)
                else:
                    st.toast(f"Logged sale: {tx_qty}x {tx_name.strip()}")
                    st.session_state.tx_form_key += 1
                    st.rerun()
        else:
            st.error("Card name is required.")

    # Recent transactions table
    recent_tx = get_transactions(limit=20)
    if recent_tx:
        st.subheader("Recent Transactions")
        tx_df = pd.DataFrame(recent_tx)
        tx_df = tx_df[["created_at", "type", "card_name", "card_number", "quantity", "amount"]]
        tx_df.columns = ["Date", "Type", "Card Name", "Number", "Qty", "Amount"]
        tx_df["Date"] = pd.to_datetime(tx_df["Date"]).dt.strftime("%Y-%m-%d %H:%M")
        tx_df["Type"] = tx_df["Type"].str.capitalize()
        tx_df["Amount"] = tx_df["Amount"].apply(lambda x: f"${x:.2f}")

        def style_tx(row):
            color = "#ccffcc" if row["Type"] == "Buy" else "#ffcccc"
            return [f"background-color: {color}"] * len(row)

        styled_tx = tx_df.style.apply(style_tx, axis=1)
        st.dataframe(styled_tx, use_container_width=True, hide_index=True)


# ── Add Cards ────────────────────────────────────────────────────────────────

with st.expander("Add Cards"):
    tab_manual, tab_csv, tab_decktradr, tab_excel = st.tabs(["Manual", "TCGPlayer CSV", "DeckTradr CSV", "Excel Import"])

    with tab_manual:
        # Track checked price and form reset counter
        if "checked_price" not in st.session_state:
            st.session_state.checked_price = None
            st.session_state.checked_url = None
        if "add_form_key" not in st.session_state:
            st.session_state.add_form_key = 0

        fk = st.session_state.add_form_key
        fc1, fc2, fc3, fc4 = st.columns([3, 2, 1, 1])
        with fc1:
            new_name = st.text_input("Card Name *", key=f"new_name_{fk}")
        with fc2:
            new_number = st.text_input("Card Number", key=f"new_number_{fk}")
        with fc3:
            new_qty = st.number_input("Qty", min_value=1, value=1, step=1, key=f"new_qty_{fk}")
        with fc4:
            manual_price = st.number_input("Manual Price ($)", min_value=0.0, value=0.0, step=0.01,
                                           format="%.2f", key=f"manual_price_{fk}")

        # Action row: buttons
        bc1, bc2, bc3, _ = st.columns([1, 1, 1, 4])
        with bc1:
            do_check = st.button("Check Price")
        with bc2:
            do_check_and_add = st.button("Check & Add")
        with bc3:
            do_add = st.button("Add Card", type="primary")

        if do_check:
            if new_name.strip():
                test_card = Card(name=new_name.strip(), number=new_number.strip())
                with st.spinner(f"Looking up {test_card.name}..."):
                    price, url = search_tcgplayer(test_card)
                st.session_state.checked_price = price
                st.session_state.checked_url = url if price is not None else None
                if price is not None:
                    st.success(f"**{test_card.name}** — ${price:.2f}  [{url}]({url})" if url else f"**{test_card.name}** — ${price:.2f}")
                else:
                    st.warning(f"No match found for **{test_card.name}** {test_card.number}")
            else:
                st.error("Enter a card name first.")

        # Show checkbox to include checked price (only after a successful check)
        include_checked = False
        if st.session_state.checked_price is not None:
            include_checked = st.checkbox(
                f"Include TCGPlayer price (${st.session_state.checked_price:.2f})",
                value=True, key=f"include_price_{fk}",
            )

        if do_check_and_add:
            if new_name.strip():
                test_card = Card(name=new_name.strip(), number=new_number.strip())
                with st.spinner(f"Looking up {test_card.name}..."):
                    price, url = search_tcgplayer(test_card)
                if price is None:
                    url = None

                is_manual = manual_price > 0
                final_price = round(manual_price, 2) if is_manual else price

                card = Card(
                    name=new_name.strip(),
                    number=new_number.strip(),
                    quantity=new_qty,
                    market_price=final_price,
                    tcgplayer_url=url,
                    manual_price=is_manual,
                )
                add_card(card)
                price_str = f" (${final_price:.2f})" if final_price else ""
                st.toast(f"Added {new_name.strip()}{price_str}")
                st.session_state.checked_price = None
                st.session_state.checked_url = None
                st.session_state.add_form_key += 1
                st.rerun()
            else:
                st.error("Card name is required.")

        if do_add:
            if new_name.strip():
                # Determine price: manual override > checked price > None
                price = None
                url = st.session_state.checked_url  # always include link if we checked
                is_manual = False
                if manual_price > 0:
                    price = round(manual_price, 2)
                    is_manual = True
                elif include_checked:
                    price = st.session_state.checked_price
                else:
                    url = None  # no check was done or user unchecked — no link either

                card = Card(
                    name=new_name.strip(),
                    number=new_number.strip(),
                    quantity=new_qty,
                    market_price=price,
                    tcgplayer_url=url,
                    manual_price=is_manual,
                )
                add_card(card)
                st.toast(f"Added {new_name.strip()}")
                st.session_state.checked_price = None
                st.session_state.checked_url = None
                st.session_state.add_form_key += 1
                st.rerun()
            else:
                st.error("Card name is required.")

    with tab_csv:
        if "csv_form_key" not in st.session_state:
            st.session_state.csv_form_key = 0
        ck = st.session_state.csv_form_key

        csv_file = st.file_uploader("Upload TCGPlayer CSV", type=["csv"], key=f"import_csv_{ck}")
        if csv_file is not None:
            csv_df = pd.read_csv(csv_file)
            st.dataframe(csv_df, use_container_width=True, height=200)

            if st.button("Add to Collection", type="primary", key=f"csv_add_{ck}"):
                csv_cards = []
                for _, row in csv_df.iterrows():
                    raw_name = str(row.get("Product Name", "")).strip()
                    if not raw_name:
                        continue
                    # Strip number suffix like "Galvantula ex - 168/142" → "Galvantula ex"
                    name = raw_name.rsplit(" - ", 1)[0].strip() if " - " in raw_name else raw_name

                    number = ""
                    if "Number" in csv_df.columns and pd.notna(row.get("Number")):
                        raw = row["Number"]
                        if isinstance(raw, float) and raw == int(raw):
                            number = str(int(raw))
                        else:
                            number = str(raw).strip()

                    price = None
                    if "TCG Market Price" in csv_df.columns and pd.notna(row.get("TCG Market Price")):
                        try:
                            price = round(float(row["TCG Market Price"]), 2)
                        except (ValueError, TypeError):
                            pass

                    csv_cards.append(Card(name=name, number=number, quantity=1, market_price=price))

                if csv_cards:
                    progress_bar = st.progress(0, text="Looking up cards...")
                    total = len(csv_cards)
                    for i, c in enumerate(csv_cards):
                        progress_bar.progress((i + 1) / total, text=f"Looking up {i + 1}/{total}: {c.name}")
                        _, url = search_tcgplayer(c)
                        c.tcgplayer_url = url
                        add_card(c)
                    progress_bar.progress(1.0, text="Done!")
                    st.session_state.csv_form_key += 1
                    st.session_state.csv_success = len(csv_cards)
                    st.rerun()
                else:
                    st.error("No valid cards found in CSV.")

        # Show success message after rerun
        if st.session_state.get("csv_success"):
            st.success(f"Successfully added {st.session_state.csv_success} cards to collection!")
            st.balloons()
            del st.session_state.csv_success

    with tab_decktradr:
        if "decktradr_form_key" not in st.session_state:
            st.session_state.decktradr_form_key = 0
        dk = st.session_state.decktradr_form_key

        dt_file = st.file_uploader("Upload DeckTradr CSV", type=["csv"], key=f"import_decktradr_{dk}")
        if dt_file is not None:
            dt_df = pd.read_csv(dt_file)

            preview = dt_df[["Card Name", "Number", "Quantity"]].head(50).copy()
            for col in ["Card Name", "Number"]:
                preview[col] = preview[col].astype(str).str.replace('"', '', regex=False).str.strip()
            st.dataframe(preview, use_container_width=True, height=200)

            if st.button("Add to Collection", type="primary", key=f"decktradr_add_{dk}"):
                dt_cards = []
                for _, row in dt_df.iterrows():
                    name = str(row.get("Card Name", "")).replace('"', '').strip()
                    if not name:
                        continue

                    number = ""
                    if pd.notna(row.get("Number")):
                        number = str(row["Number"]).replace('"', '').strip()

                    quantity = 1
                    if pd.notna(row.get("Quantity")):
                        try:
                            quantity = int(row["Quantity"])
                        except (ValueError, TypeError):
                            quantity = 1

                    dt_cards.append(Card(name=name, number=number, quantity=quantity))

                if dt_cards:
                    progress_bar = st.progress(0, text="Looking up cards...")
                    total = len(dt_cards)
                    for i, c in enumerate(dt_cards):
                        progress_bar.progress((i + 1) / total, text=f"Looking up {i + 1}/{total}: {c.name}")
                        _, url = search_tcgplayer(c)
                        c.tcgplayer_url = url
                        add_card(c)
                    progress_bar.progress(1.0, text="Done!")
                    st.session_state.decktradr_form_key += 1
                    st.session_state.decktradr_success = len(dt_cards)
                    st.rerun()
                else:
                    st.error("No valid cards found in CSV.")

        if st.session_state.get("decktradr_success"):
            st.success(f"Successfully added {st.session_state.decktradr_success} cards to collection!")
            st.balloons()
            del st.session_state.decktradr_success

    with tab_excel:
        uploaded = st.file_uploader("Upload spreadsheet (.xlsx)", type=["xlsx"], key="import_xlsx")
        if uploaded is not None:
            df = pd.read_excel(uploaded, engine="openpyxl")
            st.dataframe(df, use_container_width=True, height=200)

            columns = list(df.columns)
            none_option = ["(none)"]
            columns_lower = [c.lower() for c in columns]

            def _guess_index(keywords, option_list, fallback=0):
                for kw in keywords:
                    for i, col in enumerate(columns_lower):
                        if kw == col:
                            return i + (len(option_list) - len(columns))
                return fallback

            name_default = _guess_index(["name", "card name", "card"], columns, 0)
            number_default = _guess_index(["number", "card number", "no.", "num"], none_option + columns, 0)
            qty_default = _guess_index(["quantity", "qty", "count"], none_option + columns, 0)

            mc1, mc2, mc3 = st.columns(3)
            with mc1:
                col_name = st.selectbox("Card Name *", columns, index=name_default, key="imp_name")
            with mc2:
                col_number = st.selectbox("Card Number", none_option + columns, index=number_default, key="imp_num")
            with mc3:
                col_quantity = st.selectbox("Quantity", none_option + columns, index=qty_default, key="imp_qty")

            col_number = None if col_number == "(none)" else col_number
            col_quantity = None if col_quantity == "(none)" else col_quantity

            if st.button("Replace Inventory", type="primary"):
                import_cards = cards_from_df(df, col_name, col_number, col_quantity)
                if not import_cards:
                    st.error("No valid cards found. Check your column mapping.")
                else:
                    count = replace_all_cards(import_cards)
                    st.toast(f"Replaced inventory with {count} cards")
                    st.rerun()


# ── Inventory ────────────────────────────────────────────────────────────────

st.subheader("Inventory")

if cards:
    # Build DataFrame for the data editor with a Delete checkbox
    editor_data = []
    for c in cards:
        editor_data.append({
            "Delete": False,
            "Name": c.name,
            "Number": c.number,
            "Qty": c.quantity,
            "Manual": c.manual_price,
            "Market Price": c.market_price,
            "Total Value": c.total_value(),
            "TCGPlayer URL": c.tcgplayer_url or "",
        })
    editor_df = pd.DataFrame(editor_data)

    edited = st.data_editor(
        editor_df,
        use_container_width=True,
        disabled=["Market Price", "Total Value", "TCGPlayer URL"],
        column_config={
            "Delete": st.column_config.CheckboxColumn("Delete", default=False),
            "Name": st.column_config.TextColumn("Name"),
            "Number": st.column_config.TextColumn("Number"),
            "Qty": st.column_config.NumberColumn("Qty", min_value=0, step=1),
            "Manual": st.column_config.CheckboxColumn("Manual", help="Manual price — won't be overwritten by Reprice All"),
            "Market Price": st.column_config.NumberColumn("Market Price", format="$%.2f"),
            "Total Value": st.column_config.NumberColumn("Total Value", format="$%.2f"),
            "TCGPlayer URL": st.column_config.LinkColumn("TCGPlayer URL"),
        },
        column_order=["Delete", "Name", "Number", "Qty", "Manual", "Market Price", "Total Value", "TCGPlayer URL"],
        key="inventory_editor",
    )

    editor_state = st.session_state.get("inventory_editor", {})
    edited_rows = editor_state.get("edited_rows", {})

    # Collect rows marked for deletion via the Delete checkbox
    delete_indices = []
    for idx_str, changes in edited_rows.items():
        if changes.get("Delete") is True:
            delete_indices.append(int(idx_str))

    # Filter out Delete column from edited_rows for save_edits
    field_edits = {}
    for idx_str, changes in edited_rows.items():
        real_changes = {k: v for k, v in changes.items() if k != "Delete"}
        if real_changes:
            field_edits[idx_str] = real_changes

    has_changes = bool(field_edits) or bool(delete_indices)

    if st.button("Save Changes", type="primary", disabled=not has_changes):
        num_updated, num_deleted = save_edits(field_edits, delete_indices, cards)
        parts = []
        if num_updated:
            parts.append(f"{num_updated} updated")
        if num_deleted:
            parts.append(f"{num_deleted} deleted")
        st.toast("Saved: " + ", ".join(parts) if parts else "No changes")
        st.rerun()

    st.divider()

    # Reprice All (skip manually priced cards)
    auto_cards = [c for c in cards if not c.manual_price]
    manual_count = len(cards) - len(auto_cards)
    label = "Reprice All"
    if manual_count:
        label += f" ({manual_count} manual skipped)"

    rp1, rp2 = st.columns([1, 3])
    with rp1:
        do_reprice = st.button(label)
    with rp2:
        price_alert_threshold = st.number_input(
            "Price alert threshold ($)", min_value=0.0, value=1.0, step=0.50,
            format="%.2f", key="price_alert_threshold",
        )

    if do_reprice:
        if auto_cards:
            # Save old prices for comparison
            old_prices = {c.id: c.market_price for c in auto_cards}

            progress_bar = st.progress(0, text="Starting...")
            status_text = st.empty()

            def on_progress(idx, total, card):
                pct = idx / total
                progress_bar.progress(pct, text=f"Looking up {idx + 1}/{total}: {card.name}")
                status_text.text(f"Searching: {card.search_query()}")

            with st.spinner("Fetching prices from TCGPlayer..."):
                price_cards(auto_cards, progress_callback=on_progress)

            progress_bar.progress(1.0, text="Done!")
            status_text.empty()

            update_prices(auto_cards)

            # Find cards with significant price movement
            movers = []
            for c in auto_cards:
                old = old_prices.get(c.id)
                new = c.market_price
                if old is not None and new is not None:
                    diff = new - old
                    if abs(diff) >= price_alert_threshold:
                        movers.append({"Name": c.name, "Number": c.number,
                                       "Old Price": old, "New Price": new,
                                       "Change": diff})

            st.session_state.price_movers = movers
            st.toast(f"Repriced {len(auto_cards)} cards!")
        else:
            st.toast("All cards have manual prices — nothing to reprice.")
        st.rerun()

    # Show price movement alerts after reprice
    if st.session_state.get("price_movers"):
        movers = st.session_state.price_movers
        st.subheader(f"Price Alerts ({len(movers)} cards)")

        movers_df = pd.DataFrame(movers)

        def highlight_movers(row):
            if row["Change"] > 0:
                return ["background-color: #ffcccc"] * len(row)  # red = price went up
            else:
                return ["background-color: #ccffcc"] * len(row)  # green = price went down

        styled = movers_df.style.apply(highlight_movers, axis=1).format({
            "Old Price": "${:.2f}",
            "New Price": "${:.2f}",
            "Change": "${:+.2f}",
        })
        st.dataframe(styled, use_container_width=True)
        del st.session_state.price_movers

else:
    st.info("No cards in inventory. Add some above!")


# ── Export ───────────────────────────────────────────────────────────────────

if cards:
    with st.expander("Export"):
        # Excel download
        excel_bytes = export_excel(cards)
        st.download_button(
            label="Download Inventory (.xlsx)",
            data=excel_bytes,
            file_name="inventory.xlsx",
            mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        # Sticker sheet
        st.subheader("Sticker Sheet")
        format_options = {key: spec["label"] for key, spec in LABEL_FORMATS.items()}
        selected_format = st.selectbox(
            "Label format",
            options=list(format_options.keys()),
            format_func=lambda k: format_options[k],
        )

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
        per_page = labels_per_page(selected_format)
        num_sheets = (total_stickers + per_page - 1) // per_page if total_stickers > 0 else 0
        st.info(f"{total_stickers} sticker{'s' if total_stickers != 1 else ''}, "
                f"{num_sheets} sheet{'s' if num_sheets != 1 else ''}")

        if total_stickers > 0:
            pdf_bytes = generate_sticker_pdf(cards, logo_bytes, label_format=selected_format)
            st.download_button(
                label="Download Sticker Sheet (PDF)",
                data=pdf_bytes,
                file_name="sticker_sheet.pdf",
                mime="application/pdf",
            )
