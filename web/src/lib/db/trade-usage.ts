import { getUsageToday, incrementUsage } from "@/lib/db/daily-usage";

const TABLE = "trade_calc_usage";

// Today's trade-calculation count for a user (0 if the table isn't there yet).
export function getTradeUsageToday(email: string): Promise<number> {
  return getUsageToday(TABLE, email);
}

// Increments today's trade-calculation count by one.
export function incrementTradeUsage(email: string): Promise<void> {
  return incrementUsage(TABLE, email);
}
