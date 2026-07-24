import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadAllCardsCached } from "@/lib/db/cards";
import ExportClient from "@/components/export/ExportClient";

export default async function LabelsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  const cards = await loadAllCardsCached(email);
  return <ExportClient cards={cards} />;
}
