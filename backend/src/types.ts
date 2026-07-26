// Shared types for the Poker Tournament Tracker backend

export interface Player {
  playerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  joinedDate: string; // ISO date
  active: boolean;
}

export interface Game {
  gameId: string;
  year: number;
  month: number; // 1-12
  date: string; // ISO date of the game
  location?: string;
  entrantsCount: number;
  buyInAmount: number;
  totalPot?: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

// A `Result` row now models two distinct lifecycle states of the same entity:
//   1. "Roster entrant, finish TBD" -- created when a game is set up with a
//      player list + buy-ins (see games.ts createGame), before the game has
//      been played/scored. `position` is absent because there is no finish
//      yet.
//   2. "Completed finish" -- created/updated via PUT /games/{gameId}/results/{playerId}
//      (results.ts upsertResult), which still requires a real `position` and
//      is how state 1 gets promoted to state 2 once the game is scored.
// `position` is therefore optional: undefined means "no finish recorded yet",
// not zero and not a sentinel finishing place.
// `points` is intentionally left as a required `number` (not optional) with
// `0` as its "not yet scored" sentinel -- `calculatePoints` always floors at
// 1 for any real finish, so `0` never collides with a legitimate point value
// and every existing consumer that sums/charts `points` keeps working
// untouched without needing to special-case `undefined`.
export interface Result {
  gameId: string;
  playerId: string;
  playerName: string; // denormalized for easy display
  position?: number; // 1 = first place; absent = roster entrant not yet scored
  buyIn: number;
  rebuys: number;
  rebuyCount: number; // display-only counter of rebuy events; does NOT factor into cash-sum math
  addOns: number;
  winnings: number;
  points: number; // computed: entrantsCount - position + 1 (min 1); 0 if not yet scored
  notes?: string;
}

export interface StandingRow {
  playerId: string;
  playerName: string;
  gamesPlayed: number;
  totalPoints: number;
  totalWinnings: number;
  totalBuyIns: number;
  firstPlaceFinishes: number;
  bestFinish: number;
  avgFinish: number;
}

export interface YearMarker {
  year: number;
}

// Helper to compute points per the agreed formula:
// points = entrantsCount - position + 1, floored at 1
export function calculatePoints(entrantsCount: number, position: number): number {
  const pts = entrantsCount - position + 1;
  return pts < 1 ? 1 : pts;
}
