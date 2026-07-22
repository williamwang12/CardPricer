import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: mockFrom } }));

import {
  summarizeConversations,
  findDirectConversation,
} from "./messaging";
import type { Message } from "@/lib/types";

function chainable(resolveValue: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {};
  const methods = ["select", "insert", "upsert", "update", "delete", "eq", "neq", "gt", "order", "limit", "in", "single", "maybeSingle"];
  for (const m of methods) obj[m] = vi.fn().mockReturnThis();
  obj.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  return obj;
}

function msg(id: number, conv: number, sender: string, created_at: string, body = "x"): Message {
  return { id, conversation_id: conv, sender_email: sender, body, created_at };
}

beforeEach(() => vi.clearAllMocks());

describe("summarizeConversations", () => {
  const me = "me@x.com";
  const mine = [
    { conversation_id: 1, last_read_at: "2026-07-01T00:00:00Z" },
    { conversation_id: 2, last_read_at: null },
  ];
  const parts = [
    { conversation_id: 1, user_email: me },
    { conversation_id: 1, user_email: "a@x.com" },
    { conversation_id: 2, user_email: me },
    { conversation_id: 2, user_email: "b@x.com" },
  ];

  it("resolves the other participant per conversation", () => {
    const out = summarizeConversations(me, mine, parts, []);
    expect(out.find((s) => s.conversationId === 1)?.otherEmail).toBe("a@x.com");
    expect(out.find((s) => s.conversationId === 2)?.otherEmail).toBe("b@x.com");
  });

  it("counts only others' messages after last_read_at as unread", () => {
    const msgs = [
      msg(1, 1, "a@x.com", "2026-07-02T00:00:00Z"), // after read -> unread
      msg(2, 1, "a@x.com", "2026-06-30T00:00:00Z"), // before read -> read
      msg(3, 1, me, "2026-07-03T00:00:00Z"), // my own -> never unread
    ];
    const out = summarizeConversations(me, mine, parts, msgs);
    expect(out.find((s) => s.conversationId === 1)?.unread).toBe(1);
  });

  it("treats every incoming message as unread when never read (null last_read_at)", () => {
    const msgs = [
      msg(1, 2, "b@x.com", "2020-01-01T00:00:00Z"),
      msg(2, 2, "b@x.com", "2020-01-02T00:00:00Z"),
      msg(3, 2, me, "2020-01-03T00:00:00Z"), // mine, not counted
    ];
    const out = summarizeConversations(me, mine, parts, msgs);
    expect(out.find((s) => s.conversationId === 2)?.unread).toBe(2);
  });

  it("uses the chronologically last message as the preview", () => {
    const msgs = [
      msg(1, 1, "a@x.com", "2026-07-02T00:00:00Z", "first"),
      msg(2, 1, me, "2026-07-04T00:00:00Z", "latest"),
    ];
    const out = summarizeConversations(me, mine, parts, msgs);
    expect(out.find((s) => s.conversationId === 1)?.lastMessage?.body).toBe("latest");
  });

  it("sorts conversations by last message, newest first", () => {
    const msgs = [
      msg(1, 1, "a@x.com", "2026-07-02T00:00:00Z"),
      msg(2, 2, "b@x.com", "2026-07-09T00:00:00Z"),
    ];
    const out = summarizeConversations(me, mine, parts, msgs);
    expect(out.map((s) => s.conversationId)).toEqual([2, 1]);
  });
});

describe("findDirectConversation", () => {
  it("returns the conversation both users share", async () => {
    const aRows = chainable({ data: [{ conversation_id: 1 }, { conversation_id: 2 }], error: null });
    const bRows = chainable({ data: [{ conversation_id: 2 }, { conversation_id: 3 }], error: null });
    let call = 0;
    mockFrom.mockImplementation(() => (call++ === 0 ? aRows : bRows));
    expect(await findDirectConversation("a@x.com", "b@x.com")).toBe(2);
  });

  it("returns null when they share no conversation", async () => {
    const aRows = chainable({ data: [{ conversation_id: 1 }], error: null });
    const bRows = chainable({ data: [{ conversation_id: 9 }], error: null });
    let call = 0;
    mockFrom.mockImplementation(() => (call++ === 0 ? aRows : bRows));
    expect(await findDirectConversation("a@x.com", "b@x.com")).toBeNull();
  });
});
