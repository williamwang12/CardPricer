"""Database layer — all Supabase interactions isolated here."""

from __future__ import annotations

import os
import re
from typing import Optional

import streamlit as st
import pandas as pd
from supabase import create_client, Client

from models import Card

TABLE = "cards"
TX_TABLE = "transactions"


# ── Client ────────────────────────────────────────────────────────────────────


@st.cache_resource
def _get_client() -> Client:
    """Return a cached Supabase client using Streamlit secrets."""
    s = st.secrets
    # Support both flat and nested secret formats
    if "SUPABASE_URL" in s:
        return create_client(s["SUPABASE_URL"], s["SUPABASE_KEY"])
    cfg = s["connections"]["supabase"]
    return create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_KEY"])


# ── Helpers ───────────────────────────────────────────────────────────────────


def _row_to_card(row: dict) -> Card:
    return Card(
        name=row["name"],
        number=row.get("number", ""),
        quantity=row.get("quantity", 1),
        market_price=row.get("market_price"),
        tcgplayer_url=row.get("tcgplayer_url"),
        manual_price=row.get("manual_price", False),
        id=row["id"],
    )


# ── Reads ─────────────────────────────────────────────────────────────────────


def load_all_cards() -> list[Card]:
    """SELECT all cards, ordered by name."""
    sb = _get_client()
    resp = sb.table(TABLE).select("*").order("name").execute()
    return [_row_to_card(r) for r in resp.data]


def card_count() -> int:
    """Return total number of rows (for checking if DB is empty)."""
    sb = _get_client()
    resp = sb.table(TABLE).select("id", count="exact").execute()
    return resp.count or 0


# ── Writes ────────────────────────────────────────────────────────────────────


def add_card(card: Card) -> None:
    """Upsert a single card. If name+number already exists, increment qty."""
    sb = _get_client()
    # Check for existing card with same name+number
    resp = (
        sb.table(TABLE)
        .select("id, quantity")
        .eq("name", card.name)
        .eq("number", card.number)
        .execute()
    )
    if resp.data:
        existing = resp.data[0]
        updates = {"quantity": existing["quantity"] + card.quantity}
        if card.tcgplayer_url:
            updates["tcgplayer_url"] = card.tcgplayer_url
        if card.market_price is not None:
            updates["market_price"] = card.market_price
        sb.table(TABLE).update(updates).eq("id", existing["id"]).execute()
    else:
        sb.table(TABLE).insert({
            "name": card.name,
            "number": card.number,
            "quantity": card.quantity,
            "market_price": card.market_price,
            "tcgplayer_url": card.tcgplayer_url,
            "manual_price": card.manual_price,
        }).execute()


def add_cards_bulk(cards: list[Card]) -> int:
    """Insert/upsert a list of cards. Returns count added."""
    count = 0
    for card in cards:
        add_card(card)
        count += 1
    return count


def update_card(card_id: int, **fields) -> None:
    """Update specific fields on a card by ID."""
    sb = _get_client()
    sb.table(TABLE).update(fields).eq("id", card_id).execute()


def update_prices(cards: list[Card]) -> None:
    """Batch update market_price + tcgplayer_url after repricing."""
    sb = _get_client()
    for card in cards:
        if card.id is not None:
            sb.table(TABLE).update({
                "market_price": card.market_price,
                "tcgplayer_url": card.tcgplayer_url,
            }).eq("id", card.id).execute()


def delete_cards(card_ids: list[int]) -> None:
    """Delete cards by ID list."""
    sb = _get_client()
    for cid in card_ids:
        sb.table(TABLE).delete().eq("id", cid).execute()


def replace_all_cards(cards: list[Card]) -> int:
    """Delete entire inventory and insert new cards. Returns count inserted."""
    sb = _get_client()
    sb.table(TABLE).delete().neq("id", 0).execute()
    rows = [
        {
            "name": c.name,
            "number": c.number,
            "quantity": c.quantity,
            "market_price": c.market_price,
            "tcgplayer_url": c.tcgplayer_url,
            "manual_price": c.manual_price,
        }
        for c in cards
    ]
    if rows:
        sb.table(TABLE).insert(rows).execute()
    return len(rows)


def save_edits(
    edited_rows: dict,
    deleted_indices: list[int],
    original_cards: list[Card],
) -> tuple[int, int]:
    """Apply st.data_editor diffs to DB.

    edited_rows: {row_index: {col_name: new_value}} from data_editor
    deleted_indices: [row_index, ...] from data_editor
    original_cards: the cards list the editor was built from

    Returns (num_updated, num_deleted).
    """
    num_updated = 0
    num_deleted = 0

    # Handle edits (qty, name, number, manual_price changes)
    col_to_field = {"Name": "name", "Number": "number", "Qty": "quantity", "Manual": "manual_price"}
    for idx_str, changes in edited_rows.items():
        idx = int(idx_str)
        if idx >= len(original_cards):
            continue
        card = original_cards[idx]
        if card.id is None:
            continue

        # Check for qty=0 → delete
        new_qty = changes.get("Qty")
        if new_qty is not None and int(new_qty) <= 0:
            delete_cards([card.id])
            num_deleted += 1
            continue

        # Build update dict from changed fields
        updates = {}
        for col, field in col_to_field.items():
            if col in changes:
                val = changes[col]
                if col == "Qty":
                    updates[field] = int(val)
                elif col == "Manual":
                    updates[field] = bool(val)
                else:
                    updates[field] = str(val).strip()

        if updates:
            update_card(card.id, **updates)
            num_updated += 1

    # Handle row deletions
    ids_to_delete = []
    for idx in deleted_indices:
        if idx < len(original_cards) and original_cards[idx].id is not None:
            ids_to_delete.append(original_cards[idx].id)
    if ids_to_delete:
        delete_cards(ids_to_delete)
        num_deleted += len(ids_to_delete)

    return num_updated, num_deleted


