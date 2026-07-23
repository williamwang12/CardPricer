"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, MapPin, Users, Save, Trash2, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCurrency } from "@/components/currency-context";
import { applyToEventAction, cancelRegistrationAction } from "@/actions/events";
import { saveListingAction, deleteListingAction } from "@/actions/marketplace";
import MarketplaceBrowser from "@/components/events/MarketplaceBrowser";
import OffersPanel from "@/components/events/OffersPanel";
import OrganizerPanel from "@/components/events/OrganizerPanel";
import VendorDirectory from "@/components/events/VendorDirectory";
import { RegistrationBadge, STATUS_LABELS } from "@/components/events/registration-status";
import type {
  Event,
  EventAttendee,
  EventListing,
  ListedCard,
  ListingVisibility,
  DirectoryVendor,
  Card,
  CardOffer,
  VenueType,
  RegistrationStatus,
} from "@/lib/types";

const VENUE_LABELS: Record<VenueType, string> = {
  collector_show: "Collector Show",
  mall_show: "Mall Show",
  tcg_tournament: "TCG Tournament",
  convention: "Convention",
  online: "Online",
  other: "Other",
};

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface Props {
  event: Event;
  registration: EventAttendee | null;
  approvedCount: number;
  canManage: boolean;
  registrations: EventAttendee[];
  myListing: EventListing | null;
  myCards: Card[];
  otherListings: EventListing[];
  directory: DirectoryVendor[];
  initialOffers: { incoming: CardOffer[]; outgoing: CardOffer[] };
}

