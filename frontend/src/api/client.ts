import {
  Player,
  Game,
  GameWithResults,
  Result,
  HighHand,
  StandingsResponse,
  PlayerProfileResponse,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL;

type TokenGetter = () => Promise<string | null>;

// Set once by App.tsx after AuthProvider mounts, so the plain functions
// below can attach a bearer token without needing React context.
let tokenGetter: TokenGetter = async () => null;
export function registerTokenGetter(fn: TokenGetter) {
  tokenGetter = fn;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await tokenGetter();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = token;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Players
  listPlayers: () => request<Player[]>('/players'),
  getPlayer: (id: string) => request<Player>(`/players/${id}`),
  createPlayer: (data: { firstName: string; lastName: string; email?: string }) =>
    request<Player>('/players', { method: 'POST', body: JSON.stringify(data) }),
  updatePlayer: (id: string, data: Partial<Player>) =>
    request<Player>(`/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deactivatePlayer: (id: string) => request(`/players/${id}`, { method: 'DELETE' }),
  getPlayerProfile: (id: string) =>
    request<PlayerProfileResponse>(`/players/${id}/profile`),

  // Years / Games
  listYears: () => request<number[]>('/years'),
  listGamesForYear: (year: number, opts?: { includeArchived?: boolean }) =>
    request<Game[]>(
      `/years/${year}/games${opts?.includeArchived ? '?includeArchived=true' : ''}`
    ),
  createGame: (
    year: number,
    data: {
      date: string;
      month: number;
      // entrantsCount/totalPot are only required when `players` is omitted;
      // when `players` is provided the backend derives both from the
      // roster (entrantsCount = players.length, totalPot = sum of buyIns)
      // and also creates a Result per roster player with no position yet.
      entrantsCount?: number;
      location?: string;
      totalPot?: number;
      buyInAmount?: number;
      notes?: string;
      highHandBuyIn?: number;
      players?: { playerId: string; playerName: string; buyIn: number; highHandOptIn?: boolean }[];
    }
  ) =>
    request<Game>(`/years/${year}/games`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getGame: (gameId: string) => request<GameWithResults>(`/games/${gameId}`),
  updateGame: (gameId: string, data: Partial<Game>) =>
    request<Game>(`/games/${gameId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGame: (gameId: string) => request(`/games/${gameId}`, { method: 'DELETE' }),
  archiveGame: (gameId: string) =>
    request<Game>(`/games/${gameId}`, { method: 'PUT', body: JSON.stringify({ archived: true }) }),
  unarchiveGame: (gameId: string) =>
    request<Game>(`/games/${gameId}`, { method: 'PUT', body: JSON.stringify({ archived: false }) }),

  // Results
  upsertResult: (
    gameId: string,
    playerId: string,
    data: Omit<Result, 'gameId' | 'playerId' | 'points' | 'rebuyCount'>
  ) =>
    request<Result>(`/games/${gameId}/results/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteResult: (gameId: string, playerId: string) =>
    request(`/games/${gameId}/results/${playerId}`, { method: 'DELETE' }),
  addRebuy: (gameId: string, playerId: string, amount?: number) =>
    request<Result>(`/games/${gameId}/results/${playerId}/rebuy`, {
      method: 'POST',
      body: JSON.stringify(amount === undefined ? {} : { amount }),
    }),
  // Adds one player to an already-created game as a new roster entrant (buy-in
  // recorded, no finish position yet) -- the GameManage "Add Player" panel's
  // way of growing the roster after the game exists, as opposed to
  // createGame's one-time roster at creation. 409s if the player already has
  // a Result on this game.
  addPlayerToGame: (
    gameId: string,
    data: { playerId: string; playerName: string; buyIn: number; highHandOptIn?: boolean }
  ) =>
    request<Result>(`/games/${gameId}/players`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // High hand -- one best-hand-of-the-night record per game (PUT replaces it
  // whole, same convention as upsertResult).
  setHighHand: (
    gameId: string,
    data: Omit<HighHand, 'gameId'>
  ) =>
    request<HighHand>(`/games/${gameId}/highhand`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteHighHand: (gameId: string) =>
    request(`/games/${gameId}/highhand`, { method: 'DELETE' }),

  // Standings
  getStandings: (year: number) => request<StandingsResponse>(`/years/${year}/standings`),
};
