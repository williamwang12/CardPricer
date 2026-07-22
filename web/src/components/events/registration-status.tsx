import { Badge } from "@/components/ui/badge";
import type { RegistrationStatus } from "@/lib/types";

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
