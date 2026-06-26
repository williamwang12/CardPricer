import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCards } from "@/lib/db/cards";
import ExportClient from "@/components/export/ExportClient";

export default async function ExportPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  const cards = await loadAllCards(email);
  return <ExportClient cards={cards} />;
}
