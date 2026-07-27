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
 *
 * Each place's payout is rounded independently to the nearest $5 (standard
 * round-half-up) so payouts are easy to hand out in cash at a real home
 * game. This means payouts are NOT guaranteed to sum back to exactly
 * `totalPot` -- the difference is surfaced as `remainder` from
 * `calculatePayouts` (positive: pot cash left undistributed; negative:
 * rounded payouts exceed the pot).
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
  remainder: number;
} {
  const rawTotalPot = results.reduce(
    (sum, r) => sum + (r.buyIn ?? 0) + (r.rebuys ?? 0) + (r.addOns ?? 0),
    0
  );
  const totalPot = Math.round(rawTotalPot * 100) / 100;

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
    return { totalPot, payouts: [], remainder: 0 };
  }

  const tier = PAYOUT_TIERS[paidCount];
  const sorted = [...scored].sort((a, b) => a.position - b.position).slice(0, paidCount);

  // Round each place's payout independently to the nearest $5 so payouts are
  // cash-friendly for a real home game (e.g. $85 instead of $86.50). This is
  // standard round-half-up: Math.round already rounds .5 up toward
  // +Infinity for positive values, so $87.50 -> $90. As a result, payouts
  // are no longer guaranteed to sum to exactly totalPot -- the leftover (or
  // shortfall) is returned separately as `remainder`.
  const payouts: PayoutRow[] = sorted.map((r, i) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    position: r.position,
    payout: Math.round((totalPot * tier[i]) / 5) * 5,
  }));

  const paidSum = payouts.reduce((sum, p) => sum + p.payout, 0);
  const remainder = Math.round((totalPot - paidSum) * 100) / 100;

  return { totalPot, payouts, remainder };
}
