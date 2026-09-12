import { Game, Result } from '../types';

/**
 * The high hand side pot: a fixed buy-in per opted-in player (`Game.highHandBuyIn`,
 * set at game creation), summed across everyone who checked the "high hand
 * pot" box when added to the game (`Result.highHandOptIn`). This is separate
 * from the main tournament pot/payouts entirely -- whoever holds the best
 * hand of the night is recorded and paid manually via the High Hand panel's
 * `amount` field, not derived from this total.
 */
export function calculateHighHandPot(
  game: Pick<Game, 'highHandBuyIn'>,
  results: Result[]
): { participantCount: number; total: number } {
  const participantCount = results.filter((r) => r.highHandOptIn).length;
  const total = (game.highHandBuyIn ?? 0) * participantCount;
  return { participantCount, total };
}
