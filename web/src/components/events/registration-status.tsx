import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus, EventStatus } from "@/lib/types";

export const STATUS_LABELS: Record<RegistrationStatus, string> = {
  pending: "Pending review",
  approved: "Approved",
  waitlisted: "Waitlisted",
  rejected: "Not accepted",
  cancelled: "Cancelled",
};

const STATUS_VARIANT: Record<
  RegistrationStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  approved: "default",
  waitlisted: "outline",
  rejected: "destructive",
  cancelled: "outline",
};

export function RegistrationBadge({ status }: { status: RegistrationStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABELS[status]}</Badge>;
}

/**
 * Lifecycle badge for an event's derived status. Only renders for the
 * date-driven states worth calling out (live now / ended); other statuses
 * (published/draft/etc.) render nothing so cards stay uncluttered.
 */
export function EventLifecycleBadge({ status }: { status: EventStatus }) {
  if (status === "live") {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">
        Live now
      </Badge>
    );
  }
  if (status === "ended") {
    return <Badge variant="outline">Ended</Badge>;
  }
  return null;
}
