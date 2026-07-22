"use server";

import { revalidatePath } from "next/cache";
import {
  requireRealUser,
  requireCanMessage,
  requireConversationParticipant,
} from "@/lib/guards";
import {
  getOrCreateDirectConversation,
  listMessagesSince,
  sendMessage,
  markRead,
  getOtherParticipant,
  listConversationSummaries,
  unreadConversationCount,
  type ConversationContext,
} from "@/lib/db/messaging";
import { blockUser, unblockUser, isBlockedBetween } from "@/lib/db/blocks";
import { createReport } from "@/lib/db/reports";
import { getProfilesByEmails } from "@/lib/db/profiles";
import { publicUrl } from "@/lib/storage";
import type { ConversationSummary, Message } from "@/lib/types";

/**
 * Open (or reuse) a direct conversation with another vendor. Enforces the
 * shared-approved-show + not-blocked rule. Returns the conversation id.
 */
export async function startConversationAction(
  otherEmail: string,
  ctx: ConversationContext = {}
): Promise<number> {
  const me = await requireCanMessage(otherEmail);
  const id = await getOrCreateDirectConversation(me, otherEmail, ctx);
  revalidatePath("/messages");
  return id;
}

/** The caller's inbox, enriched with the other party's profile. */
export async function listConversationsAction(): Promise<ConversationSummary[]> {
  const me = await requireRealUser();
  const raw = await listConversationSummaries(me);
  const emails = raw.map((r) => r.otherEmail).filter(Boolean) as string[];
  const profiles = await getProfilesByEmails(emails);
  const byEmail = new Map(profiles.map((p) => [p.user_email, p]));
  return raw.map((r) => {
    const p = r.otherEmail ? byEmail.get(r.otherEmail) : undefined;
    return {
      ...r,
      otherStoreName: p?.store_name ?? null,
      otherAvatarUrl: publicUrl("avatars", p?.avatar_path ?? null),
    };
  });
}

/** Poll for messages newer than a timestamp (client refresh). */
export async function pollMessagesAction(
  conversationId: number,
  sinceIso: string
): Promise<Message[]> {
  await requireConversationParticipant(conversationId);
  return listMessagesSince(conversationId, sinceIso);
}

export async function sendMessageAction(
  conversationId: number,
  body: string
): Promise<Message> {
  const me = await requireConversationParticipant(conversationId);
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  // A block placed after the conversation started still stops new messages.
  const other = await getOtherParticipant(conversationId, me);
  if (other && (await isBlockedBetween(me, other))) {
    throw new Error("You can no longer message this vendor");
  }
  const message = await sendMessage(conversationId, me, trimmed);
  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  return message;
}

export async function markReadAction(conversationId: number): Promise<void> {
  const me = await requireConversationParticipant(conversationId);
  await markRead(conversationId, me);
  revalidatePath("/messages");
}

/** Number of conversations with unread messages — for the nav badge. */
export async function unreadCountAction(): Promise<number> {
  const me = await requireRealUser();
  return unreadConversationCount(me);
}

// ── Moderation ───────────────────────────────────────────────────────────────

export async function blockUserAction(otherEmail: string): Promise<void> {
  const me = await requireRealUser();
  await blockUser(me, otherEmail);
  revalidatePath("/messages");
}

export async function unblockUserAction(otherEmail: string): Promise<void> {
  const me = await requireRealUser();
  await unblockUser(me, otherEmail);
  revalidatePath("/messages");
}

export async function reportAction(input: {
  reportedEmail?: string | null;
  reportedMessageId?: number | null;
  reason: string;
}): Promise<void> {
  const me = await requireRealUser();
  if (!input.reason.trim()) throw new Error("A reason is required");
  await createReport({
    reporter_email: me,
    reported_email: input.reportedEmail ?? null,
    reported_message_id: input.reportedMessageId ?? null,
    reason: input.reason.trim(),
  });
}
