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

/**
 * A single place's payout in a pot-based structure preview, before any
 * finish positions have necessarily been assigned to specific players. Uses
 * `place` (1st, 2nd, 3rd, ...) rather than `position` to make clear this is
 * NOT tied to any particular `Result.position` -- see `calculatePayoutStructure`.
 */
export interface PayoutStructureRow {
  place: number;
  payout: number;
}

const defaultMaxPlacesPaid = Math.max(...Object.keys(PAYOUT_TIERS).map(Number));

/**
 * The percentage split for `placesPaid` places, summing to 1. Reuses the
 * curated 1/2/3-place tiers above unchanged (so existing behavior and the
 * splits below are unaffected); an admin can now override how many places
 * get paid (see `placesPaidOverride` on `calculatePayouts`/
 * `calculatePayoutStructure`), including a count with no curated tier -- for
 * those, this falls back to a smooth harmonic decay (1/1, 1/2, 1/3, ...
 * normalized to sum to 1) since there's no agreed business rule for e.g. 5
 * places. If that split isn't right for a given game, the per-row payout
 * amount can just be overridden directly (see GameManage's payout editor).
 */
function tierForPlaces(placesPaid: number): number[] {
  const curated = PAYOUT_TIERS[placesPaid];
  if (curated) return curated;
  const weights = Array.from({ length: placesPaid }, (_, i) => 1 / (i + 1));
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => w / weightSum);
}

/**
 * Rounds each place in `tier` to the nearest $5 of `totalPot * tier[i]`, per
 * the cash-friendly rounding rule described above. This is the one place the
 * $5-rounding rule lives; both `calculatePayouts` and
 * `calculatePayoutStructure` call this rather than duplicating the math.
 */
function roundTierPayouts(totalPot: number, tier: number[]): number[] {
  return tier.map((share) => Math.round((totalPot * share) / 5) * 5);
}

/** `totalPot` minus the sum of `payouts`, rounded to the cent. */
function calculateRemainder(totalPot: number, payouts: number[]): number {
  const paidSum = payouts.reduce((sum, p) => sum + p, 0);
  return Math.round((totalPot - paidSum) * 100) / 100;
}

function calculateTotalPot(results: Result[]): number {
  const rawTotalPot = results.reduce(
    (sum, r) => sum + (r.buyIn ?? 0) + (r.rebuys ?? 0) + (r.addOns ?? 0),
    0
  );
  return Math.round(rawTotalPot * 100) / 100;
}

