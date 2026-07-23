import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Game, GameWithResults } from '../types';

export default function History() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameWithResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listYears()
      .then((ys) => {
        setYears(ys);
        if (ys.length) setYear(ys[0]);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (year === null) return;
    setSelectedGame(null);
    api
      .listGamesForYear(year)
      .then((gs) => setGames(gs.sort((a, b) => a.date.localeCompare(b.date))))
      .catch((e) => setError(e.message));
  }, [year]);

  function openGame(gameId: string) {
    api.getGame(gameId).then(setSelectedGame).catch((e) => setError(e.message));
  }

  if (error) return <div className="empty-state">{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Season Archive</h1>
        {years.length > 0 && (
          <select value={year ?? ''} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 120, marginBottom: 0 }}>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        )}
      </div>

      {years.length === 0 && (
        <div className="empty-state">
          <h3>No games logged yet</h3>
          <p>Past seasons will build up here as results are entered each month.</p>
        </div>
      )}

      <div className="panel">
        {games.length === 0 && year !== null ? (
          <div className="empty-state">No games logged for {year} yet.</div>
        ) : (
          games.map((g) => (
            <div key={g.gameId} className="rail-row" style={{ gridTemplateColumns: '1fr auto', cursor: 'pointer' }} onClick={() => openGame(g.gameId)}>
              <div>
                <div className="rail-name">{new Date(g.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="rail-meta">{g.location ?? 'Location TBD'} &middot; {g.entrantsCount} entrants{g.totalPot ? ` \u00b7 $${g.totalPot} pot` : ''}</div>
              </div>
              <div className="btn">View results</div>
            </div>
          ))
        )}
      </div>

      {selectedGame && (
        <>
          <div className="suit-divider">&hearts; &spades; &diams; &clubs;</div>
          <div className="panel">
            <h3>
              Results &mdash; {new Date(selectedGame.date + 'T00:00:00').toLocaleDateString()}
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Player</th>
                  <th>Points</th>
                  <th>Buy-in</th>
                  <th>Rebuys/Add-ons</th>
                  <th>Winnings</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {[...selectedGame.results]
                  .sort((a, b) => a.position - b.position)
                  .map((r) => (
                    <tr key={r.playerId}>
                      <td>{r.position}</td>
                      <td style={{ fontFamily: 'var(--font-body)' }}>{r.playerName}</td>
                      <td>{r.points}</td>
                      <td>${r.buyIn}</td>
                      <td>{r.rebuys + r.addOns}</td>
                      <td>${r.winnings}</td>
                      <td style={{ fontFamily: 'var(--font-body)', color: 'var(--cream-dim)' }}>{r.notes ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
