"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { buyCard, sellCard } from "@/lib/db/transactions";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export async function logBuyAction(
  cardName: string,
  cardNumber: string,
  quantity: number,
  amount: number
) {
  const email = await getUserEmail();
  await buyCard(cardName, cardNumber, quantity, amount, email);
  revalidatePath("/inventory");
  revalidatePath("/transactions");
}

export async function logSellAction(
  cardName: string,
  cardNumber: string,
  quantity: number,
  amount: number
): Promise<string | null> {
  const email = await getUserEmail();
  const err = await sellCard(cardName, cardNumber, quantity, amount, email);
  if (!err) {
    revalidatePath("/inventory");
    revalidatePath("/transactions");
  }
  return err;
}
