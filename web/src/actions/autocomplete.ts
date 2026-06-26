"use server";

import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export type CardSuggestion = {
  name: string;
  number: string;
  group_name: string;
};

export async function searchCardsAction(
  query: string
): Promise<CardSuggestion[]> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");

  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return [];

  const { data, error } = await supabase
    .from("tcg_catalog")
    .select("clean_name, number, group_name")
    .ilike("clean_name", `%${trimmed}%`)
    .limit(50);

  if (error || !data) return [];

  // Deduplicate by (clean_name, number) to collapse sub_type variants
  const seen = new Set<string>();
  const results: CardSuggestion[] = [];

  for (const row of data) {
    const key = `${row.clean_name}||${row.number ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      name: row.clean_name,
      number: row.number ?? "",
      group_name: row.group_name ?? "",
    });
    if (results.length >= 10) break;
  }

  return results;
}
