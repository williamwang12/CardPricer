"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCurrency } from "@/components/currency-context";
import {
  acceptOfferAction,
  declineOfferAction,
  withdrawOfferAction,
} from "@/actions/marketplace";
import type { CardOffer, OfferStatus } from "@/lib/types";

interface Props {
  eventId: number;
  initialOffers: { incoming: CardOffer[]; outgoing: CardOffer[] };
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusBadge({ status }: { status: OfferStatus }) {
  const variant =
    status === "accepted"
      ? "default"
      : status === "declined" || status === "withdrawn"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

export default function OffersPanel({ initialOffers }: Props) {
  const { fmt } = useCurrency();
  const [incoming, setIncoming] = useState(initialOffers.incoming);
  const [outgoing, setOutgoing] = useState(initialOffers.outgoing);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pendingIncomingCount = incoming.filter((o) => o.status === "pending").length;

  const handleAccept = async (offer: CardOffer) => {
    setBusyId(offer.id);
    try {
      await acceptOfferAction(offer.id);
      setIncoming((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, status: "accepted" } : o))
      );
      toast.success("Offer accepted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept offer");
    }
    setBusyId(null);
  };

  const handleDecline = async (offer: CardOffer) => {
    setBusyId(offer.id);
    try {
      await declineOfferAction(offer.id);
      setIncoming((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, status: "declined" } : o))
      );
      toast.success("Offer declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to decline offer");
    }
    setBusyId(null);
  };

  const handleWithdraw = async (offer: CardOffer) => {
    setBusyId(offer.id);
    try {
      await withdrawOfferAction(offer.id);
      setOutgoing((prev) =>
        prev.map((o) => (o.id === offer.id ? { ...o, status: "withdrawn" } : o))
      );
      toast.success("Offer withdrawn");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw offer");
    }
    setBusyId(null);
  };

  return (
    <Tabs defaultValue="incoming">
      <TabsList>
        <TabsTrigger value="incoming">
          Incoming
          {pendingIncomingCount > 0 && (
            <Badge className="ml-1.5 h-4 px-1" variant="destructive">
              {pendingIncomingCount}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="outgoing">Outgoing</TabsTrigger>
      </TabsList>

      <TabsContent value="incoming">
        {incoming.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No offers on your listed cards yet.
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Buyer</th>
                  <th className="text-left px-2 py-2 font-medium">Card</th>
                  <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Offer</th>
                  <th className="text-left px-2 py-2 font-medium">Message</th>
                  <th className="text-left px-2 py-2 font-medium w-24">Status</th>
                  <th className="px-4 py-2 w-40"></th>
                </tr>
              </thead>
              <tbody>
                {incoming.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-1.5">{o.buyer_email}</td>
                    <td className="px-2 py-1.5">
                      {o.card_name} {o.card_number && `#${o.card_number}`}
                    </td>
                    <td className="px-2 py-1.5 text-right">{o.quantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(o.offer_amount)}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{o.message || "—"}</td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      {o.status === "pending" && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === o.id}
                            onClick={() => handleAccept(o)}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === o.id}
                            onClick={() => handleDecline(o)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="outgoing">
        {outgoing.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            You haven&apos;t made any offers yet.
          </p>
        ) : (
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-left px-4 py-2 font-medium">Seller</th>
                  <th className="text-left px-2 py-2 font-medium">Card</th>
                  <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                  <th className="text-right px-2 py-2 font-medium w-24">Offer</th>
                  <th className="text-left px-2 py-2 font-medium w-24">Status</th>
                  <th className="text-left px-2 py-2 font-medium w-32">Sent</th>
                  <th className="px-4 py-2 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {outgoing.map((o) => (
                  <tr key={o.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-1.5">{o.seller_email}</td>
                    <td className="px-2 py-1.5">
                      {o.card_name} {o.card_number && `#${o.card_number}`}
                    </td>
                    <td className="px-2 py-1.5 text-right">{o.quantity}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{fmt(o.offer_amount)}</td>
                    <td className="px-2 py-1.5">
                      <StatusBadge status={o.status} />
                    </td>
                    <td className="px-2 py-1.5 text-muted-foreground text-xs">
                      {formatTimestamp(o.created_at)}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      {o.status === "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === o.id}
                          onClick={() => handleWithdraw(o)}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
