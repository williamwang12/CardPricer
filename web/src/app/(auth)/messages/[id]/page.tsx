import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { isGuestEmail } from "@/lib/guards";
import {
  isParticipant,
  getOtherParticipant,
  listMessages,
  markRead,
} from "@/lib/db/messaging";
import { getProfile } from "@/lib/db/profiles";
import { publicUrl } from "@/lib/storage";
import ThreadClient from "@/components/messages/ThreadClient";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  if (isGuestEmail(email)) redirect("/messages");

  const { id } = await params;
  const conversationId = parseInt(id, 10);
  if (isNaN(conversationId)) notFound();

  if (!(await isParticipant(conversationId, email))) notFound();

  const [otherEmail, messages] = await Promise.all([
    getOtherParticipant(conversationId, email),
    listMessages(conversationId),
  ]);
  await markRead(conversationId, email);

  const otherProfile = otherEmail ? await getProfile(otherEmail) : null;

  return (
    <ThreadClient
      conversationId={conversationId}
      myEmail={email}
      other={{
        email: otherEmail,
        storeName: otherProfile?.store_name ?? null,
        avatarUrl: publicUrl("avatars", otherProfile?.avatar_path ?? null),
      }}
      initialMessages={messages}
    />
  );
}
