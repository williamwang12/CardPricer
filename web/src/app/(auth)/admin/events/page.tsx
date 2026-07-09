import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { listAllEvents } from "@/lib/db/events";
import AdminEventsClient from "@/components/admin/AdminEventsClient";

export default async function AdminEventsPage() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login");
  if (!isAdmin(email)) redirect("/events");

  const events = await listAllEvents();

  return <AdminEventsClient initialEvents={events} />;
}
