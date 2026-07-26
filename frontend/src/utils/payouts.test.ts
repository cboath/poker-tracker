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

    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBe(50);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 50 },
    ]);
  });

  it('splits a 2-entrant pot 65/35 between 1st and 2nd', () => {
    const results = [
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
    ];

    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBe(200);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 130 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 70 },
    ]);
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

    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBe(300);
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 150 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 90 },
      { playerId: 'player-3', playerName: 'Player 3', position: 3, payout: 60 },
    ]);
  });

  it('pays only the top 3 by position when more than 3 results are recorded, but totalPot includes everyone', () => {
    const results = [
      makeResult({ position: 5, buyIn: 100 }),
      makeResult({ position: 2, buyIn: 100 }),
      makeResult({ position: 4, buyIn: 100 }),
      makeResult({ position: 1, buyIn: 100 }),
      makeResult({ position: 3, buyIn: 100 }),
    ];

    const { totalPot, payouts } = calculatePayouts(results);

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

  it('returns an empty payout table and zero pot for zero entrants, without throwing', () => {
    const { totalPot, payouts } = calculatePayouts([]);

    expect(totalPot).toBe(0);
    expect(payouts).toEqual([]);
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

    const { totalPot, payouts } = calculatePayouts(results);

    // The unscored entrant's buy-in is real money already in the pot.
    expect(totalPot).toBe(300);
    // But with only 2 scored results, the tier is 65/35 -- the unscored
    // player must not appear anywhere in the payout table.
    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 195 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 105 },
    ]);
    expect(payouts.find((p) => p.playerId === 'player-unscored')).toBeUndefined();
  });

  it('pays out nothing (empty payouts) when every result is an unscored roster entrant, while totalPot still reflects their buy-ins', () => {
    const results = [
      { ...makeResult({ position: 1, buyIn: 50 }), position: undefined, playerId: 'player-a', playerName: 'Player A' },
      { ...makeResult({ position: 1, buyIn: 50 }), position: undefined, playerId: 'player-b', playerName: 'Player B' },
    ];

    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBe(100);
    expect(payouts).toEqual([]);
  });

  it('rounds fractional-cent payouts to 2 decimal places', () => {
    // $100 pot split 65/35 -> 65.00 / 35.00 divides evenly, so use a pot
    // that does NOT divide evenly at the tier percentages: $100 * 0.5 = 50,
    // * 0.3 = 30, * 0.2 = 20 all divide evenly too, so pick an odd pot.
    const results = [
      makeResult({ position: 1, buyIn: 33.33 }),
      makeResult({ position: 2, buyIn: 33.33 }),
      makeResult({ position: 3, buyIn: 33.34 }),
    ];
    // totalPot = 100 (33.33 + 33.33 + 33.34), tier is 50/30/20
    // 100 * 0.5 = 50, 100 * 0.3 = 30 (in floating point, 0.30000000000000004),
    // 100 * 0.2 = 20 (in floating point, 20.000000000000004)
    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBeCloseTo(100, 2);
    payouts.forEach((p) => {
      // Each payout should be expressible with at most 2 decimal places -
      // i.e. rounding to cents actually took effect (no floating-point
      // fuzz like 30.000000000000004 leaking through).
      expect(p.payout).toBe(Math.round(p.payout * 100) / 100);
      expect(Number(p.payout.toFixed(2))).toBe(p.payout);
    });

    expect(payouts).toEqual([
      { playerId: 'player-1', playerName: 'Player 1', position: 1, payout: 50 },
      { playerId: 'player-2', playerName: 'Player 2', position: 2, payout: 30 },
      { playerId: 'player-3', playerName: 'Player 3', position: 3, payout: 20 },
    ]);
  });

  it('rounds a genuinely non-dividing pot (e.g. an odd $10 pot split 3 ways) sanely', () => {
    const results = [
      makeResult({ position: 1, buyIn: 3.34 }),
      makeResult({ position: 2, buyIn: 3.33 }),
      makeResult({ position: 3, buyIn: 3.33 }),
    ];
    // totalPot = 10, tier 50/30/20 -> 5 / 3 / 2, still clean, but exercises
    // the rounding path with a pot that isn't a "nice" multiple of 100.
    const { totalPot, payouts } = calculatePayouts(results);

    expect(totalPot).toBeCloseTo(10, 2);
    expect(payouts.map((p) => p.payout)).toEqual([5, 3, 2]);
    expect(payouts.reduce((sum, p) => sum + p.payout, 0)).toBeCloseTo(totalPot, 2);
  });
});
