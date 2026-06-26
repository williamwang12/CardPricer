"use server";

import { auth } from "@/lib/auth";
import { massageNames, rollbackImport } from "@/lib/db/cards";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

export async function massageNamesAction() {
  const email = await getUserEmail();
  return massageNames(email);
}

export async function rollbackImportAction(
  imported: { name: string; number: string; quantity: number }[]
) {
  const email = await getUserEmail();
  return rollbackImport(imported, email);
}
