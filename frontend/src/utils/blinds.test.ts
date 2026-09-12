import { describe, it, expect } from 'vitest';
import { BLIND_LEVELS, blindsForLevel } from './blinds';

describe('blindsForLevel', () => {
  it('returns each defined level from the custom schedule in order', () => {
    BLIND_LEVELS.forEach(([bigBlind, smallBlind], levelIndex) => {
      expect(blindsForLevel(levelIndex)).toEqual({ bigBlind, smallBlind });
    });
  });

  it('starts at $2/$1', () => {
    expect(blindsForLevel(0)).toEqual({ bigBlind: 2, smallBlind: 1 });
  });

  it('keeps doubling from the last defined level once the schedule runs out', () => {
    const lastIndex = BLIND_LEVELS.length - 1;
    const [lastBig, lastSmall] = BLIND_LEVELS[lastIndex];

    expect(blindsForLevel(lastIndex + 1)).toEqual({
      bigBlind: lastBig * 2,
      smallBlind: lastSmall * 2,
    });
    expect(blindsForLevel(lastIndex + 2)).toEqual({
      bigBlind: lastBig * 4,
      smallBlind: lastSmall * 4,
    });
  });
});
