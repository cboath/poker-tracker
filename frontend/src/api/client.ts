import {
  Player,
  Game,
  GameWithResults,
  Result,
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
  listGamesForYear: (year: number) => request<Game[]>(`/years/${year}/games`),
  createGame: (
    year: number,
    data: {
      date: string;
      month: number;
      entrantsCount: number;
      location?: string;
      totalPot?: number;
      notes?: string;
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

  // Results
  upsertResult: (
    gameId: string,
    playerId: string,
    data: Omit<Result, 'gameId' | 'playerId' | 'points'>
  ) =>
    request<Result>(`/games/${gameId}/results/${playerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteResult: (gameId: string, playerId: string) =>
    request(`/games/${gameId}/results/${playerId}`, { method: 'DELETE' }),

  // Standings
  getStandings: (year: number) => request<StandingsResponse>(`/years/${year}/standings`),
};
