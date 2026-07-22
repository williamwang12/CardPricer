import { supabase } from "@/lib/supabase";
import type { Conversation, Message } from "@/lib/types";

// ── Conversations ────────────────────────────────────────────────────────────

export interface ConversationContext {
  event_id?: number | null;
  listing_owner_email?: string | null;
}

/**
 * The direct (1:1) conversation between two users, or null. Only 1:1
 * conversations are ever created, so any conversation both users belong to is
 * their direct thread.
 */
export async function findDirectConversation(
  a: string,
  b: string
): Promise<number | null> {
  const [ra, rb] = await Promise.all([
    supabase.from("conversation_participants").select("conversation_id").eq("user_email", a),
    supabase.from("conversation_participants").select("conversation_id").eq("user_email", b),
  ]);
  if (ra.error) throw ra.error;
  if (rb.error) throw rb.error;
  const bIds = new Set((rb.data ?? []).map((r) => r.conversation_id));
  for (const r of ra.data ?? []) {
    if (bIds.has(r.conversation_id)) return r.conversation_id;
  }
  return null;
}

export async function createDirectConversation(
  a: string,
  b: string,
  ctx: ConversationContext = {}
): Promise<number> {
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      event_id: ctx.event_id ?? null,
      listing_owner_email: ctx.listing_owner_email ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = data.id as number;
  const { error: pErr } = await supabase.from("conversation_participants").insert([
    { conversation_id: id, user_email: a },
    { conversation_id: id, user_email: b },
  ]);
  if (pErr) throw pErr;
  return id;
}

/** Idempotent: reuse the existing direct thread or create one. */
export async function getOrCreateDirectConversation(
  a: string,
  b: string,
  ctx: ConversationContext = {}
): Promise<number> {
  const existing = await findDirectConversation(a, b);
  if (existing != null) return existing;
  return createDirectConversation(a, b, ctx);
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Conversation | null;
}

export async function isParticipant(
  conversationId: number,
  email: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("user_email")
    .eq("conversation_id", conversationId)
    .eq("user_email", email)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function getOtherParticipant(
  conversationId: number,
  email: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversation_participants")
    .select("user_email")
    .eq("conversation_id", conversationId)
    .neq("user_email", email);
  if (error) throw error;
  return data?.[0]?.user_email ?? null;
}

// ── Messages ─────────────────────────────────────────────────────────────────

/** The most recent `limit` messages, in chronological (ascending) order. */
export async function listMessages(
  conversationId: number,
  limit = 100
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as Message[]).reverse();
}

/** New messages since a timestamp — the polling query. */
export async function listMessagesSince(
  conversationId: number,
  sinceIso: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .gt("created_at", sinceIso)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Message[];
}

export async function sendMessage(
  conversationId: number,
  senderEmail: string,
  body: string
): Promise<Message> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_email: senderEmail, body })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markRead(
  conversationId: number,
  email: string
): Promise<void> {
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_email", email);
  if (error) throw error;
}

// ── Inbox summaries + unread ─────────────────────────────────────────────────

export interface RawConversationSummary {
  conversationId: number;
  otherEmail: string | null;
  lastMessage: Message | null;
  unread: number;
}

/**
 * Pure aggregation for the inbox: given the viewer's participant rows, ALL
 * participant rows for those conversations, and their messages (ascending by
 * created_at), produce one summary per conversation — the other party, last
 * message, and unread count — newest first.
 *
 * Unread = messages from someone else with `created_at` strictly after the
 * viewer's `last_read_at` (or all of them, if never read).
 */
export function summarizeConversations(
  email: string,
  mine: { conversation_id: number; last_read_at: string | null }[],
  parts: { conversation_id: number; user_email: string }[],
  msgs: Message[]
): RawConversationSummary[] {
  const convIds = mine.map((r) => r.conversation_id);
  const lastReadByConv = new Map(
    mine.map((r) => [r.conversation_id, r.last_read_at])
  );

  const otherByConv = new Map<number, string>();
  for (const p of parts) {
    if (p.user_email !== email) otherByConv.set(p.conversation_id, p.user_email);
  }

  const lastByConv = new Map<number, Message>();
  const unreadByConv = new Map<number, number>();
  for (const m of msgs) {
    lastByConv.set(m.conversation_id, m); // ascending → last write wins
    const lr = lastReadByConv.get(m.conversation_id);
    if (m.sender_email !== email && (!lr || m.created_at > lr)) {
      unreadByConv.set(
        m.conversation_id,
        (unreadByConv.get(m.conversation_id) ?? 0) + 1
      );
    }
  }

  return convIds
    .map((id) => ({
      conversationId: id,
      otherEmail: otherByConv.get(id) ?? null,
      lastMessage: lastByConv.get(id) ?? null,
      unread: unreadByConv.get(id) ?? 0,
    }))
    .sort((a, b) =>
      (b.lastMessage?.created_at ?? "").localeCompare(
        a.lastMessage?.created_at ?? ""
      )
    );
}

/**
 * One row per conversation the user is in: the other participant, the last
 * message, and how many messages are unread for this user. Newest first.
 */
export async function listConversationSummaries(
  email: string
): Promise<RawConversationSummary[]> {
  const { data: mine, error } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_email", email);
  if (error) throw error;
  const rows = (mine ?? []) as {
    conversation_id: number;
    last_read_at: string | null;
  }[];
  if (rows.length === 0) return [];
  const convIds = rows.map((r) => r.conversation_id);

  const [partsRes, msgsRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, user_email")
      .in("conversation_id", convIds),
    supabase
      .from("messages")
      .select("*")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true }),
  ]);
  if (partsRes.error) throw partsRes.error;
  if (msgsRes.error) throw msgsRes.error;

  return summarizeConversations(
    email,
    rows,
    (partsRes.data ?? []) as { conversation_id: number; user_email: string }[],
    (msgsRes.data ?? []) as Message[]
  );
}

/** Number of conversations with at least one unread message — the nav badge. */
export async function unreadConversationCount(email: string): Promise<number> {
  const summaries = await listConversationSummaries(email);
  return summaries.filter((s) => s.unread > 0).length;
}
