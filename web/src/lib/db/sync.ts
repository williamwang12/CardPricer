import { supabase } from "@/lib/supabase";
import type { CardInput } from "@/lib/types";
import { loadAllCards } from "./cards";

const TABLE = "cards";

export async function syncCollectr(
  collectrCards: CardInput[],
  userEmail: string,
  addOnly = false
): Promise<{ matched: number; added: number; removed: number }> {
  const existing = await loadAllCards(userEmail);

  // Merge duplicate Collectr rows (same name+number, different grade)
  const merged = new Map<string, CardInput>();
  for (const cc of collectrCards) {
    const key = `${cc.name.toLowerCase()}\0${cc.number}`;
    const prev = merged.get(key);
    if (prev) {
      prev.quantity += cc.quantity;
    } else {
      merged.set(key, { ...cc });
    }
  }

  // Build lookup
  const existingLookup = new Map<string, (typeof existing)[0]>();
  for (const c of existing) {
    existingLookup.set(`${c.name.toLowerCase()}\0${c.number}`, c);
  }

  const matchedIds = new Set<number>();
  let matched = 0;
  let added = 0;

  for (const [key, cc] of merged) {
    const ex = existingLookup.get(key);
    if (ex && ex.id) {
      const updates: Record<string, unknown> = { quantity: cc.quantity };
      if (ex.market_price == null && cc.market_price != null) {
        updates.market_price = cc.market_price;
      }
      await supabase.from(TABLE).update(updates).eq("id", ex.id);
      matchedIds.add(ex.id);
      matched++;
    } else {
      const { error } = await supabase.from(TABLE).upsert(
        {
          name: cc.name,
          number: cc.number,
          quantity: cc.quantity,
          market_price: cc.market_price ?? null,
          user_email: userEmail,
        },
        { onConflict: "name,number,user_email" }
      );
      if (!error) {
        added++;
      }
    }
  }

  let removed = 0;
  if (!addOnly) {
    for (const c of existing) {
      if (c.id && !matchedIds.has(c.id)) {
        await supabase.from(TABLE).delete().eq("id", c.id);
        removed++;
      }
    }
  }

  return { matched, added, removed };
}
