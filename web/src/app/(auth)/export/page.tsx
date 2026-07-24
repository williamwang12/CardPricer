import { redirect } from "next/navigation";

// The Export page was renamed to Labels. Keep the old path working.
export default function ExportPage() {
  redirect("/labels");
}
