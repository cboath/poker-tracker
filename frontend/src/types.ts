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
  archived?: boolean; // hidden from the default history/standings views but not deleted
  highHandBuyIn?: number; // per-player buy-in for the high hand side pot, set at creation
  blindTimer?: BlindTimerState;
}

// Mirrors backend/src/types.ts -- live blind-clock state for the game page's
// hand timer, persisted on `Game` via the existing PUT /games/{gameId}
// merge so it survives a page refresh.
export interface BlindTimerState {
  levelIndex: number; // 0-based index into utils/blinds.ts's BLIND_LEVELS
  levelDurationSeconds: number; // adjustable; defaults to 1200 (20 min)
  running: boolean;
  levelEndsAt?: string; // ISO timestamp; set only while running
  remainingSeconds: number; // snapshot used while paused/stopped
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
  highHandOptIn?: boolean; // whether this player bought into the game's high hand side pot
}

export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  rank: Rank;
  suit: Suit;
}

// Mirrors backend/src/types.ts -- one best-hand-of-the-night record per
// game. `cards` is the raw 5-card hand; the hand's rank (e.g. "Full House")
// is derived on the frontend from `cards` via utils/handRank, not stored,
// so there's a single source of truth for the ranking logic.
export interface HighHand {
  gameId: string;
  playerId: string;
  playerName: string;
  cards: Card[]; // exactly 5 cards
  amount?: number;
  notes?: string;
}

export interface GameWithResults extends Game {
  results: Result[];
  highHand?: HighHand | null;
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
