import { listSuggestions } from "@/lib/db/feature-suggestions";
import FeedbackClient from "@/components/feedback/FeedbackClient";

export default async function FeedbackPage() {
  const suggestions = await listSuggestions();

  return <FeedbackClient initialSuggestions={suggestions} />;
}
