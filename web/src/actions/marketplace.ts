"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireApprovedAttendee } from "@/lib/guards";
import {
  saveListing,
  getMyListing,
  deleteListing,
  listEventListings,
} from "@/lib/db/event-listings";
import {
  createOffer,
  updateOfferStatus,
  getOffer,
  listOffersForEvent,
} from "@/lib/db/offers";
import { cardKey } from "@/lib/diff";
import type { CardOffer, EventListing, ListedCard } from "@/lib/types";

async function getUserEmail(): Promise<string> {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Not authenticated");
  return session.user.email;
}

/** Every marketplace action requires an approved registration for the event. */
async function requireAttendee(eventId: number): Promise<string> {
  return requireApprovedAttendee(eventId);
}

// ── My listing ───────────────────────────────────────────────────────────────

export async function saveListingAction(
  eventId: number,
  cards: ListedCard[]
): Promise<EventListing> {
  const email = await requireAttendee(eventId);
  const listing = await saveListing(eventId, email, cards);
  revalidatePath(`/events/${eventId}`);
  return listing;
}

export async function getMyListingAction(
  eventId: number
): Promise<EventListing | null> {
  const email = await requireAttendee(eventId);
  return getMyListing(eventId, email);
}

/** Deleting a listing also withdraws any pending offers made against it. */
export async function deleteListingAction(eventId: number): Promise<void> {
  const email = await requireAttendee(eventId);
  const { incoming } = await listOffersForEvent(eventId, email);
  await Promise.all(
    incoming
      .filter((o) => o.status === "pending")
      .map((o) => updateOfferStatus(o.id, "declined"))
  );
  await deleteListing(eventId, email);
  revalidatePath(`/events/${eventId}`);
}

// ── Browse other attendees' listings ────────────────────────────────────────

export async function browseListingsAction(
  eventId: number
): Promise<EventListing[]> {
  const email = await requireAttendee(eventId);
  const listings = await listEventListings(eventId);
  return listings.filter((l) => l.user_email !== email);
}

// ── Offers ───────────────────────────────────────────────────────────────────

export async function makeOfferAction(
  eventId: number,
  sellerEmail: string,
  cardName: string,
  cardNumber: string,
  quantity: number,
  offerAmount: number,
  message?: string | null
): Promise<CardOffer> {
  const buyerEmail = await requireAttendee(eventId);
  if (buyerEmail === sellerEmail) {
    throw new Error("You can't make an offer on your own listing");
  }
  if (quantity <= 0) throw new Error("Quantity must be greater than 0");
  if (offerAmount <= 0) throw new Error("Offer amount must be greater than 0");

  const offer = await createOffer({
    eventId,
    sellerEmail,
    buyerEmail,
    cardKey: cardKey(cardName, cardNumber),
    cardName,
    cardNumber,
    quantity,
    offerAmount,
    message,
  });
  revalidatePath(`/events/${eventId}`);
  return offer;
}

export async function acceptOfferAction(offerId: number): Promise<void> {
  const email = await getUserEmail();
  const offer = await getOffer(offerId);
  if (!offer) throw new Error("Offer not found");
  if (offer.seller_email !== email) throw new Error("Not your offer to accept");
  if (offer.status !== "pending") throw new Error("Offer is no longer pending");
  await updateOfferStatus(offerId, "accepted");
  revalidatePath(`/events/${offer.event_id}`);
}

export async function declineOfferAction(offerId: number): Promise<void> {
  const email = await getUserEmail();
  const offer = await getOffer(offerId);
  if (!offer) throw new Error("Offer not found");
  if (offer.seller_email !== email) throw new Error("Not your offer to decline");
  if (offer.status !== "pending") throw new Error("Offer is no longer pending");
  await updateOfferStatus(offerId, "declined");
  revalidatePath(`/events/${offer.event_id}`);
}

export async function withdrawOfferAction(offerId: number): Promise<void> {
  const email = await getUserEmail();
  const offer = await getOffer(offerId);
  if (!offer) throw new Error("Offer not found");
  if (offer.buyer_email !== email) throw new Error("Not your offer to withdraw");
  if (offer.status !== "pending") throw new Error("Offer is no longer pending");
  await updateOfferStatus(offerId, "withdrawn");
  revalidatePath(`/events/${offer.event_id}`);
}

export async function listMyOffersAction(
  eventId: number
): Promise<{ incoming: CardOffer[]; outgoing: CardOffer[] }> {
  const email = await getUserEmail();
  return listOffersForEvent(eventId, email);
}
