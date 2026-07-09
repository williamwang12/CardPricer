import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getDeadInventoryAction } from "@/actions/shows";
import DeadInventoryClient from "@/components/dead-inventory/DeadInventoryClient";

export default async function DeadInventoryPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const staleCards = await getDeadInventoryAction();

  return <DeadInventoryClient initialCards={staleCards} />;
}
