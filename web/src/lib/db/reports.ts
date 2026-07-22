import { supabase } from "@/lib/supabase";

const TABLE = "reports";

export interface ReportInput {
  reporter_email: string;
  reported_email?: string | null;
  reported_message_id?: number | null;
  reason: string;
}

export async function createReport(input: ReportInput): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({
    reporter_email: input.reporter_email,
    reported_email: input.reported_email ?? null,
    reported_message_id: input.reported_message_id ?? null,
    reason: input.reason,
  });
  if (error) throw error;
}
