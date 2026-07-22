"use client";

import Link from "next/link";
import { UserRound, MessagesSquare } from "lucide-react";
import type { ConversationSummary } from "@/lib/types";

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function MessagesClient({
  conversations,
}: {
  conversations: ConversationSummary[];
}) {
  return (
    <div className="max-w-2xl">
      <h1 className="font-heading text-xl font-semibold mb-4">Messages</h1>

      {conversations.length === 0 ? (
        <div className="rounded-lg border py-12 text-center flex flex-col items-center gap-2">
          <MessagesSquare className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No conversations yet. Message a vendor from a show directory or their profile.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {conversations.map((c) => (
            <Link
              key={c.conversationId}
              href={`/messages/${c.conversationId}`}
              className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
            >
              {c.otherAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.otherAvatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover ring-1 ring-border flex-shrink-0"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      "truncate " + (c.unread > 0 ? "font-semibold" : "font-medium")
                    }
                  >
                    {c.otherStoreName || c.otherEmail || "Unknown vendor"}
                  </span>
                  {c.lastMessage && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {timeAgo(c.lastMessage.created_at)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={
                      "text-sm truncate " +
                      (c.unread > 0 ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {c.lastMessage?.body ?? "No messages yet"}
                  </span>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
