import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Game } from '../types';

export default function History() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [games, setGames] = useState<Game[]>([]);
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
    api
      .listGamesForYear(year)
      .then((gs) => setGames(gs.sort((a, b) => a.date.localeCompare(b.date))))
      .catch((e) => setError(e.message));
  }, [year]);

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
            <Link
              key={g.gameId}
              to={`/games/${g.gameId}`}
              className="rail-row"
              style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}
            >
              <div>
                <div className="rail-name">{new Date(g.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <div className="rail-meta">{g.location ?? 'Location TBD'} &middot; {g.entrantsCount} entrants{g.totalPot ? ` · $${g.totalPot} pot` : ''}</div>
              </div>
              <div className="btn">View results</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
