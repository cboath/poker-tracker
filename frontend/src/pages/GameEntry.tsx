import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Player, Game, GameWithResults } from '../types';

export default function GameEntry() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [games, setGames] = useState<Game[]>([]);
  const [activeGame, setActiveGame] = useState<GameWithResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New game form
  const [date, setDate] = useState('');
  const [location, setLocation] = useState('');
  const [entrantsCount, setEntrantsCount] = useState(0);
  const [totalPot, setTotalPot] = useState<number | ''>('');

  // Result entry form
  const [resultPlayerId, setResultPlayerId] = useState('');
  const [position, setPosition] = useState(1);
  const [buyIn, setBuyIn] = useState(0);
  const [rebuys, setRebuys] = useState(0);
  const [addOns, setAddOns] = useState(0);
  const [winnings, setWinnings] = useState(0);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .listGamesForYear(year)
      .then((gs) => setGames(gs.sort((a, b) => b.date.localeCompare(a.date))))
      .catch(() => setGames([]));
  }, [year]);

  async function createGame(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const month = Number(date.split('-')[1] ?? 1);
      const g = await api.createGame(year, {
        date,
        month,
        entrantsCount,
        location: location || undefined,
        totalPot: totalPot === '' ? undefined : Number(totalPot),
      });
      setNotice(`Game created for ${date}. Now log each player's result below.`);
      const full = await api.getGame(g.gameId);
      setActiveGame(full);
      setGames((prev) => [g, ...prev]);
      setDate('');
      setLocation('');
      setEntrantsCount(0);
      setTotalPot('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openGame(gameId: string) {
    setError(null);
    const g = await api.getGame(gameId);
    setActiveGame(g);
  }

  async function submitResult(e: React.FormEvent) {
    e.preventDefault();
    if (!activeGame || !resultPlayerId) return;
    setError(null);
    try {
      const player = players.find((p) => p.playerId === resultPlayerId);
      await api.upsertResult(activeGame.gameId, resultPlayerId, {
        playerName: player ? `${player.firstName} ${player.lastName}` : '',
        position,
        buyIn,
        rebuys,
        addOns,
        winnings,
        notes: notes || undefined,
      });
      const refreshed = await api.getGame(activeGame.gameId);
      setActiveGame(refreshed);
      setResultPlayerId('');
      setPosition(1);
      setBuyIn(0);
      setRebuys(0);
      setAddOns(0);
      setWinnings(0);
      setNotes('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeResult(playerId: string) {
    if (!activeGame) return;
    await api.deleteResult(activeGame.gameId, playerId);
    const refreshed = await api.getGame(activeGame.gameId);
    setActiveGame(refreshed);
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
          <label htmlFor="entrants">Number of entrants</label>
          <input id="entrants" type="number" min={1} value={entrantsCount || ''} onChange={(e) => setEntrantsCount(Number(e.target.value))} required />
          <label htmlFor="pot">Total pot (optional)</label>
          <input id="pot" type="number" value={totalPot} onChange={(e) => setTotalPot(e.target.value === '' ? '' : Number(e.target.value))} />
          <button className="btn primary" type="submit">
            Create game
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>Games in {year}</h3>
        {games.length === 0 ? (
          <div className="empty-state">No games yet for {year}.</div>
        ) : (
          games.map((g) => (
            <div key={g.gameId} className="rail-row" style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }} onClick={() => openGame(g.gameId)}>
              <div>
                <div className="rail-name">{g.date}</div>
                <div className="rail-meta">{g.entrantsCount} entrants</div>
              </div>
              <div className="btn">{activeGame?.gameId === g.gameId ? 'Selected' : 'Select'}</div>
            </div>
          ))
        )}
      </div>

      {activeGame && (
        <div className="panel">
          <h3>Results for {activeGame.date}</h3>
          <table style={{ marginBottom: 20 }}>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Player</th>
                <th>Points</th>
                <th>Buy-in</th>
                <th>Winnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...activeGame.results]
                .sort((a, b) => a.position - b.position)
                .map((r) => (
                  <tr key={r.playerId}>
                    <td>{r.position}</td>
                    <td style={{ fontFamily: 'var(--font-body)' }}>{r.playerName}</td>
                    <td>{r.points}</td>
                    <td>${r.buyIn}</td>
                    <td>${r.winnings}</td>
                    <td>
                      <button className="btn" onClick={() => removeResult(r.playerId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <h3>Add / update a player's result</h3>
          <form onSubmit={submitResult}>
            <label htmlFor="player">Player</label>
            <select id="player" value={resultPlayerId} onChange={(e) => setResultPlayerId(e.target.value)} required>
              <option value="">Select a player&hellip;</option>
              {players
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.playerId} value={p.playerId}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
            </select>
            <label htmlFor="position">Finish position</label>
            <input id="position" type="number" min={1} value={position} onChange={(e) => setPosition(Number(e.target.value))} required />
            <label htmlFor="buyIn">Buy-in</label>
            <input id="buyIn" type="number" min={0} value={buyIn} onChange={(e) => setBuyIn(Number(e.target.value))} />
            <label htmlFor="rebuys">Rebuys</label>
            <input id="rebuys" type="number" min={0} value={rebuys} onChange={(e) => setRebuys(Number(e.target.value))} />
            <label htmlFor="addOns">Add-ons</label>
            <input id="addOns" type="number" min={0} value={addOns} onChange={(e) => setAddOns(Number(e.target.value))} />
            <label htmlFor="winnings">Winnings</label>
            <input id="winnings" type="number" min={0} value={winnings} onChange={(e) => setWinnings(Number(e.target.value))} />
            <label htmlFor="notes">Notes (bad beats, highlights, etc.)</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <button className="btn primary" type="submit">
              Save result
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
