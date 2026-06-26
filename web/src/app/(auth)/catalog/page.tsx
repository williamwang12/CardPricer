import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllSets } from "@/lib/db/catalog";
import CatalogClient from "@/components/catalog/CatalogClient";

export default async function CatalogPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");

  const sets = await getAllSets();

  return <CatalogClient sets={sets} />;
}