export default function EventDetailClient({
  event,
  registration,
  approvedCount,
  canManage,
  registrations,
  myListing,
  myCards,
  otherListings,
  directory,
  initialOffers,
}: Props) {
  const { fmt } = useCurrency();
  // An active registration is anything not cancelled.
  const activeStatus =
    registration && registration.status !== "cancelled"
      ? registration.status
      : null;
  const [status, setStatus] = useState<RegistrationStatus | null>(activeStatus);
  const approved = status === "approved";
  const [applyNote, setApplyNote] = useState("");
  const [rsvpBusy, setRsvpBusy] = useState(false);

  // Listing editor state: card key -> { selected, askingPrice }
  const initialSelection = new Map(
    (myListing?.cards ?? []).map((c) => [
      `${c.name.toLowerCase()}|${c.number}`,
      c.asking_price,
    ])
  );
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelection.keys())
  );
  const [askingPrices, setAskingPrices] = useState<Record<string, string>>(
    Object.fromEntries(
      [...initialSelection.entries()].map(([k, v]) => [k, v != null ? String(v) : ""])
    )
  );
  const [featured, setFeatured] = useState<Set<string>>(
    new Set(
      (myListing?.cards ?? [])
        .filter((c) => c.is_featured)
        .map((c) => `${c.name.toLowerCase()}|${c.number}`)
    )
  );
  const [visibility, setVisibility] = useState<ListingVisibility>(
    myListing?.visibility ?? "show_vendors"
  );
  const [savingListing, setSavingListing] = useState(false);

  const apply = async () => {
    setRsvpBusy(true);
    try {
      const reg = await applyToEventAction(event.id, applyNote.trim() || null);
      setStatus(reg.status);
      setApplyNote("");
      toast.success("Application submitted, pending review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply");
    }
    setRsvpBusy(false);
  };

  const withdraw = async () => {
    if (
      !confirm(
        "Withdraw from this show? This removes your listing and offers for it."
      )
    )
      return;
    setRsvpBusy(true);
    try {
      await cancelRegistrationAction(event.id);
      setStatus(null);
      toast.success("Withdrawn from show");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to withdraw");
    }
    setRsvpBusy(false);
  };

  const cardKeyOf = (c: Card) => `${c.name.toLowerCase()}|${c.number}`;

  const toggleCard = (c: Card) => {
    const key = cardKeyOf(c);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleFeatured = (c: Card) => {
    const key = cardKeyOf(c);
    setFeatured((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSaveListing = async () => {
    const cards: ListedCard[] = myCards
      .filter((c) => selected.has(cardKeyOf(c)))
      .map((c) => {
        const key = cardKeyOf(c);
        const asking = askingPrices[key];
        return {
          name: c.name,
          number: c.number,
          quantity: c.quantity,
          market_price: c.market_price,
          asking_price: asking ? parseFloat(asking) : null,
          is_featured: featured.has(key),
        };
      });

    if (cards.length === 0) {
      toast.error("Select at least one card to list");
      return;
    }

    setSavingListing(true);
    try {
      await saveListingAction(event.id, cards, visibility);
      toast.success(`Listing saved (${cards.length} cards)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save listing");
    }
    setSavingListing(false);
  };

  const handleDeleteListing = async () => {
    if (!confirm("Remove your entire listing for this event?")) return;
    try {
      await deleteListingAction(event.id);
      setSelected(new Set());
      setAskingPrices({});
      toast.success("Listing removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove listing");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/events">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-col gap-0.5 flex-1">
          <h1 className="font-heading text-xl font-semibold">{event.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(event.date)}
              {event.date_end && ` – ${formatDate(event.date_end)}`}
            </span>
            {event.venue_name && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {event.venue_name}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {approvedCount} approved
            </span>
            <Badge variant="outline">{VENUE_LABELS[event.venue_type]}</Badge>
            {status && <RegistrationBadge status={status} />}
          </div>
        </div>
        {/* Vendors apply/withdraw; organizers manage instead of applying. */}
        {!canManage &&
          (status === "pending" || status === "waitlisted" || status === "approved" ? (
            <Button variant="outline" disabled={rsvpBusy} onClick={withdraw}>
              Withdraw
            </Button>
          ) : null)}
      </div>

      {event.description && (
        <p className="text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          {event.description}
        </p>
      )}

      {canManage ? (
        <OrganizerPanel
          eventId={event.id}
          vendorCapacity={event.vendor_capacity}
          initialRegistrations={registrations}
        />
      ) : !approved ? (
        <div className="rounded-lg border p-6 flex flex-col items-center gap-3 text-center">
          {status ? (
            <p className="text-sm text-muted-foreground">
              Your application is <strong>{STATUS_LABELS[status].toLowerCase()}</strong>.
              {status === "pending" &&
                " The organizer will review it. You'll get showcase access once approved."}
              {status === "waitlisted" &&
                " You'll get access if a spot opens up."}
              {status === "rejected" &&
                " You can apply again if you'd like."}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Apply to sell at this show to build a showcase and browse other
                vendors&apos; showcases once approved.
              </p>
              <textarea
                value={applyNote}
                onChange={(e) => setApplyNote(e.target.value)}
                placeholder="Optional note to the organizer (what you're bringing, booth needs…)"
                rows={2}
                className="w-full max-w-md rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </>
          )}
          {(!status || status === "rejected") && (
            <Button disabled={rsvpBusy} onClick={apply}>
              Apply to sell
            </Button>
          )}
        </div>
      ) : (
        <Tabs defaultValue="listing">
          <TabsList>
            <TabsTrigger value="listing">My Listing</TabsTrigger>
            <TabsTrigger value="vendors">
              <Store className="h-3.5 w-3.5" />
              Vendors ({directory.length})
            </TabsTrigger>
            <TabsTrigger value="browse">Browse Marketplace</TabsTrigger>
            <TabsTrigger value="offers">
              Offers
              {initialOffers.incoming.filter((o) => o.status === "pending").length > 0 && (
                <Badge className="ml-1.5 h-4 px-1" variant="destructive">
                  {initialOffers.incoming.filter((o) => o.status === "pending").length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="listing" className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Select which cards from your inventory you&apos;re bringing to this show.
              Only approved vendors at this show can see your listing.
            </p>
            {myCards.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No cards in your inventory yet.
              </p>
            ) : (
              <div className="rounded-lg border overflow-x-auto max-h-[28rem] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b text-muted-foreground">
                      <th className="w-10 px-4 py-2"></th>
                      <th className="text-left px-2 py-2 font-medium">Name</th>
                      <th className="text-left px-2 py-2 font-medium w-20">Number</th>
                      <th className="text-right px-2 py-2 font-medium w-16">Qty</th>
                      <th className="text-right px-2 py-2 font-medium w-24">Market</th>
                      <th className="text-right px-4 py-2 font-medium w-28">Asking Price</th>
                      <th className="text-center px-2 py-2 font-medium w-16">Feature</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myCards.map((c) => {
                      const key = cardKeyOf(c);
                      const isSelected = selected.has(key);
                      return (
                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                          <td className="px-4 py-1.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCard(c)}
                            />
                          </td>
                          <td className="px-2 py-1.5">{c.name}</td>
                          <td className="px-2 py-1.5 text-muted-foreground">{c.number || "—"}</td>
                          <td className="px-2 py-1.5 text-right">{c.quantity}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">
                            {fmt(c.market_price)}
                          </td>
                          <td className="px-4 py-1.5 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              placeholder={c.market_price != null ? String(c.market_price) : "0.00"}
                              disabled={!isSelected}
                              value={askingPrices[key] ?? ""}
                              onChange={(e) =>
                                setAskingPrices((prev) => ({ ...prev, [key]: e.target.value }))
                              }
                              className="h-8 w-24 ml-auto text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              disabled={!isSelected}
                              onClick={() => toggleFeatured(c)}
                              className="disabled:opacity-30"
                              title="Feature this card in your showcase"
                            >
                              <Star
                                className={
                                  "h-4 w-4 mx-auto " +
                                  (featured.has(key)
                                    ? "fill-current text-amber-500"
                                    : "text-muted-foreground")
                                }
                              />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={handleSaveListing} disabled={savingListing}>
                <Save className="h-4 w-4" />
                {myListing ? "Update Listing" : "Publish Listing"}
              </Button>
              {myListing && (
                <Button size="sm" variant="outline" onClick={handleDeleteListing}>
                  <Trash2 className="h-4 w-4" />
                  Remove Listing
                </Button>
              )}
              <label className="flex items-center gap-2 text-sm text-muted-foreground ml-auto">
                Visibility
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as ListingVisibility)}
                  className="h-8 rounded-md border border-input bg-white px-2 text-sm"
                >
                  <option value="show_vendors">Visible to show vendors</option>
                  <option value="hidden">Hidden</option>
                </select>
              </label>
            </div>
          </TabsContent>

          <TabsContent value="vendors">
            <VendorDirectory vendors={directory} eventId={event.id} />
          </TabsContent>

          <TabsContent value="browse">
            <MarketplaceBrowser
              eventId={event.id}
              initialListings={otherListings}
              vendorNames={Object.fromEntries(
                directory
                  .filter((d) => d.storeName)
                  .map((d) => [d.email, d.storeName as string])
              )}
            />
          </TabsContent>

          <TabsContent value="offers">
            <OffersPanel eventId={event.id} initialOffers={initialOffers} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
