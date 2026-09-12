import { Card, Rank } from '../types';

// Standard 5-card poker hand categories, low to high.
const CATEGORY_NAMES = [
  'High Card',
  'Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
  'Royal Flush',
] as const;

const RANK_VALUE: Record<Rank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_NAME_PLURAL: Record<Rank, string> = {
  '2': 'Twos',
  '3': 'Threes',
  '4': 'Fours',
  '5': 'Fives',
  '6': 'Sixes',
  '7': 'Sevens',
  '8': 'Eights',
  '9': 'Nines',
  '10': 'Tens',
  J: 'Jacks',
  Q: 'Queens',
  K: 'Kings',
  A: 'Aces',
};

// Describes the best-known ranking of exactly 5 cards, e.g. "Full House,
// Kings full of Fours". Only meaningful for a complete 5-card hand -- callers
// with fewer cards should not call this.
export function describeHand(cards: Card[]): string {
  if (cards.length !== 5) return '';

  const values = cards.map((c) => RANK_VALUE[c.rank]).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  const uniqueValues = [...new Set(values)];
  // Ace-low straight (A-2-3-4-5) sorts as [14,5,4,3,2] normally; special-case it.
  const isWheel = uniqueValues.length === 5 && uniqueValues.join(',') === '14,5,4,3,2';
  const isSequential = uniqueValues.length === 5 && uniqueValues[0] - uniqueValues[4] === 4;
  const isStraight = isWheel || isSequential;
  const straightHighValue = isWheel ? 5 : uniqueValues[0];

  const countsByValue = new Map<number, number>();
  for (const v of values) countsByValue.set(v, (countsByValue.get(v) ?? 0) + 1);
  // Groups sorted by count desc, then value desc, so the "primary" group
  // (the quad, the trips, the higher pair) always comes first.
  const groups = [...countsByValue.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

  const valueToRank = (v: number): Rank =>
    (Object.keys(RANK_VALUE) as Rank[]).find((r) => RANK_VALUE[r] === v)!;

  if (isStraight && isFlush) {
    return straightHighValue === 14
      ? CATEGORY_NAMES[9] // Royal Flush
      : `${CATEGORY_NAMES[8]}, ${RANK_NAME_PLURAL[valueToRank(straightHighValue)]} high`;
  }
  if (groups[0][1] === 4) {
    return `${CATEGORY_NAMES[7]}, ${RANK_NAME_PLURAL[valueToRank(groups[0][0])]}`;
  }
  if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    return `${CATEGORY_NAMES[6]}, ${RANK_NAME_PLURAL[valueToRank(groups[0][0])]} full of ${RANK_NAME_PLURAL[valueToRank(groups[1][0])]}`;
  }
  if (isFlush) {
    return `${CATEGORY_NAMES[5]}, ${RANK_NAME_PLURAL[valueToRank(uniqueValues[0])]} high`;
  }
  if (isStraight) {
    return `${CATEGORY_NAMES[4]}, ${RANK_NAME_PLURAL[valueToRank(straightHighValue)]} high`;
  }
  if (groups[0][1] === 3) {
    return `${CATEGORY_NAMES[3]}, ${RANK_NAME_PLURAL[valueToRank(groups[0][0])]}`;
  }
  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const hi = Math.max(groups[0][0], groups[1][0]);
    const lo = Math.min(groups[0][0], groups[1][0]);
    return `${CATEGORY_NAMES[2]}, ${RANK_NAME_PLURAL[valueToRank(hi)]} and ${RANK_NAME_PLURAL[valueToRank(lo)]}`;
  }
  if (groups[0][1] === 2) {
    return `${CATEGORY_NAMES[1]}, ${RANK_NAME_PLURAL[valueToRank(groups[0][0])]}`;
  }
  return `${CATEGORY_NAMES[0]}, ${RANK_NAME_PLURAL[valueToRank(uniqueValues[0])]} high`;
}
