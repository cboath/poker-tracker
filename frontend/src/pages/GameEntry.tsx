import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Player, Game, GameWithResults } from '../types';
import { calculatePayouts, PayoutRow } from '../utils/payouts';
import {
  addPlayerToRoster as addPlayerToRosterList,
  canSubmitRoster,
  removeFromRoster as removeFromRosterList,
  rosterTotal as computeRosterTotal,
  RosterEntry,
} from '../utils/roster';

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

  // Result entry form
  const [resultPlayerId, setResultPlayerId] = useState('');
  const [position, setPosition] = useState(1);
  const [buyIn, setBuyIn] = useState(0);
  const [rebuys, setRebuys] = useState(0);
  const [addOns, setAddOns] = useState(0);
  const [winnings, setWinnings] = useState(0);
  const [notes, setNotes] = useState('');

  // Payout calculation (client-side only, computed from activeGame.results)
  const [payoutResult, setPayoutResult] = useState<{
    totalPot: number;
    payouts: PayoutRow[];
  } | null>(null);

  useEffect(() => {
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    api
      .listGamesForYear(year)
      .then((gs) => setGames(gs.sort((a, b) => b.date.localeCompare(a.date))))
      .catch(() => setGames([]));
  }, [year]);

  // Keep the result form in sync with the selected player: if they already
  // have a result recorded for this game, load it so edits (e.g. just
  // updating winnings) don't clobber existing buy-ins/rebuys/add-ons with
  // blank defaults. If they don't have one yet, reset to defaults.
  useEffect(() => {
    if (!activeGame) return;
    const existing = activeGame.results.find((r) => r.playerId === resultPlayerId);
    if (existing) {
      // existing.position can now be absent (roster entrant, finish TBD);
      // default the form to 1 in that case rather than leaving it blank.
      setPosition(existing.position ?? 1);
      setBuyIn(existing.buyIn);
      setRebuys(existing.rebuys);
      setAddOns(existing.addOns);
      setWinnings(existing.winnings);
      setNotes(existing.notes ?? '');
    } else {
      setPosition(1);
      setBuyIn(0);
      setRebuys(0);
      setAddOns(0);
      setWinnings(0);
      setNotes('');
    }
  }, [resultPlayerId, activeGame]);

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
      setNotice(`Game created for ${date}. Now log each player's result below.`);
      const full = await api.getGame(g.gameId);
      setActiveGame(full);
      setPayoutResult(null);
      setGames((prev) => [g, ...prev]);
      setDate('');
      setLocation('');
      setBuyInAmount('');
      setRoster([]);
      setRosterPlayerId('');
      setRosterBuyIn('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function openGame(gameId: string) {
    setError(null);
    setPayoutResult(null);
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
      setPayoutResult(null);
      // Clearing the selected player triggers the sync effect above, which
      // resets position/buyIn/rebuys/addOns/winnings/notes to defaults.
      setResultPlayerId('');
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function removeResult(playerId: string) {
    if (!activeGame) return;
    await api.deleteResult(activeGame.gameId, playerId);
    const refreshed = await api.getGame(activeGame.gameId);
    setActiveGame(refreshed);
    setPayoutResult(null);
  }

  async function addRebuy(playerId: string) {
    if (!activeGame) return;
    setError(null);
    try {
      await api.addRebuy(activeGame.gameId, playerId);
      const refreshed = await api.getGame(activeGame.gameId);
      setActiveGame(refreshed);
      setPayoutResult(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function showPayouts() {
    if (!activeGame) return;
    setPayoutResult(calculatePayouts(activeGame.results));
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
                <th>Rebuys</th>
                <th>Winnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...activeGame.results]
                // Position-less (not-yet-scored) entrants sort to the end.
                .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
                .map((r) => (
                  <tr key={r.playerId}>
                    <td>{r.position}</td>
                    <td style={{ fontFamily: 'var(--font-body)' }}>{r.playerName}</td>
                    <td>{r.points}</td>
                    <td>${r.buyIn}</td>
                    <td>{r.rebuyCount > 0 ? `${r.rebuyCount} ($${r.rebuys})` : '—'}</td>
                    <td>${r.winnings}</td>
                    <td>
                      <button className="btn" onClick={() => addRebuy(r.playerId)}>
                        Add Rebuy
                      </button>{' '}
                      <button className="btn" onClick={() => removeResult(r.playerId)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          <button className="btn" onClick={showPayouts} disabled={activeGame.results.length === 0}>
            Calculate Payouts
          </button>
          {payoutResult && (
            <div style={{ marginTop: 12, marginBottom: 20 }}>
              <p>Total pot: ${payoutResult.totalPot}</p>
              {payoutResult.payouts.length === 0 ? (
                <div className="empty-state">No results recorded yet to calculate payouts.</div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Player</th>
                      <th>Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutResult.payouts.map((p) => (
                      <tr key={p.playerId}>
                        <td>{p.position}</td>
                        <td style={{ fontFamily: 'var(--font-body)' }}>{p.playerName}</td>
                        <td>${p.payout.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

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
