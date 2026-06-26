"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { syncCollectr } from "@/lib/db/sync";
import type { CardInput } from "@/lib/types";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export async function syncCollectrAction(
  cards: CardInput[],
  addOnly: boolean
) {
  const email = await getUserEmail();
  const result = await syncCollectr(cards, email, addOnly);
  revalidatePath("/inventory");
  return result;
}
