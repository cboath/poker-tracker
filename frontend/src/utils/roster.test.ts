import { describe, it, expect } from 'vitest';
import {
  addPlayerToRoster,
  canSubmitRoster,
  removeFromRoster,
  rosterTotal,
  RosterEntry,
} from './roster';

describe('addPlayerToRoster', () => {
  it('appends a valid player with their buy-in to an empty roster', () => {
    const result = addPlayerToRoster([], {
      playerId: 'p1',
      playerName: 'Alice',
      buyIn: 50,
    });

    expect(result).toEqual({
      ok: true,
      roster: [{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }],
    });
  });

  it('appends to an existing roster without mutating the original array', () => {
    const existing: RosterEntry[] = [{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }];

    const result = addPlayerToRoster(existing, {
      playerId: 'p2',
      playerName: 'Bob',
      buyIn: 25,
    });

    expect(result).toEqual({
      ok: true,
      roster: [
        { playerId: 'p1', playerName: 'Alice', buyIn: 50 },
        { playerId: 'p2', playerName: 'Bob', buyIn: 25 },
      ],
    });
    // Original array reference must be untouched (pure function).
    expect(existing).toEqual([{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }]);
  });

  it('accepts a zero buy-in (a comp/freeroll entry is not "negative")', () => {
    const result = addPlayerToRoster([], { playerId: 'p1', playerName: 'Alice', buyIn: 0 });

    expect(result).toEqual({ ok: true, roster: [{ playerId: 'p1', playerName: 'Alice', buyIn: 0 }] });
  });

  it('rejects adding a player with no playerId selected', () => {
    const result = addPlayerToRoster([], { playerId: '', playerName: '', buyIn: 50 });

    expect(result).toEqual({ ok: false, error: 'Select a player to add.' });
  });

  it('rejects a blank ("") buy-in', () => {
    const result = addPlayerToRoster([], { playerId: 'p1', playerName: 'Alice', buyIn: '' });

    expect(result).toEqual({ ok: false, error: 'Enter a non-negative buy-in for the player.' });
  });

  it('rejects a negative buy-in', () => {
    const result = addPlayerToRoster([], { playerId: 'p1', playerName: 'Alice', buyIn: -10 });

    expect(result).toEqual({ ok: false, error: 'Enter a non-negative buy-in for the player.' });
  });

  it('rejects a non-finite buy-in (e.g. NaN slipping through)', () => {
    const result = addPlayerToRoster([], { playerId: 'p1', playerName: 'Alice', buyIn: NaN });

    expect(result).toEqual({ ok: false, error: 'Enter a non-negative buy-in for the player.' });
  });

  it('rejects adding a player who is already on the roster (duplicate prevention)', () => {
    const existing: RosterEntry[] = [{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }];

    const result = addPlayerToRoster(existing, { playerId: 'p1', playerName: 'Alice', buyIn: 75 });

    expect(result).toEqual({ ok: false, error: 'That player is already on the roster.' });
    // Roster is unchanged on rejection.
    expect(existing).toEqual([{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }]);
  });
});

describe('removeFromRoster', () => {
  it('removes the matching player by id', () => {
    const roster: RosterEntry[] = [
      { playerId: 'p1', playerName: 'Alice', buyIn: 50 },
      { playerId: 'p2', playerName: 'Bob', buyIn: 25 },
    ];

    expect(removeFromRoster(roster, 'p1')).toEqual([{ playerId: 'p2', playerName: 'Bob', buyIn: 25 }]);
  });

  it('is a no-op when the playerId is not on the roster', () => {
    const roster: RosterEntry[] = [{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }];

    expect(removeFromRoster(roster, 'not-there')).toEqual(roster);
  });

  it('does not mutate the original array', () => {
    const roster: RosterEntry[] = [{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }];

    removeFromRoster(roster, 'p1');

    expect(roster).toEqual([{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }]);
  });
});

describe('rosterTotal', () => {
  it('sums every roster entry\'s buy-in', () => {
    const roster: RosterEntry[] = [
      { playerId: 'p1', playerName: 'Alice', buyIn: 50 },
      { playerId: 'p2', playerName: 'Bob', buyIn: 25.5 },
      { playerId: 'p3', playerName: 'Carl', buyIn: 0 },
    ];

    expect(rosterTotal(roster)).toBe(75.5);
  });

  it('is zero for an empty roster', () => {
    expect(rosterTotal([])).toBe(0);
  });
});

describe('canSubmitRoster', () => {
  it('is false for an empty roster (blocks game creation with zero players)', () => {
    expect(canSubmitRoster([])).toBe(false);
  });

  it('is true once at least one player has been added', () => {
    expect(canSubmitRoster([{ playerId: 'p1', playerName: 'Alice', buyIn: 50 }])).toBe(true);
  });
});
