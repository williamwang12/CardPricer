import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/lib/types";
import { addCard } from "./cards";

const TABLE = "cards";
const TX_TABLE = "transactions";

async function logTransaction(
  type: "buy" | "sell",
  cardName: string,
  cardNumber: string,
  quantity: number,
  amount: number,
  userEmail: string
): Promise<void> {
  await supabase.from(TX_TABLE).insert({
    type,
    card_name: cardName,
    card_number: cardNumber,
    quantity,
    amount,
    user_email: userEmail,
  });
}

export async function getTransactions(
  userEmail: string,
  limit = 50
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from(TX_TABLE)
    .select("*")
    .eq("user_email", userEmail)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function buyCard(
  cardName: string,
  cardNumber: string,
  quantity: number,
  amount: number,
  userEmail: string
): Promise<void> {
  await addCard(
    { name: cardName, number: cardNumber, quantity },
    userEmail
  );
  await logTransaction("buy", cardName, cardNumber, quantity, amount, userEmail);
}

export async function sellCard(
  cardName: string,
  cardNumber: string,
  quantity: number,
  amount: number,
  userEmail: string
): Promise<string | null> {
  const { data } = await supabase
    .from(TABLE)
    .select("id, quantity")
    .eq("user_email", userEmail)
    .eq("name", cardName)
    .eq("number", cardNumber);

  if (!data || data.length === 0) {
    return `Card not found: ${cardName} ${cardNumber}`;
  }

  const existing = data[0];
  if (existing.quantity < quantity) {
    return `Insufficient qty: have ${existing.quantity}, tried to sell ${quantity}`;
  }

  const newQty = existing.quantity - quantity;
  if (newQty === 0) {
    await supabase.from(TABLE).delete().eq("id", existing.id);
  } else {
    await supabase.from(TABLE).update({ quantity: newQty }).eq("id", existing.id);
  }

  await logTransaction("sell", cardName, cardNumber, quantity, amount, userEmail);
  return null;
}
