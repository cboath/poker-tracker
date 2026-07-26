/**
 * Pure helpers behind the "Log a new monthly game" roster builder in
 * GameEntry.tsx: players are added one at a time (with their individual
 * buy-in) before the game is created, and the backend derives
 * entrantsCount/totalPot from this list (see backend/src/handlers/games.ts,
 * `createGame`'s `players` handling).
 *
 * Kept as plain functions (no React/DOM) so the add/remove/duplicate/total
 * logic can be unit tested directly, matching this repo's existing
 * pure-function testing approach (see payouts.ts / payouts.test.ts) rather
 * than pulling in a component-testing library.
 */

export interface RosterEntry {
  playerId: string;
  playerName: string;
  buyIn: number;
}

export interface RosterAdditionInput {
  playerId: string;
  playerName: string;
  buyIn: number | '';
}

export type RosterAdditionResult =
  | { ok: true; roster: RosterEntry[] }
  | { ok: false; error: string };

/**
 * Validates and appends one player to the roster. Returns a new array (does
 * not mutate `roster`) on success, or a human-readable error message on
 * failure. Mirrors the three unhappy paths the form needs to guard against:
 * no player selected, an invalid/negative buy-in, and re-adding a player
 * who's already on the roster.
 */
export function addPlayerToRoster(
  roster: RosterEntry[],
  input: RosterAdditionInput
): RosterAdditionResult {
  if (!input.playerId) {
    return { ok: false, error: 'Select a player to add.' };
  }
  if (
    input.buyIn === '' ||
    !Number.isFinite(Number(input.buyIn)) ||
    Number(input.buyIn) < 0
  ) {
    return { ok: false, error: 'Enter a non-negative buy-in for the player.' };
  }
  if (roster.some((r) => r.playerId === input.playerId)) {
    return { ok: false, error: 'That player is already on the roster.' };
  }

  return {
    ok: true,
    roster: [
      ...roster,
      {
        playerId: input.playerId,
        playerName: input.playerName,
        buyIn: Number(input.buyIn),
      },
    ],
  };
}

/** Removes a player from the roster by id (no-op if not present). */
export function removeFromRoster(roster: RosterEntry[], playerId: string): RosterEntry[] {
  return roster.filter((r) => r.playerId !== playerId);
}

/** Running total pot: the sum of every roster entry's buy-in. */
export function rosterTotal(roster: RosterEntry[]): number {
  return roster.reduce((sum, r) => sum + r.buyIn, 0);
}

/**
 * The new-game form must not submit with an empty roster (the backend
 * requires at least one player when `players` is provided at all -- see
 * `hasRoster` in createGame).
 */
export function canSubmitRoster(roster: RosterEntry[]): boolean {
  return roster.length > 0;
}
