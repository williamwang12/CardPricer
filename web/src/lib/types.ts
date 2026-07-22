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

export type EventStatus =
  | "draft"
  | "pending_approval"
  | "published"
  | "live"
  | "ended"
  | "cancelled"
  | "rejected";

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
  // Vendor-network extensions (see docs/vendor-network-design.md)
  status: EventStatus;
  slug: string | null;
  cover_image_path: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  timezone: string | null; // IANA, e.g. "America/New_York"
  starts_at: string | null;
  ends_at: string | null;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  vendor_capacity: number | null;
  review_note: string | null;
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
  status?: EventStatus;
  slug?: string | null;
  cover_image_path?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  timezone?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  vendor_capacity?: number | null;
}

export type RegistrationStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export interface EventAttendee {
  id: number;
  event_id: number;
  user_email: string;
  table_number: string | null;
  created_at: string;
  // Vendor-network extensions — registration/approval record
  status: RegistrationStatus;
  booth_label: string | null;
  vendor_notes: string | null;
  organizer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface ListedCard {
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
  asking_price: number | null;
  is_featured?: boolean;
}

export type ListingVisibility = "show_vendors" | "hidden";

/** One approved vendor as shown in a show's vendor directory. */
export interface DirectoryVendor {
  email: string;
  storeName: string | null;
  avatarUrl: string | null;
  specialties: string[];
  boothLabel: string | null;
  cards: ListedCard[];
}

export interface EventListing {
  id: number;
  event_id: number;
  user_email: string;
  cards: ListedCard[];
  visibility: ListingVisibility;
  updated_at: string;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

export type ProfileVisibility = "everyone" | "show_connected";

export interface ProfileLinks {
  ebay?: string;
  instagram?: string;
  whatnot?: string;
  website?: string;
  [key: string]: string | undefined;
}

export interface Profile {
  user_email: string;
  store_name: string | null;
  avatar_path: string | null;
  bio: string | null;
  specialties: string[];
  location_city: string | null;
  location_region: string | null;
  links: ProfileLinks;
  is_vendor: boolean;
  is_organizer: boolean;
  profile_visibility: ProfileVisibility;
  notify_new_message: boolean;
  created_at: string;
  updated_at: string;
}

/** Fields a user may edit on their own profile. */
export interface ProfileInput {
  store_name?: string | null;
  avatar_path?: string | null;
  bio?: string | null;
  specialties?: string[];
  location_city?: string | null;
  location_region?: string | null;
  links?: ProfileLinks;
  profile_visibility?: ProfileVisibility;
  notify_new_message?: boolean;
}

// ── Messaging ────────────────────────────────────────────────────────────────

export interface Conversation {
  id: number;
  created_at: string;
  event_id: number | null;
  listing_owner_email: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_email: string;
  body: string;
  created_at: string;
}

export interface ConversationParticipant {
  conversation_id: number;
  user_email: string;
  last_read_at: string | null;
}

/** A conversation row enriched for the inbox list (other party + last message). */
export interface ConversationSummary {
  conversationId: number;
  otherEmail: string | null;
  otherStoreName: string | null;
  otherAvatarUrl: string | null;
  lastMessage: Message | null;
  unread: number;
}

// ── Feature Suggestions ─────────────────────────────────────────────────────

export interface FeatureSuggestion {
  id: number;
  user_email: string;
  title: string;
  description: string;
  created_at: string;
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
