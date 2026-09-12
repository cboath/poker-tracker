// The hand timer's blind schedule -- a fixed custom progression rather than a
// simple doubling rule throughout, per the group's usual structure. Beyond
// the last defined level, blinds keep doubling from that last entry so a
// long-running tournament doesn't stall on a fixed schedule.
export const BLIND_LEVELS: Array<[bigBlind: number, smallBlind: number]> = [
  [2, 1],
  [4, 2],
  [8, 4],
  [10, 5],
  [20, 10],
  [40, 20],
  [80, 40],
  [100, 50],
];

export const DEFAULT_LEVEL_DURATION_SECONDS = 1200; // 20 minutes

export function blindsForLevel(levelIndex: number): { bigBlind: number; smallBlind: number } {
  if (levelIndex < BLIND_LEVELS.length) {
    const [bigBlind, smallBlind] = BLIND_LEVELS[levelIndex];
    return { bigBlind, smallBlind };
  }
  const doublings = levelIndex - BLIND_LEVELS.length + 1;
  const [lastBigBlind, lastSmallBlind] = BLIND_LEVELS[BLIND_LEVELS.length - 1];
  return {
    bigBlind: lastBigBlind * 2 ** doublings,
    smallBlind: lastSmallBlind * 2 ** doublings,
  };
}
