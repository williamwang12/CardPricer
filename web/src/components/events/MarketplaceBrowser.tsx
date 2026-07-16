"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCurrency } from "@/components/currency-context";
import { makeOfferAction } from "@/actions/marketplace";
import type { EventListing, ListedCard } from "@/lib/types";

interface Props {
  eventId: number;
  initialListings: EventListing[];
}

interface OfferTarget {
  sellerEmail: string;
  card: ListedCard;
}

export default function MarketplaceBrowser({ eventId, initialListings }: Props) {
  const { fmt } = useCurrency();
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<OfferTarget | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const q = search.trim().toLowerCase();
  const filtered = initialListings
    .map((listing) => ({
      ...listing,
      cards: q
        ? listing.cards.filter(
            (c) =>
              c.name.toLowerCase().includes(q) || c.number.toLowerCase().includes(q)
          )
        : listing.cards,
    }))
    .filter((listing) => listing.cards.length > 0);

  const openOfferDialog = (sellerEmail: string, card: ListedCard) => {
    setTarget({ sellerEmail, card });
    setQuantity("1");
    setAmount(card.asking_price != null ? String(card.asking_price) : "");
    setMessage("");
  };

  const handleSubmitOffer = async () => {
    if (!target) return;
    const qty = parseInt(quantity, 10);
    const amt = parseFloat(amount);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!amt || amt <= 0) {
      toast.error("Enter a valid offer amount");
      return;
    }

    setSending(true);
    try {
      await makeOfferAction(
        eventId,
        target.sellerEmail,
        target.card.name,
        target.card.number,
        qty,
        amt,
        message.trim() || null
      );
      toast.success(`Offer sent for ${target.card.name}`);
      setTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send offer");
    }
    setSending(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search cards or vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border py-12 text-center">
          <p className="text-sm text-muted-foreground">
            {initialListings.length === 0
              ? "No other vendors have listed cards for this event yet."
              : "No cards match your search."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((listing) => (
            <div key={listing.id} className="rounded-lg border overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 text-sm font-medium">
                {listing.user_email}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left px-4 py-2 font-medium">Name</th>
                    <th className="text-left px-2 py-2 font-medium w-20">Number</th>
                    <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                    <th className="text-right px-2 py-2 font-medium w-24">Asking</th>
                    <th className="px-4 py-2 w-28"></th>
                  </tr>
                </thead>
                <tbody>
                  {listing.cards.map((c, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-1.5">{c.name}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{c.number || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{c.quantity}</td>
                      <td className="px-2 py-1.5 text-right font-mono">
                        {c.asking_price != null ? fmt(c.asking_price) : fmt(c.market_price)}
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openOfferDialog(listing.user_email, c)}
                        >
                          Make Offer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              {target && `${target.card.name} ${target.card.number ? `#${target.card.number}` : ""}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-qty">Quantity</Label>
                <Input
                  id="offer-qty"
                  type="number"
                  min="1"
                  max={target?.card.quantity}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="offer-amount">Total Offer</Label>
                <Input
                  id="offer-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="offer-message">Message (optional)</Label>
              <Input
                id="offer-message"
                placeholder="e.g. Can meet at your table"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
            <Button onClick={handleSubmitOffer} disabled={sending} className="w-fit">
              <Send className="h-4 w-4" />
              Send Offer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
