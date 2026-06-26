export interface Card {
  id: number;
  name: string;
  number: string;
  quantity: number;
  market_price: number | null;
  tcgplayer_url: string | null;
  manual_price: boolean;
  user_email: string;
}

export interface CardInput {
  name: string;
  number: string;
  quantity: number;
  market_price?: number | null;
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
