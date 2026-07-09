import type {
  SnapshotCardWithQty,
  SoldCard,
  AcquiredCard,
  ShowDiffResult,
} from "@/lib/types";

/** Canonical card identity key — used across all diff logic in the app. */
export function cardKey(name: string, number: string): string {
  return `${name.toLowerCase()}|${number}`;
}

/**
 * Diff a pre-show snapshot against a post-show snapshot.
 *
 * Returns:
 *  - sold:     cards whose quantity decreased (or disappeared entirely)
 *  - acquired: cards that appeared in post (or whose quantity increased)
 *  - unsold:   cards present in both with no quantity decrease
 *  - revenue:  estimated total from sold cards (qty_sold × market_price)
 */
export function diffShowSnapshots(
  pre: SnapshotCardWithQty[],
  post: SnapshotCardWithQty[]
): ShowDiffResult {
  const preMap = new Map<string, SnapshotCardWithQty>();
  for (const c of pre) {
    preMap.set(cardKey(c.name, c.number), c);
  }

  const postMap = new Map<string, SnapshotCardWithQty>();
  for (const c of post) {
    postMap.set(cardKey(c.name, c.number), c);
  }

  const sold: SoldCard[] = [];
  const unsold: SnapshotCardWithQty[] = [];
  let revenue = 0;

  // Walk pre-snapshot: detect sold and unsold
  for (const [key, preCard] of preMap) {
    const postCard = postMap.get(key);
    const postQty = postCard?.quantity ?? 0;

    if (postQty < preCard.quantity) {
      // Quantity decreased — some copies sold
      const qtySold = preCard.quantity - postQty;
      sold.push({
        name: preCard.name,
        number: preCard.number,
        qty_sold: qtySold,
        qty_before: preCard.quantity,
        market_price: preCard.market_price,
      });
      if (preCard.market_price != null) {
        revenue += qtySold * preCard.market_price;
      }
    } else {
      unsold.push(preCard);
    }
  }

  // Walk post-snapshot: detect acquired (new cards or quantity increases)
  const acquired: AcquiredCard[] = [];
  for (const [key, postCard] of postMap) {
    const preCard = preMap.get(key);
    if (!preCard) {
      // Entirely new card — acquired at show
      acquired.push({
        name: postCard.name,
        number: postCard.number,
        quantity: postCard.quantity,
        market_price: postCard.market_price,
      });
    } else if (postCard.quantity > preCard.quantity) {
      // Quantity increased — bought additional copies at show
      acquired.push({
        name: postCard.name,
        number: postCard.number,
        quantity: postCard.quantity - preCard.quantity,
        market_price: postCard.market_price,
      });
    }
  }

  return { sold, acquired, unsold, revenue };
}
