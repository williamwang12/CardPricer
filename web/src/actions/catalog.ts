"use server";

import { auth } from "@/lib/auth";
import { getSetCards } from "@/lib/db/catalog";
import type { CatalogCard } from "@/lib/db/catalog";

export async function getSetCardsAction(
  groupId: number
): Promise<CatalogCard[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return getSetCards(groupId);
}
