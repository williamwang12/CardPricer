"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Send, UserRound, MoreVertical, Ban, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  sendMessageAction,
  pollMessagesAction,
  blockUserAction,
  reportAction,
} from "@/actions/messaging";
import type { Message } from "@/lib/types";

interface Props {
  conversationId: number;
  myEmail: string;
  other: { email: string | null; storeName: string | null; avatarUrl: string | null };
  initialMessages: Message[];
}

const POLL_MS = 5000;

export default function ThreadClient({
  conversationId,
  myEmail,
  other,
  initialMessages,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isSending, startSend] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const otherName = other.storeName || other.email || "Vendor";

  const scrollToBottom = () =>
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Poll for new messages from the other party.
  useEffect(() => {
    const timer = setInterval(async () => {
      const last = messages[messages.length - 1];
      const since = last ? last.created_at : new Date(0).toISOString();
      try {
        const fresh = await pollMessagesAction(conversationId, since);
        if (fresh.length > 0) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...fresh.filter((m) => !seen.has(m.id))];
          });
        }
      } catch {
        /* transient; try again next tick */
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [conversationId, messages]);

  const send = () => {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    startSend(async () => {
      try {
        const saved = await sendMessageAction(conversationId, trimmed);
        setMessages((prev) =>
          prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]
        );
      } catch (err) {
        setBody(trimmed); // restore so nothing is lost
        toast.error(err instanceof Error ? err.message : "Failed to send");
      }
    });
  };

  const block = async () => {
    if (!other.email) return;
    if (!confirm(`Block ${otherName}? They won't be able to message you.`)) return;
    try {
      await blockUserAction(other.email);
      setBlocked(true);
      toast.success(`Blocked ${otherName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to block");
    }
  };

  const submitReport = async () => {
    if (!reportReason.trim()) {
      toast.error("Please describe the issue");
      return;
    }
    try {
      await reportAction({ reportedEmail: other.email, reason: reportReason });
      toast.success("Report submitted");
      setReportOpen(false);
      setReportReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to report");
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b">
        <Link href="/messages">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        {other.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={other.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover ring-1 ring-border" />
        ) : (
          <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            <UserRound className="h-4 w-4 text-muted-foreground" />
          </span>
        )}
        <div className="flex-1 min-w-0">
          {other.email ? (
            <Link href={`/vendors/${encodeURIComponent(other.email)}`} className="font-medium hover:underline truncate block">
              {otherName}
            </Link>
          ) : (
            <span className="font-medium truncate">{otherName}</span>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={block}>
              <Ban className="h-4 w-4" /> Block
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setReportOpen(true)}>
              <Flag className="h-4 w-4" /> Report
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-2">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center my-auto">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_email === myEmail;
            return (
              <div key={m.id} className={"flex " + (mine ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[75%] rounded-2xl px-3 py-1.5 text-sm " +
                    (mine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm")
                  }
                >
                  {m.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      {blocked ? (
        <div className="border-t pt-3 text-sm text-muted-foreground text-center">
          You&apos;ve blocked this vendor.
        </div>
      ) : (
        <div className="border-t pt-3 flex items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message…"
            className="flex-1 rounded-full border border-input bg-white px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button size="icon" onClick={send} disabled={isSending || !body.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report {otherName}</DialogTitle>
            <DialogDescription>
              Tell us what&apos;s wrong. Reports go to the admins.
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={3}
            placeholder="Describe the issue…"
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button onClick={submitReport} className="w-fit">Submit report</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
