"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { addSuggestion } from "@/lib/db/feature-suggestions";

export async function submitSuggestionAction(
  title: string,
  description: string
) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");

  await addSuggestion(title, description, session.user.email);
  revalidatePath("/feedback");
}
