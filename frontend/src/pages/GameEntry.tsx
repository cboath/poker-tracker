import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { Player, Game } from '../types';
import {
  addPlayerToRoster as addPlayerToRosterList,
  canSubmitRoster,
  removeFromRoster as removeFromRosterList,
  rosterTotal as computeRosterTotal,
  RosterEntry,
} from '../utils/roster';

// This page is the /admin landing view: create a new monthly game (via the
// roster builder below) or jump into managing an existing one from the
// games list. Everything about *managing* a specific game (results table,
// rebuys, payouts) lives on GameManage (/admin/games/:gameId) instead, so
// that once you're on a game's page the only thing there is that game.
export default function GameEntry() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New game form
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [buyInAmount, setBuyInAmount] = useState<number | ''>('');

  // Roster builder for the new game: players are added one at a time (with
  // their individual buy-in) into `roster`, which becomes the source of
  // truth for entrantsCount/totalPot on submit (the backend derives both
  // from `players` when it's a non-empty array).
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [rosterPlayerId, setRosterPlayerId] = useState('');
  const [rosterBuyIn, setRosterBuyIn] = useState<number | ''>('');
  const rosterTotal = computeRosterTotal(roster);

  // Once a game-level buy-in amount is set, default each new roster entry's
  // buy-in to it so the user isn't re-typing the same number per player.
  useEffect(() => {
    if (buyInAmount !== '') setRosterBuyIn(buyInAmount);
  }, [buyInAmount]);

  useEffect(() => {
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .listGamesForYear(year)
      .then((gs) => setGames(gs.sort((a, b) => b.date.localeCompare(a.date))))
      .catch(() => setGames([]));
  }, [year]);

  function addPlayerToRoster() {
    const player = players.find((p) => p.playerId === rosterPlayerId);
    const result = addPlayerToRosterList(roster, {
      playerId: rosterPlayerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : '',
      buyIn: rosterBuyIn,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setRoster(result.roster);
    setRosterPlayerId('');
    setRosterBuyIn(buyInAmount);
  }

  function removeFromRoster(playerId: string) {
    setRoster((prev) => removeFromRosterList(prev, playerId));
  }

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmitRoster(roster)) {
      setError('Add at least one player to the roster before creating the game.');
      return;
    }
    try {
      const month = Number(date.split('-')[1] ?? 1);
      const g = await api.createGame(year, {
        date,
        month,
        location: location || undefined,
        buyInAmount: buyInAmount === '' ? undefined : Number(buyInAmount),
        players: roster,
      });
      setNotice(`Game created for ${date}. Redirecting to manage it...`);
      setGames((prev) => [g, ...prev]);
      setDate('');
      setLocation('');
      setBuyInAmount('');
      setRoster([]);
      setRosterPlayerId('');
      setRosterBuyIn('');
      navigate(`/admin/games/${g.gameId}`);
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Enter Results</h1>
      {error && <p style={{ color: 'var(--rail-red)' }}>{error}</p>}
      {notice && <p style={{ color: 'var(--brass-bright)' }}>{notice}</p>}

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>Log a new monthly game</h3>
        <form onSubmit={createGame}>
          <label htmlFor="year">Season year</label>
          <input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          <label htmlFor="date">Date</label>
          <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <label htmlFor="location">Location (optional)</label>
          <input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          <label htmlFor="buyInAmount">Buy-in amount (optional)</label>
          <input
            id="buyInAmount"
            type="number"
            min={0}
            value={buyInAmount}
            onChange={(e) => setBuyInAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />

          <h4>Roster</h4>
          <label htmlFor="rosterPlayer">Player</label>
          <select id="rosterPlayer" value={rosterPlayerId} onChange={(e) => setRosterPlayerId(e.target.value)}>
            <option value="">Select a player&hellip;</option>
            {players
              .filter((p) => p.active && !roster.some((r) => r.playerId === p.playerId))
              .map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {p.firstName} {p.lastName}
                </option>
              ))}
          </select>
          <label htmlFor="rosterBuyIn">Buy-in</label>
          <input
            id="rosterBuyIn"
            type="number"
            min={0}
            value={rosterBuyIn}
            onChange={(e) => setRosterBuyIn(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <button className="btn" type="button" onClick={addPlayerToRoster}>
            Add player
          </button>

          {roster.length === 0 ? (
            <div className="empty-state">No players added yet.</div>
          ) : (
            roster.map((r) => (
              <div key={r.playerId} className="rail-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div className="rail-name">{r.playerName}</div>
                <div>${r.buyIn}</div>
                <button className="btn" type="button" onClick={() => removeFromRoster(r.playerId)} aria-label={`Remove ${r.playerName} from roster`}>
                  Remove
                </button>
              </div>
            ))
          )}
          <p>
            Entrants: {roster.length} &mdash; Total pot: ${rosterTotal}
          </p>

          <button className="btn primary" type="submit" disabled={!canSubmitRoster(roster)}>
            Create game
          </button>
          {!canSubmitRoster(roster) && <p role="alert">Add at least one player before creating the game.</p>}
        </form>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>Games in {year}</h3>
        {games.length === 0 ? (
          <div className="empty-state">No games yet for {year}.</div>
        ) : (
          games.map((g) => (
            <div
              key={g.gameId}
              className="rail-row"
              style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }}
              onClick={() => navigate(`/admin/games/${g.gameId}`)}
            >
              <div>
                <div className="rail-name">{g.date}</div>
                <div className="rail-meta">{g.entrantsCount} entrants</div>
              </div>
              <div className="btn">Select</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
