"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, X, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reviewRegistrationAction } from "@/actions/events";
import { RegistrationBadge } from "@/components/events/registration-status";
import type { EventAttendee, RegistrationStatus } from "@/lib/types";

interface Props {
  eventId: number;
  vendorCapacity: number | null;
  initialRegistrations: EventAttendee[];
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default function OrganizerPanel({
  eventId,
  vendorCapacity,
  initialRegistrations,
}: Props) {
  const [regs, setRegs] = useState<EventAttendee[]>(initialRegistrations);
  const [booths, setBooths] = useState<Record<string, string>>(
    Object.fromEntries(
      initialRegistrations.map((r) => [r.user_email, r.booth_label ?? ""])
    )
  );
  const [busy, setBusy] = useState<string | null>(null);

  const counts = regs.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<RegistrationStatus, number>
  );

  const review = async (
    vendorEmail: string,
    status: RegistrationStatus
  ) => {
    setBusy(vendorEmail);
    try {
      await reviewRegistrationAction(eventId, vendorEmail, {
        status,
        booth_label: booths[vendorEmail]?.trim() || null,
      });
      setRegs((prev) =>
        prev.map((r) =>
          r.user_email === vendorEmail
            ? { ...r, status, booth_label: booths[vendorEmail]?.trim() || null }
            : r
        )
      );
      toast.success(`${vendorEmail} → ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
    setBusy(null);
  };

  // Pending first, then the rest.
  const ordered = [...regs].sort((a, b) => {
    const rank = (s: RegistrationStatus) => (s === "pending" ? 0 : 1);
    return rank(a.status) - rank(b.status);
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label={vendorCapacity != null ? `Approved / ${vendorCapacity}` : "Approved"}
          value={counts.approved ?? 0}
        />
        <StatCard label="Pending" value={counts.pending ?? 0} />
        <StatCard label="Waitlisted" value={counts.waitlisted ?? 0} />
        <StatCard label="Rejected" value={counts.rejected ?? 0} />
      </div>

      <div className="flex items-center gap-2 text-sm font-medium">
        <ListChecks className="h-4 w-4" />
        Applications
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No applications yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {ordered.map((r) => (
            <div
              key={r.user_email}
              className="rounded-lg border p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{r.user_email}</span>
                <RegistrationBadge status={r.status} />
              </div>
              {r.vendor_notes && (
                <p className="text-sm text-muted-foreground">{r.vendor_notes}</p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={booths[r.user_email] ?? ""}
                  placeholder="Booth label"
                  onChange={(e) =>
                    setBooths((prev) => ({ ...prev, [r.user_email]: e.target.value }))
                  }
                  className="h-8 w-32"
                />
                <Button
                  size="sm"
                  disabled={busy === r.user_email || r.status === "approved"}
                  onClick={() => review(r.user_email, "approved")}
                >
                  <Check className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.user_email || r.status === "waitlisted"}
                  onClick={() => review(r.user_email, "waitlisted")}
                >
                  <Clock className="h-4 w-4" />
                  Waitlist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.user_email || r.status === "rejected"}
                  onClick={() => review(r.user_email, "rejected")}
                >
                  <X className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
