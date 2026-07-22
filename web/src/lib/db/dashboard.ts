import { supabase } from "@/lib/supabase";
import type { Card, Show } from "@/lib/types";
import type { SnapshotCard } from "@/lib/db/label-snapshot";
import type { Snapshot } from "@/lib/db/collection-snapshots";

export interface NextShow {
  id: number;
  name: string;
  date: string;
  dateEnd: string | null;
}

export interface SetValue {
  setName: string;
  value: number;
}

export interface Mover {
  name: string;
  number: string;
  setName: string;
  oldPrice: number;
  newPrice: number;
  deltaPct: number;
}

export interface DashboardData {
  totalValue: number;
  totalCards: number;
  uniqueCards: number;
  lastSnapshotAt: string | null;
  netMovement: number;
  netMovementPct: number;
  newcomerCount: number;
  removedCount: number;
  priceUps: number;
  priceDowns: number;
  valueBySet: SetValue[];
  gainers: Mover[];
  drops: Mover[];
  history: { date: string; value: number }[];
  nextShow: NextShow | null;
}

async function loadSetLookup(cards: Card[]): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const urlToIds = new Map<string, number[]>();

  for (const c of cards) {
    if (c.tcgplayer_url) {
      const ids = urlToIds.get(c.tcgplayer_url) ?? [];
      ids.push(c.id);
      urlToIds.set(c.tcgplayer_url, ids);
    }
  }

  const urls = [...urlToIds.keys()];
  const BATCH = 100;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const { data } = await supabase
      .from("tcg_catalog")
      .select("url, group_name")
      .in("url", batch);

    if (data) {
      for (const row of data) {
        const ids = urlToIds.get(row.url);
        if (ids) {
          for (const id of ids) {
            result.set(id, row.group_name);
          }
        }
      }
    }
  }

  return result;
}

export async function loadDashboardData(
  cards: Card[],
  snapshot: { downloaded_at: string; cards: SnapshotCard[] } | null,
  snapshots: Snapshot[] = [],
  shows: Show[] = []
): Promise<DashboardData> {
  const totalCards = cards.reduce((sum, c) => sum + c.quantity, 0);
  const uniqueCards = cards.length;
  const totalValue = cards.reduce(
    (sum, c) => sum + (c.market_price ?? 0) * c.quantity,
    0
  );

  let netMovement = 0;
  let netMovementPct = 0;
  let newcomerCount = 0;
  let removedCount = 0;
  let priceUps = 0;
  let priceDowns = 0;
  const movers: {
    card: Card;
    oldPrice: number;
    newPrice: number;
    deltaPct: number;
  }[] = [];

  if (snapshot) {
    const snapLookup = new Map<string, SnapshotCard>();
    for (const sc of snapshot.cards) {
      snapLookup.set(`${sc.name.toLowerCase()}|${sc.number}`, sc);
    }

    const currentKeys = new Set<string>();
    let oldMatchedValue = 0;

    for (const card of cards) {
      const key = `${card.name.toLowerCase()}|${card.number}`;
      currentKeys.add(key);
      const old = snapLookup.get(key);

      if (!old) {
        newcomerCount++;
      } else if (old.market_price != null && card.market_price != null) {
        const diff = card.market_price - old.market_price;
        netMovement += diff * card.quantity;
        oldMatchedValue += old.market_price * card.quantity;
        if (diff > 0.005) priceUps++;
        else if (diff < -0.005) priceDowns++;

        if (Math.abs(diff) > 0.01) {
          const pct =
            old.market_price > 0
              ? (diff / old.market_price) * 100
              : 0;
          movers.push({
            card,
            oldPrice: old.market_price,
            newPrice: card.market_price,
            deltaPct: pct,
          });
        }
      }
    }

    for (const key of snapLookup.keys()) {
      if (!currentKeys.has(key)) removedCount++;
    }

    netMovementPct =
      oldMatchedValue > 0 ? (netMovement / oldMatchedValue) * 100 : 0;
  }

  const sortedMovers = movers.sort(
    (a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct)
  );
  const gainerMovers = sortedMovers
    .filter((m) => m.deltaPct > 0)
    .slice(0, 5);
  const dropMovers = sortedMovers
    .filter((m) => m.deltaPct < 0)
    .slice(0, 5);

  const setLookup = await loadSetLookup(cards);

  // Value by set
  const setValues = new Map<string, number>();
  for (const card of cards) {
    const setName = setLookup.get(card.id) ?? "Other";
    const val = (card.market_price ?? 0) * card.quantity;
    if (val > 0) {
      setValues.set(setName, (setValues.get(setName) ?? 0) + val);
    }
  }

  const valueBySet = [...setValues.entries()]
    .map(([setName, value]) => ({ setName, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const gainers: Mover[] = gainerMovers.map((m) => ({
    name: m.card.name,
    number: m.card.number,
    setName: setLookup.get(m.card.id) ?? "",
    oldPrice: m.oldPrice,
    newPrice: m.newPrice,
    deltaPct: m.deltaPct,
  }));

  const drops: Mover[] = dropMovers.map((m) => ({
    name: m.card.name,
    number: m.card.number,
    setName: setLookup.get(m.card.id) ?? "",
    oldPrice: m.oldPrice,
    newPrice: m.newPrice,
    deltaPct: Math.abs(m.deltaPct),
  }));

  const history = snapshots.map((s) => ({
    date: s.captured_at,
    value: s.total_value,
  }));

  const todayStr = new Date().toISOString().slice(0, 10);
  const nextShowRaw = shows
    .filter((s) => !s.finalized_at && (s.date_end ?? s.date) >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextShow: NextShow | null = nextShowRaw
    ? {
        id: nextShowRaw.id,
        name: nextShowRaw.name,
        date: nextShowRaw.date,
        dateEnd: nextShowRaw.date_end,
      }
    : null;

  return {
    totalValue,
    totalCards,
    uniqueCards,
    lastSnapshotAt: snapshot?.downloaded_at ?? null,
    netMovement,
    netMovementPct,
    newcomerCount,
    removedCount,
    priceUps,
    priceDowns,
    valueBySet,
    gainers,
    drops,
    history,
    nextShow,
  };
}
