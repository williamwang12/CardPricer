import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  requireRealUser: vi.fn(),
  requireCanMessage: vi.fn(),
  requireConversationParticipant: vi.fn(),
  getOrCreateDirectConversation: vi.fn(),
  listMessagesSince: vi.fn(),
  sendMessage: vi.fn(),
  markRead: vi.fn(),
  getOtherParticipant: vi.fn(),
  listConversationSummaries: vi.fn(),
  unreadConversationCount: vi.fn(),
  isBlockedBetween: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
  createReport: vi.fn(),
  getProfilesByEmails: vi.fn(),
  publicUrl: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guards", () => ({
  requireRealUser: h.requireRealUser,
  requireCanMessage: h.requireCanMessage,
  requireConversationParticipant: h.requireConversationParticipant,
}));
vi.mock("@/lib/db/messaging", () => ({
  getOrCreateDirectConversation: h.getOrCreateDirectConversation,
  listMessages: vi.fn(),
  listMessagesSince: h.listMessagesSince,
  sendMessage: h.sendMessage,
  markRead: h.markRead,
  getOtherParticipant: h.getOtherParticipant,
  listConversationSummaries: h.listConversationSummaries,
  unreadConversationCount: h.unreadConversationCount,
}));
vi.mock("@/lib/db/blocks", () => ({
  isBlockedBetween: h.isBlockedBetween,
  blockUser: h.blockUser,
  unblockUser: h.unblockUser,
}));
vi.mock("@/lib/db/reports", () => ({ createReport: h.createReport }));
vi.mock("@/lib/db/profiles", () => ({ getProfilesByEmails: h.getProfilesByEmails }));
vi.mock("@/lib/storage", () => ({ publicUrl: h.publicUrl }));

import {
  startConversationAction,
  sendMessageAction,
  pollMessagesAction,
  blockUserAction,
  reportAction,
  listConversationsAction,
} from "./messaging";

beforeEach(() => {
  vi.clearAllMocks();
  h.requireRealUser.mockResolvedValue("me@x.com");
  h.requireCanMessage.mockResolvedValue("me@x.com");
  h.requireConversationParticipant.mockResolvedValue("me@x.com");
  h.getOrCreateDirectConversation.mockResolvedValue(42);
  h.getOtherParticipant.mockResolvedValue("other@x.com");
  h.isBlockedBetween.mockResolvedValue(false);
  h.sendMessage.mockResolvedValue({ id: 1, body: "hi" });
  h.publicUrl.mockReturnValue(null);
  h.getProfilesByEmails.mockResolvedValue([]);
});

describe("startConversationAction", () => {
  it("gates on requireCanMessage, then reuses/creates the thread", async () => {
    const id = await startConversationAction("other@x.com", { event_id: 3 });
    expect(h.requireCanMessage).toHaveBeenCalledWith("other@x.com");
    expect(h.getOrCreateDirectConversation).toHaveBeenCalledWith(
      "me@x.com",
      "other@x.com",
      { event_id: 3 }
    );
    expect(id).toBe(42);
  });

  it("propagates the block/shared-show rejection (can't start)", async () => {
    h.requireCanMessage.mockRejectedValue(new Error("You can only message vendors you share a show with"));
    await expect(startConversationAction("other@x.com")).rejects.toThrow(/share a show/);
    expect(h.getOrCreateDirectConversation).not.toHaveBeenCalled();
  });
});

describe("sendMessageAction", () => {
  it("requires participation, then sends", async () => {
    const msg = await sendMessageAction(42, "  hello  ");
    expect(h.requireConversationParticipant).toHaveBeenCalledWith(42);
    expect(h.sendMessage).toHaveBeenCalledWith(42, "me@x.com", "hello");
    expect(msg.id).toBe(1);
  });

  it("rejects a non-participant", async () => {
    h.requireConversationParticipant.mockRejectedValue(new Error("not a participant"));
    await expect(sendMessageAction(42, "hi")).rejects.toThrow(/not a participant/);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("rejects an empty message", async () => {
    await expect(sendMessageAction(42, "   ")).rejects.toThrow(/empty/);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it("stops sending once a block exists (post-creation)", async () => {
    h.isBlockedBetween.mockResolvedValue(true);
    await expect(sendMessageAction(42, "hi")).rejects.toThrow(/no longer message/);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });
});

describe("pollMessagesAction", () => {
  it("rejects a non-participant reading the thread", async () => {
    h.requireConversationParticipant.mockRejectedValue(new Error("not a participant"));
    await expect(pollMessagesAction(42, "2026-01-01")).rejects.toThrow(/not a participant/);
    expect(h.listMessagesSince).not.toHaveBeenCalled();
  });

  it("returns new messages for a participant", async () => {
    h.listMessagesSince.mockResolvedValue([{ id: 9 }]);
    const out = await pollMessagesAction(42, "2026-01-01");
    expect(out).toEqual([{ id: 9 }]);
  });
});

describe("moderation", () => {
  it("blockUser records the block for the caller", async () => {
    await blockUserAction("bad@x.com");
    expect(h.blockUser).toHaveBeenCalledWith("me@x.com", "bad@x.com");
  });

  it("report requires a reason", async () => {
    await expect(reportAction({ reason: "   " })).rejects.toThrow(/reason/i);
    expect(h.createReport).not.toHaveBeenCalled();
  });

  it("report records reporter + target", async () => {
    await reportAction({ reportedEmail: "bad@x.com", reason: "spam" });
    expect(h.createReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporter_email: "me@x.com", reported_email: "bad@x.com", reason: "spam" })
    );
  });
});

describe("listConversationsAction", () => {
  it("enriches summaries with the other party's store name", async () => {
    h.listConversationSummaries.mockResolvedValue([
      { conversationId: 1, otherEmail: "other@x.com", lastMessage: null, unread: 2 },
    ]);
    h.getProfilesByEmails.mockResolvedValue([
      { user_email: "other@x.com", store_name: "Their Store", avatar_path: null },
    ]);
    const out = await listConversationsAction();
    expect(out[0].otherStoreName).toBe("Their Store");
    expect(out[0].unread).toBe(2);
  });
});
