import { supabase } from "@/lib/supabase";
import type { CardOffer, OfferStatus } from "@/lib/types";

const TABLE = "card_offers";

export interface CreateOfferInput {
  eventId: number;
  sellerEmail: string;
  buyerEmail: string;
  cardKey: string;
  cardName: string;
  cardNumber: string;
  quantity: number;
  offerAmount: number;
  message?: string | null;
}

export async function createOffer(input: CreateOfferInput): Promise<CardOffer> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      event_id: input.eventId,
      seller_email: input.sellerEmail,
      buyer_email: input.buyerEmail,
      card_key: input.cardKey,
      card_name: input.cardName,
      card_number: input.cardNumber,
      quantity: input.quantity,
      offer_amount: input.offerAmount,
      message: input.message ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOfferStatus(
  offerId: number,
  status: OfferStatus
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .update({ status, responded_at: new Date().toISOString() })
    .eq("id", offerId);
  if (error) throw error;
}

export async function getOffer(offerId: number): Promise<CardOffer | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", offerId)
    .single();
  if (error) return null;
  return data;
}

/** Split an event's offers for a user into what they're selling vs. buying. */
export async function listOffersForEvent(
  eventId: number,
  userEmail: string
): Promise<{ incoming: CardOffer[]; outgoing: CardOffer[] }> {
  const [incomingRes, outgoingRes] = await Promise.all([
    supabase
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .eq("seller_email", userEmail)
      .order("created_at", { ascending: false }),
    supabase
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .eq("buyer_email", userEmail)
      .order("created_at", { ascending: false }),
  ]);
  if (incomingRes.error) throw incomingRes.error;
  if (outgoingRes.error) throw outgoingRes.error;
  return {
    incoming: incomingRes.data ?? [],
    outgoing: outgoingRes.data ?? [],
  };
}

/** Cleanup helper used when a vendor un-RSVPs or deletes their listing. */
export async function deleteOffersForListing(
  eventId: number,
  userEmail: string
): Promise<void> {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("event_id", eventId)
    .eq("seller_email", userEmail);
  if (error) throw error;
}
