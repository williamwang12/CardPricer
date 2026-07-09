import { supabase } from "@/lib/supabase";
import type { Card, CardInput } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

const TABLE = "cards";

export async function loadAllCards(userEmail: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_email", userEmail)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function cardCount(userEmail: string): Promise<number> {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_email", userEmail);
  if (error) throw error;
  return count ?? 0;
}

export async function addCard(card: CardInput, userEmail: string): Promise<void> {
  // Check for existing card with same name+number for this user
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id, quantity")
    .eq("user_email", userEmail)
    .eq("name", card.name)
    .eq("number", card.number);

  if (existing && existing.length > 0) {
    const row = existing[0];
    const updates: Record<string, unknown> = {
      quantity: row.quantity + card.quantity,
    };
    if (card.tcgplayer_url) updates.tcgplayer_url = card.tcgplayer_url;
    if (card.market_price != null) updates.market_price = card.market_price;
    if (card.cost_basis != null) updates.cost_basis = card.cost_basis;
    await supabase.from(TABLE).update(updates).eq("id", row.id);
  } else {
    await supabase.from(TABLE).upsert(
      {
        name: card.name,
        number: card.number,
        quantity: card.quantity,
        market_price: card.market_price ?? null,
        cost_basis: card.cost_basis ?? null,
        tcgplayer_url: card.tcgplayer_url ?? null,
        manual_price: card.manual_price ?? false,
        user_email: userEmail,
      },
      { onConflict: "name,number,user_email" }
    );
  }
}

export async function updateCard(
  cardId: number,
  fields: Record<string, unknown>
): Promise<void> {
  await supabase.from(TABLE).update(fields).eq("id", cardId);
}

export async function updatePrices(
  cards: { id: number; market_price: number | null; tcgplayer_url: string | null }[]
): Promise<void> {
  for (const card of cards) {
    await supabase
      .from(TABLE)
      .update({
        market_price: card.market_price,
        tcgplayer_url: card.tcgplayer_url,
      })
      .eq("id", card.id);
  }
}

export async function deleteCards(cardIds: number[]): Promise<void> {
  for (const id of cardIds) {
    await supabase.from(TABLE).delete().eq("id", id);
  }
}

export async function replaceAllCards(
  cards: CardInput[],
  userEmail: string
): Promise<number> {
  await supabase.from(TABLE).delete().eq("user_email", userEmail);
  if (cards.length === 0) return 0;
  const rows = cards.map((c) => ({
    name: c.name,
    number: c.number,
    quantity: c.quantity,
    market_price: c.market_price ?? null,
    cost_basis: c.cost_basis ?? null,
    tcgplayer_url: c.tcgplayer_url ?? null,
    manual_price: c.manual_price ?? false,
    user_email: userEmail,
  }));
  await supabase.from(TABLE).insert(rows);
  return rows.length;
}

export async function saveEdits(
  editedRows: Record<string, Record<string, unknown>>,
  deletedIndices: number[],
  originalCards: Card[]
): Promise<{ updated: number; deleted: number }> {
  let numUpdated = 0;
  let numDeleted = 0;

  const colToField: Record<string, string> = {
    Name: "name",
    Number: "number",
    Qty: "quantity",
    Cost: "cost_basis",
    Manual: "manual_price",
  };

  for (const [idxStr, changes] of Object.entries(editedRows)) {
    const idx = parseInt(idxStr, 10);
    if (idx >= originalCards.length) continue;
    const card = originalCards[idx];
    if (!card.id) continue;

    // qty=0 -> delete
    const newQty = changes.Qty;
    if (newQty != null && Number(newQty) <= 0) {
      await deleteCards([card.id]);
      numDeleted++;
      continue;
    }

    const updates: Record<string, unknown> = {};
    for (const [col, field] of Object.entries(colToField)) {
      if (col in changes) {
        const val = changes[col];
        if (col === "Qty") updates[field] = Number(val);
        else if (col === "Cost") updates[field] = val == null || val === "" ? null : Number(val);
        else if (col === "Manual") updates[field] = Boolean(val);
        else updates[field] = String(val).trim();
      }
    }

    if (Object.keys(updates).length > 0) {
      await updateCard(card.id, updates);
      numUpdated++;
    }
  }

  const idsToDelete = deletedIndices
    .filter((idx) => idx < originalCards.length && originalCards[idx].id)
    .map((idx) => originalCards[idx].id);
  if (idsToDelete.length > 0) {
    await deleteCards(idsToDelete);
    numDeleted += idsToDelete.length;
  }

  return { updated: numUpdated, deleted: numDeleted };
}

export async function massageNames(userEmail: string): Promise<number> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, name")
    .eq("user_email", userEmail);
  if (error) throw error;

  let count = 0;
  for (const row of data ?? []) {
    const newName = normalizeName(row.name);
    if (newName !== row.name) {
      await supabase.from(TABLE).update({ name: newName }).eq("id", row.id);
      count++;
    }
  }
  return count;
}

export async function rollbackImport(
  imported: { name: string; number: string; quantity: number }[],
  userEmail: string
): Promise<number> {
  let count = 0;
  for (const item of imported) {
    const { data } = await supabase
      .from(TABLE)
      .select("id, quantity")
      .eq("user_email", userEmail)
      .eq("name", item.name)
      .eq("number", item.number);

    if (!data || data.length === 0) continue;
    const existing = data[0];
    const newQty = existing.quantity - item.quantity;
    if (newQty <= 0) {
      await supabase.from(TABLE).delete().eq("id", existing.id);
    } else {
      await supabase.from(TABLE).update({ quantity: newQty }).eq("id", existing.id);
    }
    count++;
  }
  return count;
}