export function calculatePayouts(
  results: Result[],
  // Admin override for how many places get paid, from the "Places paid"
  // field on GameManage. Omitted, this defaults to the old auto behavior
  // (pay up to the largest curated tier, capped by how many are actually
  // scored). Given, it's capped only by how many are scored -- can't pay a
  // 5th place that doesn't exist yet -- but is otherwise honored exactly,
  // including asking for fewer places than the default would pay.
  placesPaidOverride?: number
): {
  totalPot: number;
  payouts: PayoutRow[];
  remainder: number;
} {
  const totalPot = calculateTotalPot(results);

  // A Result can now exist with no `position` yet (roster entrant added at
  // game-creation time, finish TBD -- see Result's docs in ../types.ts).
  // Payout tiers are inherently rank-based, so those entries can't be paid
  // out yet; exclude them here rather than let `undefined - undefined`
  // sorting/tiering produce NaN/garbage rows. They're still included in
  // `totalPot` above since their buy-in is real money in the pot.
  const scored = results.filter(
    (r): r is Result & { position: number } => typeof r.position === 'number'
  );

  const requestedPlaces = placesPaidOverride ?? Math.min(scored.length, defaultMaxPlacesPaid);
  const paidCount = Math.max(0, Math.min(requestedPlaces, scored.length));

  if (paidCount === 0) {
    return { totalPot, payouts: [], remainder: 0 };
  }

  const tier = tierForPlaces(paidCount);

  // Round each place's payout independently to the nearest $5 so payouts are
  // cash-friendly for a real home game (e.g. $85 instead of $86.50). This is
  // standard round-half-up: Math.round already rounds .5 up toward
  // +Infinity for positive values, so $87.50 -> $90. As a result, payouts
  // are no longer guaranteed to sum to exactly totalPot -- the leftover (or
  // shortfall) is returned separately as `remainder`.
  const roundedPayouts = roundTierPayouts(totalPot, tier);

  // Ties: two or more results can share the same `position` (e.g. both
  // knocked out together for 3rd). A tied group starting at `position` and
  // sized `groupSize` collectively occupies tier slots
  // [position, position + groupSize - 1] -- for a single (non-tied) result
  // this is just its own slot, so this reduces to the old one-slot-per-place
  // behavior exactly. Slots beyond `paidCount` don't exist in the tier and
  // contribute $0, so a tie that straddles the money bubble only splits
  // whatever portion of it actually falls in the paid places. Once a
  // group's starting position exceeds paidCount, every later group (sorted
  // ascending) does too, so nothing further is in the money.
  const sorted = [...scored].sort((a, b) => a.position - b.position);
  const payouts: PayoutRow[] = [];
  let i = 0;
  while (i < sorted.length) {
    const position = sorted[i].position;
    if (position > paidCount) break;

    let j = i;
    while (j < sorted.length && sorted[j].position === position) j++;
    const group = sorted.slice(i, j);

    let slotSum = 0;
    for (let slot = position; slot <= position + group.length - 1; slot++) {
      if (slot <= paidCount) slotSum += roundedPayouts[slot - 1];
    }
    const share = Math.round((slotSum / group.length) * 100) / 100;

    group.forEach((r) => {
      payouts.push({
        playerId: r.playerId,
        playerName: r.playerName,
        position: r.position,
        payout: share,
      });
    });

    i = j;
  }

  const remainder = calculateRemainder(
    totalPot,
    payouts.map((p) => p.payout)
  );

  return { totalPot, payouts, remainder };
}

/**
 * Previews the payout structure (dollar amounts per place) based on money
 * already in the pot, keyed off the number of entrants on the roster
 * (`results.length`) rather than how many finish positions have been
 * assigned (`scored.length` in `calculatePayouts`). This lets an organizer
 * see "what's 1st/2nd/3rd worth" before the tournament is closed out or
 * anyone has busted, since a `Result` can exist with a buy-in but no
 * `position` yet (see Result's docs in ../types.ts).
 *
 * Rows are identified by `place` (1st, 2nd, 3rd, ...), NOT by player --
 * which specific player lands in which place isn't known pre-scoring.
 *
 * Reuses the same `PAYOUT_TIERS` table and $5-rounding rule as
 * `calculatePayouts` (via `roundTierPayouts`), so the preview always matches
 * what `calculatePayouts` will eventually produce once positions are set,
 * assuming the pot and entrant count don't change in the meantime.
 */
export function calculatePayoutStructure(
  results: Result[],
  placesPaidOverride?: number
): {
  totalPot: number;
  structure: PayoutStructureRow[];
  remainder: number;
} {
  const totalPot = calculateTotalPot(results);

  const requestedPlaces = placesPaidOverride ?? Math.min(results.length, defaultMaxPlacesPaid);
  const paidCount = Math.max(0, Math.min(requestedPlaces, results.length));

  if (paidCount === 0) {
    return { totalPot, structure: [], remainder: 0 };
  }

  const tier = tierForPlaces(paidCount);
  const roundedPayouts = roundTierPayouts(totalPot, tier);
  const structure: PayoutStructureRow[] = roundedPayouts.map((payout, i) => ({
    place: i + 1,
    payout,
  }));

  const remainder = calculateRemainder(totalPot, roundedPayouts);

  return { totalPot, structure, remainder };
}
