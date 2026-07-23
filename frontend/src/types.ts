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
  notes?: string;
}

export interface Result {
  gameId: string;
  playerId: string;
  playerName: string;
  position: number;
  buyIn: number;
  rebuys: number;
  addOns: number;
  winnings: number;
  points: number;
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
