// Shared trade-calculator constants + helpers (plain module so both the server
// action and the client component can import the runtime values — a "use
// server" file may only export async functions).

// Standard TCGplayer condition tiers with typical value multipliers relative
// to Near Mint market price. Used to value non-NM cards without a second live
// listings lookup per card.
export const CONDITIONS = [
  { value: "Near Mint", short: "NM", multiplier: 1.0 },
  { value: "Lightly Played", short: "LP", multiplier: 0.85 },
  { value: "Moderately Played", short: "MP", multiplier: 0.7 },
  { value: "Heavily Played", short: "HP", multiplier: 0.55 },
  { value: "Damaged", short: "DMG", multiplier: 0.4 },
] as const;

export type Condition = (typeof CONDITIONS)[number]["value"];

export const DEFAULT_CONDITION: Condition = "Near Mint";

export function conditionMultiplier(condition: string): number {
  return CONDITIONS.find((c) => c.value === condition)?.multiplier ?? 1.0;
}

export function conditionShort(condition: string): string {
  return CONDITIONS.find((c) => c.value === condition)?.short ?? condition;
}

// Daily cap on trade calculations per (real) user.
export const DAILY_TRADE_LIMIT = 10;

export type LiquidityTier = "liquid" | "moderate" | "illiquid";

export function liquidityTier(score: number): LiquidityTier {
  if (score >= 0.66) return "liquid";
  if (score >= 0.4) return "moderate";
  return "illiquid";
}
