import { Result } from '../types';

/**
 * Payout split assumption (business-rule guess, adjust as needed):
 * Only the top finishers are paid, using a percentage split of the total
 * pot based on how many results are being paid out. If there are fewer
 * paid finishers than the largest tier below, the next-smaller tier is
 * used instead (e.g. only 2 results recorded -> 65/35 split).
 *
 * To change the payout structure, just edit this table. Each array's
 * percentages should sum to 1 and its length is the number of places paid.
 */
const PAYOUT_TIERS: Record<number, number[]> = {
  1: [1],
  2: [0.65, 0.35],
  3: [0.5, 0.3, 0.2],
};

export interface PayoutRow {
  playerId: string;
  playerName: string;
  position: number;
  payout: number;
}

export function calculatePayouts(results: Result[]): {
  totalPot: number;
  payouts: PayoutRow[];
} {
  const totalPot = results.reduce(
    (sum, r) => sum + (r.buyIn ?? 0) + (r.rebuys ?? 0) + (r.addOns ?? 0),
    0
  );

  // A Result can now exist with no `position` yet (roster entrant added at
  // game-creation time, finish TBD -- see Result's docs in ../types.ts).
  // Payout tiers are inherently rank-based, so those entries can't be paid
  // out yet; exclude them here rather than let `undefined - undefined`
  // sorting/tiering produce NaN/garbage rows. They're still included in
  // `totalPot` above since their buy-in is real money in the pot.
  const scored = results.filter(
    (r): r is Result & { position: number } => typeof r.position === 'number'
  );

  const maxTier = Math.max(...Object.keys(PAYOUT_TIERS).map(Number));
  const paidCount = Math.min(scored.length, maxTier);

  if (paidCount === 0) {
    return { totalPot, payouts: [] };
  }

  const tier = PAYOUT_TIERS[paidCount];
  const sorted = [...scored].sort((a, b) => a.position - b.position).slice(0, paidCount);

  const payouts: PayoutRow[] = sorted.map((r, i) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    position: r.position,
    payout: Math.round(totalPot * tier[i] * 100) / 100,
  }));

  return { totalPot, payouts };
}
