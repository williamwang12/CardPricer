export interface Card {
  id: number;
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
  cost_basis: number | null;
  tcgplayer_url: string | null;
  manual_price: boolean;
  user_email: string;
}

export interface CardInput {
  name: string;
  number: string;
  quantity: number;
  market_price?: number | null;
  cost_basis?: number | null;
  tcgplayer_url?: string | null;
  manual_price?: boolean;
}

export interface ImportedCard {
  name: string;
  number: string;
  quantity: number;
}

export interface Transaction {
  id: number;
  type: "buy" | "sell";
  card_name: string;
  card_number: string;
  quantity: number;
  amount: number;
  user_email: string;
  created_at: string;
}

export interface PriceMover {
  name: string;
  number: string;
  oldPrice: number;
  newPrice: number;
  change: number;
}

export interface ScrapeResult {
  price: number | null;
  url: string | null;
}

// ── Shows ────────────────────────────────────────────────────────────────────

export type VenueType =
  | "collector_show"
  | "mall_show"
  | "tcg_tournament"
  | "convention"
  | "online"
  | "other";

export interface Show {
  id: number;
  user_email: string;
  name: string;
  date: string;
  date_end: string | null;
  venue_type: VenueType;
  table_fee: number | null;
  notes: string | null;
  created_at: string;
  finalized_at: string | null;
}

export interface ShowInput {
  name: string;
  date: string;
  date_end?: string | null;
  venue_type: VenueType;
  table_fee?: number | null;
  notes?: string | null;
}

export interface SnapshotCardWithQty {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
}

export interface ShowSnapshot {
  id: number;
  show_id: number;
  type: "pre" | "post";
  cards: SnapshotCardWithQty[];
  created_at: string;
}

export interface SoldCard {
  name: string;
  number: string;
  qty_sold: number;
  qty_before: number;
  market_price: number | null;
}

export interface AcquiredCard {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
}

export interface ShowDiffResult {
  sold: SoldCard[];
  acquired: AcquiredCard[];
  unsold: SnapshotCardWithQty[];
  revenue: number;
}

export interface ShelfLifeEntry {
  card_key: string;
  consecutive_shows: number;
  last_show_id: number | null;
}

// ── Events / Marketplace ─────────────────────────────────────────────────────

export interface Event {
  id: number;
  name: string;
  date: string;
  date_end: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_type: VenueType;
  description: string | null;
  published: boolean;
  created_by: string;
  created_at: string;
}

export interface EventInput {
  name: string;
  date: string;
  date_end?: string | null;
  venue_name?: string | null;
  venue_address?: string | null;
  venue_type: VenueType;
  description?: string | null;
  published?: boolean;
}

export interface EventAttendee {
  id: number;
  event_id: number;
  user_email: string;
  table_number: string | null;
  created_at: string;
}

export interface ListedCard {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
  asking_price: number | null;
}

export interface EventListing {
  id: number;
  event_id: number;
  user_email: string;
  cards: ListedCard[];
  updated_at: string;
}

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export interface CardOffer {
  id: number;
  event_id: number;
  seller_email: string;
  buyer_email: string;
  card_key: string;
  card_name: string;
  card_number: string;
  quantity: number;
  offer_amount: number;
  message: string | null;
  status: OfferStatus;
  created_at: string;
  responded_at: string | null;
}
