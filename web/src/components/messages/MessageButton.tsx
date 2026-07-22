"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/actions/messaging";

interface Props {
  otherEmail: string;
  eventId?: number;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "default" | "outline" | "ghost";
}

export default function MessageButton({
  otherEmail,
  eventId,
  label = "Message",
  size = "sm",
  variant = "outline",
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      try {
        const id = await startConversationAction(
          otherEmail,
          eventId ? { event_id: eventId, listing_owner_email: otherEmail } : {}
        );
        router.push(`/messages/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Can't message this vendor");
      }
    });

  return (
    <Button size={size} variant={variant} disabled={pending} onClick={go}>
      <MessageCircle className="h-4 w-4" />
      {label}
    </Button>
  );
}
