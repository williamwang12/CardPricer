import { supabase } from "@/lib/supabase";
import type { FeatureSuggestion } from "@/lib/types";

const TABLE = "feature_suggestions";

export async function addSuggestion(
  title: string,
  description: string,
  userEmail: string
): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    user_email: userEmail,
    title,
    description,
  });
  if (error) throw error;
}

export async function listSuggestions(): Promise<FeatureSuggestion[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
