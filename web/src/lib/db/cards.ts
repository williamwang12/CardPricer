import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import type { Card, CardInput } from "@/lib/types";
import { normalizeName } from "@/lib/utils";

const TABLE = "cards";

// Cache tag shared by all cached reads that depend on a user's card data.
// Any function that mutates the `cards` table for a user MUST call
// `revalidateTag(cardsTag(userEmail))` after writing, or page navigations
// will keep serving stale cached data for up to the revalidate window below.
export function cardsTag(userEmail: string): string {
  return `cards:${userEmail}`;
}

export async function loadAllCards(userEmail: string): Promise<Card[]> {
  // Paginated fetch: Supabase/PostgREST caps unbounded selects at 1000 rows,
  // so without this, any user with more than 1000 cards would silently only
  // ever see/operate on their first 1000 (inventory, dashboard totals,
  // snapshots, price refresh, etc. all rely on this function).
  const PAGE = 1000;
  const rows: Card[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("user_email", userEmail)
      .order("name")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // Overlay live prices from tcg_catalog for non-manual-price cards.
  // The sync-catalog cron keeps tcg_catalog current daily from tcgcsv;
  // reading prices directly from the catalog (rather than a copy stored on
  // cards.market_price) ensures they are always fresh.
  const urlToIndices = new Map<string, number[]>();
  for (let i = 0; i < rows.length; i++) {
    const card = rows[i];
    if (!card.manual_price && card.tcgplayer_url) {
      const indices = urlToIndices.get(card.tcgplayer_url) ?? [];
      indices.push(i);
      urlToIndices.set(card.tcgplayer_url, indices);
    }
  }

  const urls = [...urlToIndices.keys()];
  const BATCH = 100;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const { data: catalogRows } = await supabase
      .from("tcg_catalog")
      .select("url, market_price, sub_type_name")
      .in("url", batch);

    if (catalogRows) {
      // Group catalog rows by URL, then pick best variant per URL
      const byUrl = new Map<string, typeof catalogRows>();
      for (const row of catalogRows) {
        const group = byUrl.get(row.url) ?? [];
        group.push(row);
        byUrl.set(row.url, group);
      }

      for (const [url, variants] of byUrl) {
        // Holofoil > Normal > first row (same logic as pickBestVariant)
        const best =
          variants.find((r) => r.sub_type_name === "Holofoil") ??
          variants.find((r) => r.sub_type_name === "Normal") ??
          variants[0];

        const price =
          best.market_price != null
            ? Math.round(Number(best.market_price) * 100) / 100
            : null;

        const indices = urlToIndices.get(url);
        if (indices) {
          for (const idx of indices) {
            rows[idx] = { ...rows[idx], market_price: price };
          }
        }
      }
    }
  }

  return rows;
}

// Cached wrapper for page reads (Dashboard, Inventory, Export, Transactions,
// etc.) — avoids re-querying Supabase on every navigation. Cached for up to
// 60s and invalidated immediately whenever cards change via revalidateTag.
export async function loadAllCardsCached(userEmail: string): Promise<Card[]> {
  return unstable_cache(
    () => loadAllCards(userEmail),
    ["load-all-cards", userEmail],
    { tags: [cardsTag(userEmail)], revalidate: 60 }
  )();
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
  const name = normalizeName(card.name);

  // Check for existing card with same name+number for this user
  const { data: existing } = await supabase
    .from(TABLE)
    .select("id, quantity")
    .eq("user_email", userEmail)
    .eq("name", name)
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
        name,
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
