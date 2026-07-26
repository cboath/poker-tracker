export interface Player {
  playerId: string;
  firstName: string;
  lastName: string;
  email?: string;
  joinedDate: string;
  active: boolean;
}

export interface Game {
  gameId: string;
  year: number;
  month: number;
  date: string;
  location?: string;
  entrantsCount: number;
  totalPot?: number;
  buyInAmount?: number;
  notes?: string;
}

// Mirrors backend/src/types.ts -- a `Result` can now exist either as:
//   - a roster entrant added at game-creation time with a buy-in but no
//     finish yet (`position` undefined), or
//   - a completed finish recorded via the "Add/update a player's result"
//     form (`position` set).
// `points` stays a required number; `0` means "not yet scored" (real finishes
// are always >= 1 via calculatePoints), so existing sum/chart code that reads
// `points` doesn't need to special-case `undefined`.
export interface Result {
  gameId: string;
  playerId: string;
  playerName: string;
  position?: number; // absent = roster entrant, finish TBD
  buyIn: number;
  rebuys: number;
  rebuyCount: number;
  addOns: number;
  winnings: number;
  points: number; // 0 if not yet scored
  notes?: string;
}

export interface GameWithResults extends Game {
  results: Result[];
}

export interface StandingRow {
  rank: number;
  tied: boolean;
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

export interface StandingsResponse {
  year: number;
  gameCount: number;
  standings: StandingRow[];
}

export interface PlayerProfileResponse {
  player: Player;
  careerStats: {
    gamesPlayed: number;
    totalPoints: number;
    totalWinnings: number;
    totalBuyIns: number;
    netProfit: number;
    firstPlaceFinishes: number;
    bestFinish: number | null;
  };
  history: Result[];
}