def seed_from_excel(filepath: str) -> int:
    """If DB is empty, import cards from an Excel file. Returns count imported."""
    if card_count() > 0:
        return 0
    if not os.path.exists(filepath):
        return 0

    df = pd.read_excel(filepath, engine="openpyxl")
    cols_lower = {c.lower(): c for c in df.columns}

    # Find columns
    col_name = cols_lower.get("name") or cols_lower.get("card name")
    col_number = cols_lower.get("number") or cols_lower.get("card number")
    col_qty = cols_lower.get("quantity") or cols_lower.get("qty")

    if col_name is None:
        return 0

    cards = []
    for _, row in df.iterrows():
        name = str(row[col_name]).strip() if pd.notna(row[col_name]) else ""
        if not name:
            continue

        number = ""
        if col_number and pd.notna(row.get(col_number)):
            raw = row[col_number]
            # Handle float numbers like 107.0 → "107"
            if isinstance(raw, float) and raw == int(raw):
                number = str(int(raw))
            else:
                number = str(raw).strip()

        quantity = 1
        if col_qty and pd.notna(row.get(col_qty)):
            try:
                quantity = int(row[col_qty])
            except (ValueError, TypeError):
                quantity = 1

        cards.append(Card(name=name, number=number, quantity=quantity))

    return add_cards_bulk(cards)


# ── Transactions ─────────────────────────────────────────────────────────────


def log_transaction(
    tx_type: str, card_name: str, card_number: str, quantity: int, amount: float
) -> None:
    """Insert a row into the transactions table."""
    sb = _get_client()
    sb.table(TX_TABLE).insert({
        "type": tx_type,
        "card_name": card_name,
        "card_number": card_number,
        "quantity": quantity,
        "amount": amount,
    }).execute()


def get_transactions(limit: int = 50) -> list[dict]:
    """Return recent transactions ordered by created_at DESC."""
    sb = _get_client()
    resp = (
        sb.table(TX_TABLE)
        .select("*")
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return resp.data


def buy_card(card_name: str, card_number: str, quantity: int, amount: float) -> None:
    """Add/increment card in inventory and log a buy transaction."""
    add_card(Card(name=card_name, number=card_number, quantity=quantity))
    log_transaction("buy", card_name, card_number, quantity, amount)


def sell_card(card_name: str, card_number: str, quantity: int, amount: float) -> str | None:
    """Decrement card qty (delete if 0) and log a sell transaction.

    Returns an error message string if the sale can't be completed, else None.
    """
    sb = _get_client()
    resp = (
        sb.table(TABLE)
        .select("id, quantity")
        .eq("name", card_name)
        .eq("number", card_number)
        .execute()
    )
    if not resp.data:
        return f"Card not found: {card_name} {card_number}"

    existing = resp.data[0]
    if existing["quantity"] < quantity:
        return f"Insufficient qty: have {existing['quantity']}, tried to sell {quantity}"

    new_qty = existing["quantity"] - quantity
    if new_qty == 0:
        sb.table(TABLE).delete().eq("id", existing["id"]).execute()
    else:
        sb.table(TABLE).update({"quantity": new_qty}).eq("id", existing["id"]).execute()

    log_transaction("sell", card_name, card_number, quantity, amount)
    return None


def rollback_import(imported: list[dict]) -> int:
    """Reverse a CSV import by decrementing qty (or deleting) each card.

    imported: list of {"name": str, "number": str, "quantity": int}
    Returns count of cards affected.
    """
    sb = _get_client()
    count = 0
    for item in imported:
        resp = (
            sb.table(TABLE)
            .select("id, quantity")
            .eq("name", item["name"])
            .eq("number", item["number"])
            .execute()
        )
        if not resp.data:
            continue
        existing = resp.data[0]
        new_qty = existing["quantity"] - item["quantity"]
        if new_qty <= 0:
            sb.table(TABLE).delete().eq("id", existing["id"]).execute()
        else:
            sb.table(TABLE).update({"quantity": new_qty}).eq("id", existing["id"]).execute()
        count += 1
    return count


_UPPERCASE_KEYWORDS = re.compile(r'\b(ex|vstar|vmax)\b', re.IGNORECASE)


def _normalize_name(name: str) -> str:
    """Title-case a card name, then uppercase EX/VSTAR/VMAX."""
    name = name.title()
    name = _UPPERCASE_KEYWORDS.sub(lambda m: m.group().upper(), name)
    return name


def massage_names() -> int:
    """Normalize all card names in the DB. Returns count updated."""
    sb = _get_client()
    resp = sb.table(TABLE).select("id, name").execute()
    count = 0
    for row in resp.data:
        new_name = _normalize_name(row["name"])
        if new_name != row["name"]:
            sb.table(TABLE).update({"name": new_name}).eq("id", row["id"]).execute()
            count += 1
    return count
