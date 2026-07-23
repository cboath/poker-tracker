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
  totalPot?: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface Result {
  gameId: string;
  playerId: string;
  playerName: string; // denormalized for easy display
  position: number; // 1 = first place
  buyIn: number;
  rebuys: number;
  addOns: number;
  winnings: number;
  points: number; // computed: entrantsCount - position + 1 (min 1)
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
