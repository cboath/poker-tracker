import { describe, it, expect } from 'vitest';
import { calculatePayouts } from './payouts';
import { Result } from '../types';

/**
 * Minimal factory for a `Result` so each test only needs to specify the
 * fields it actually cares about (position, buyIn, rebuys, addOns).
 */
function makeResult(overrides: Partial<Result> & { position: number }): Result {
  return {
    gameId: 'game-1',
    playerId: `player-${overrides.position}`,
    playerName: `Player ${overrides.position}`,
    buyIn: 0,
    rebuys: 0,
    rebuyCount: 0,
    addOns: 0,
    winnings: 0,
    points: 0,
    ...overrides,
  };
}

describe('calculatePayouts', () => {
  it('pays the sole entrant 100% of the pot (winner-take-all)', () => {
    const results = [makeResult({ position: 1, buyIn: 50 })];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBe(50);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 50 },
    ]);
    // $50 is already a multiple of $5, so nothing is left over.
    expect(remainder).toBe(0);
  });

  it('splits a 2-entrant pot 65/35 between 1st and 2nd', () => {
    const results = [
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
    ];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBe(200);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 130 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 70 },
    ]);
    // 130 + 70 = 200 exactly, so there's no shortfall/leftover here.
    expect(remainder).toBe(0);
  });

  it('splits a 3-entrant pot 50/30/20 and sorts by position, not array order', () => {
    // Deliberately constructed out of position order (3rd, 1st, 2nd) to
    // prove the function sorts by `position` rather than trusting the
    // order results were passed in.
    const results = [
      makeResult({ position: 3, buyIn: 100 }),
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
    ];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBe(300);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 150 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 90 },
      { playerId: 'player-3', playerName: 'Player 3', position: 3, payout: 60 },
    ]);
    expect(remainder).toBe(0);
  });

  it('pays only the top 3 by position when more than 3 results are recorded, but totalPot includes everyone', () => {
    const results = [
      makeResult({ position: 5, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
      makeResult({ position: 4, buyIn: 100 }),
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 3, buyIn: 100 }),
    ];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBe(500);
    expect(payouts).toHaveLength(3);
    expect(payouts.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(payouts.find((p) => p.position === 4 || p.position === 5)).toBeUndefined();
    // 50/30/20 tier still applies to the full 500 pot, not just the top 3's contributions.
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 250 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 150 },
      { playerId: 'player-3', playerName: 'Player 3', position: 3, payout: 100 },
    ]);
    expect(remainder).toBe(0);
  });

  it('sums buyIn + rebuys + addOns across every result for totalPot, not just paid finishers', () => {
    const results = [
      makeResult({ position: 1, buyIn: 20, rebuys: 20, addOns: 10 }), // 50
      makeResult({ position: 2, buyIn: 20, rebuys: 0, addOns: 10 }), // 30
      makeResult({ position: 3, buyIn: 20, rebuys: 20, addOns: 0 }), // 40
      makeResult({ position: 4, buyIn: 20, rebuys: 20, addOns: 20 }), // 60 (unpaid, but still in pot)
    ];

    const { totalPot } = calculatePayouts(results);

    expect(totalPot).toBe(180);
  });

  it('returns an empty payout table, zero pot, and zero remainder for zero entrants, without throwing', () => {
    const { totalPot, payouts, remainder } = calculatePayouts([]);

    expect(totalPot).toBe(0);
    expect(payouts).toEqual([]);
    // Nothing was paid out (paidCount === 0), so there's nothing left over
    // to report either -- remainder must be exactly 0, not `0 - 0` fuzz.
    expect(remainder).toBe(0);
  });

  it('excludes not-yet-scored roster entrants (no position) from payouts but still counts their buy-in in totalPot', () => {
    // Two players have finished (position set); a third was added to the
    // roster at game-creation time but hasn't played yet, so their Result
    // has a buyIn but no position (see Result's docs in ../types.ts).
    const results = [
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
      { ...makeResult({ position: 1, buyIn: 100 }), position: undefined, playerId: 'player-unscored', playerName: 'Player Unscored' },
    ];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    // The unscored entrant's buy-in is real money already in the pot.
    expect(totalPot).toBe(300);
    // But with only 2 scored results, the tier is 65/35 -- the unscored
    // player must not appear anywhere in the payout table.
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 195 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 105 },
    ]);
    expect(payouts.find((p) => p.playerId === 'player-unscored')).toBeUndefined();
    // 195 + 105 = 300 exactly.
    expect(remainder).toBe(0);
  });

  it('pays out nothing (empty payouts) and reports zero remainder when every result is an unscored roster entrant, while totalPot still reflects their buy-ins', () => {
    const results = [
      { ...makeResult({ position: 1, buyIn: 50 }), position: undefined, playerId: 'player-a', playerName: 'Player A' },
      { ...makeResult({ position: 1, buyIn: 50 }), position: undefined, playerId: 'player-b', playerName: 'Player B' },
    ];

    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBe(100);
    expect(payouts).toEqual([]);
    // Nobody was paid (paidCount === 0), so remainder is exactly 0, not the
    // full $100 pot -- remainder only describes rounding drift among actual
    // payouts, not "money nobody has claimed yet".
    expect(remainder).toBe(0);
  });

  it('rounds each place to the nearest $5 even when the pot itself has floating-point fractional cents', () => {
    // totalPot = 100 (33.33 + 33.33 + 33.34), tier is 50/30/20.
    // 100 * 0.5 = 50, 100 * 0.3 = 30 (in floating point, 0.30000000000000004),
    // 100 * 0.2 = 20 (in floating point, 20.000000000000004) -- all of these
    // already happen to be clean multiples of $5, so this mostly proves the
    // floating-point fuzz from the percentage multiply doesn't leak through
    // `Math.round((totalPot * tier[i]) / 5) * 5`.
    const results = [
      makeResult({ position: 1, buyIn: 33.33 }),
      makeResult({ position: 2, buyIn: 33.33 }),
      makeResult({ position: 3, buyIn: 33.34 }),
    ];
    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBeCloseTo(100, 2);
    payouts.forEach((p) => {
      // Every payout should be an exact, fuzz-free multiple of $5.
      expect(Math.round(p.payout)).toBe(p.payout);
      expect(p.payout % 5).toBe(0);
    });

    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 50 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 30 },
      { playerId: 'player-3', playerName: 'Player 3', position: 3, payout: 20 },
    ]);
    expect(remainder).toBe(0);
  });

  it('rounds a genuinely non-dividing pot (e.g. a $10 pot split 3 ways) to the nearest $5 per place, even though that is a coarser split than the pot itself', () => {
    const results = [
      makeResult({ position: 1, buyIn: 3.34 }),
      makeResult({ position: 2, buyIn: 3.33 }),
      makeResult({ position: 3, buyIn: 3.33 }),
    ];
    // totalPot = 10, tier 50/30/20 -> proportional shares of 5 / 3 / 2.
    // Rounded independently to the nearest $5: 5 stays 5; 3 is closer to 5
    // than to 0 (3/5 = 0.6, rounds up) so becomes 5; 2 is closer to 0 than
    // to 5 (2/5 = 0.4, rounds down) so becomes 0. In this particular case
    // the roundings happen to cancel out and still sum to exactly $10, but
    // that's coincidental, not guaranteed (see the sweep tests below).
    const { totalPot, payouts, remainder } = calculatePayouts(results);

    expect(totalPot).toBeCloseTo(10, 2);
    expect(payouts.map((p) => p.payout)).toEqual([5, 5, 0]);
    expect(remainder).toBeCloseTo(0, 2);
  });

  it('can pay a real finisher exactly $0 when their proportional share rounds down below $2.50', () => {
    // 3rd place's true share of a $10 pot at the 50/30/20 tier is $2.00,
    // which is closer to $0 than to $5 -- so a real, in-the-money finisher
    // ends up with a $0 payout row rather than being silently dropped. This
    // is worth asserting explicitly: the row must still exist (position 3
    // is genuinely paid-out territory), it's just worth zero dollars.
    const results = [
      makeResult({ position: 1, buyIn: 3.34 }),
      makeResult({ position: 2, buyIn: 3.33 }),
      makeResult({ position: 3, buyIn: 3.33 }),
    ];

    const { payouts } = calculatePayouts(results);

    const thirdPlace = payouts.find((p) => p.position === 3);
    expect(thirdPlace).toBeDefined();
    expect(thirdPlace?.payout).toBe(0);
  });

  describe('nearest-$5 rounding: individual payouts are cash-friendly, remainder tracks the drift', () => {
    /**
     * The payout rule changed: each place's payout is now rounded
     * *independently* to the nearest $5 (`Math.round((totalPot * tier[i]) / 5) * 5`)
     * so a home game can pay out in physical $5 bills, rather than rounding
     * to the cent and forcing 1st place to absorb whatever's left over.
     *
     * This means payouts are no longer guaranteed to sum back to exactly
     * `totalPot` -- that's expected, not a bug, and the difference is
     * surfaced as `remainder`. The invariants that DO always hold:
     *
     * 1. Every payout is an exact multiple of $5.
     * 2. Every payout is within $2.50 of its true proportional share
     *    (`totalPot * tier[i]`). Rounding to the nearest multiple of $5 is
     *    `Math.round(x / 5) * 5`; writing x = 5q + r with 0 <= r < 5, the
     *    rounded result is 5q when r <= 2.5 and 5(q+1) when r > 2.5 (JS's
     *    Math.round rounds an exact .5 up, i.e. away from zero for positive
     *    inputs). So the distance from x to the rounded result is r (when
     *    r <= 2.5) or 5 - r (when r > 2.5) -- both of which max out at
     *    exactly 2.5, achieved when r is exactly 2.5 (e.g. x = 2.5, 7.5,
     *    12.5, ...). So the bound is `<= 2.5`, not `< 2.5` -- the boundary
     *    case is real and reachable, not just a theoretical limit.
     * 3. `remainder` is exactly `totalPot - sum(payouts)` (rounded to the
     *    cent, per the implementation) -- it must never drift from that.
     * 4. Because each place's rounding error is bounded by $2.50 (point 2),
     *    and remainder is the negative sum of every place's error, the
     *    worst case magnitude of `remainder` for an n-place tier is bounded
     *    by `n * 2.5` (every place's error maxed out in the same
     *    direction). That's a provable upper bound; in practice, because
     *    every place's share is a fixed fraction of the *same* totalPot,
     *    the errors can't all hit their ties independently, so the
     *    empirically observed worst case is smaller (see the sweep tests
     *    below) -- but `n * 2.5` is what we assert against here since it's
     *    the bound we can actually prove rather than one merely observed
     *    over a finite sweep.
     */

    /** Build `count` scored results whose buyIns sum to exactly totalPot. */
    function makePotResults(totalPot: number, count: number): Result[] {
      const results = [makeResult({ position: 1, buyIn: totalPot })];
      for (let position = 2; position <= count; position++) {
        results.push(makeResult({ position, buyIn: 0 }));
      }
      return results;
    }

    /** Every tier's percentages, keyed by paidCount, matching payouts.ts. */
    const TIERS: Record<number, number[]> = {
      1: [1],
      2: [0.65, 0.35],
      3: [0.5, 0.3, 0.2],
    };

    function isMultipleOf5(n: number): boolean {
      return Math.round(n) === n && n % 5 === 0;
    }

    it('rounds every payout to an exact multiple of $5', () => {
      const { payouts } = calculatePayouts(makePotResults(283.47, 3));

      payouts.forEach((p) => {
        expect(isMultipleOf5(p.payout), `payout ${p.payout} is not a multiple of $5`).toBe(true);
      });
    });

    it('keeps each payout within $2.50 of its true proportional share, including at the exact tie boundary', () => {
      // totalPot = 2.5 with a 1-place (winner-take-all) tier: the true
      // share is exactly 2.5, which is precisely half of $5 -- the tie
      // boundary from point 2 above. Math.round rounds .5 up, so this
      // becomes $5, an error of exactly 2.5 (not less).
      const { payouts } = calculatePayouts(makePotResults(2.5, 1));

      expect(payouts).toEqual([
        { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 5 },
      ]);
      expect(Math.abs(payouts[0].payout - 2.5)).toBe(2.5);
    });

    it('remainder equals totalPot minus the sum of the rounded payouts', () => {
      const { totalPot, payouts, remainder } = calculatePayouts(makePotResults(283.47, 3));

      const sum = payouts.reduce((s, p) => s + p.payout, 0);
      expect(remainder).toBeCloseTo(totalPot - sum, 9);
    });

    it('can drive |remainder| up to the full n * $2.50 bound when every place rounds the same direction', () => {
      // At totalPot = $50, the 65/35 tier's true shares are 32.5 and 17.5 --
      // both exact $5 ties -- and both round UP, so the payouts overshoot
      // the pot by the full 2 * 2.5 = $5.
      const { totalPot, payouts, remainder } = calculatePayouts(makePotResults(50, 2));

      expect(payouts).toEqual([
        { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 35 },
        { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 20 },
      ]);
      expect(totalPot).toBe(50);
      expect(remainder).toBe(-5);
      expect(Math.abs(remainder)).toBeLessThanOrEqual(2 * 2.5);
    });

    /**
     * Asserts the four invariants documented above for a single totalPot /
     * paidCount combination. Shared by the fine- and coarse-grained sweeps
     * below so both exercise identical checks.
     */
    function assertInvariantsHold(totalPot: number, paidCount: number): void {
      const tier = TIERS[paidCount];
      const bound = paidCount * 2.5;
      const { payouts, remainder } = calculatePayouts(makePotResults(totalPot, paidCount));

      expect(payouts).toHaveLength(paidCount);

      payouts.forEach((p, i) => {
        expect(
          isMultipleOf5(p.payout),
          `$${totalPot.toFixed(2)} pot, place ${i + 1}: payout ${p.payout} is not a multiple of $5`
        ).toBe(true);

        const share = totalPot * tier[i];
        expect(
          Math.abs(p.payout - share),
          `$${totalPot.toFixed(2)} pot, place ${i + 1}: payout ${p.payout} is more than $2.50 from its share ${share}`
        ).toBeLessThanOrEqual(2.5 + 1e-9);
      });

      const sum = payouts.reduce((s, p) => s + p.payout, 0);
      expect(remainder, `$${totalPot.toFixed(2)} pot: remainder inconsistent with payouts`).toBeCloseTo(
        totalPot - sum,
        9
      );
      expect(
        Math.abs(remainder),
        `$${totalPot.toFixed(2)} pot: |remainder| ${remainder} exceeds the provable bound of ${bound}`
      ).toBeLessThanOrEqual(bound + 1e-9);
    }

    describe.each([
      { paidCount: 1, label: 'winner-take-all (1 place)' },
      { paidCount: 2, label: '2-place (65/35)' },
      { paidCount: 3, label: '3-place (50/30/20)' },
    ])('sweeping $label', ({ paidCount }) => {
      it('holds the multiple-of-$5, proportional-share, and remainder-bound invariants for every cent-granularity totalPot from $0.05 to $200.00', () => {
        // Full cent granularity comfortably covers many repetitions of the
        // $5 rounding cycle (and the tier fraction's own denominator), so
        // this densely exercises every possible rounding-boundary case.
        for (let cents = 5; cents <= 20000; cents++) {
          assertInvariantsHold(cents / 100, paidCount);
        }
      });

      it('holds the same invariants for a coarser sweep from $200.00 to $500.00 (in $1 steps)', () => {
        // A cheaper spot-check across the rest of a realistic pot-size
        // range, since the fine sweep above already covers the rounding
        // cycle exhaustively at smaller amounts.
        for (let dollars = 200; dollars <= 500; dollars++) {
          assertInvariantsHold(dollars, paidCount);
        }
      });
    });
  });
});
