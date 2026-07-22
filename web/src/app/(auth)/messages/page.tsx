import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isGuestEmail } from "@/lib/guards";
import { listConversationsAction } from "@/actions/messaging";
import MessagesClient from "@/components/messages/MessagesClient";

export default async function MessagesPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  if (isGuestEmail(email)) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">
          Sign in with Google or Facebook to message other vendors.
        </p>
      </div>
    );
  }

  const conversations = await listConversationsAction();
  return <MessagesClient conversations={conversations} />;
}
