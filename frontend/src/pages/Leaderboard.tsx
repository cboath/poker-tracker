import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { StandingsResponse } from '../types';

export default function Leaderboard() {
  const [years, setYears] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [data, setData] = useState<StandingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listYears()
      .then((ys) => {
        setYears(ys);
        if (ys.length) setYear(ys[0]);
        else setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (year === null) return;
    setLoading(true);
    api
      .getStandings(year)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year]);

  if (error) return <div className="empty-state">Couldn't load standings: {error}</div>;

  if (!loading && years.length === 0) {
    return (
      <div className="empty-state">
        <h3>No seasons yet</h3>
        <p>Once an admin logs a game, the year's leaderboard will show up here.</p>
      </div>
    );
  }

  const maxPoints = data?.standings[0]?.totalPoints ?? 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Season Standings</h1>
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

      {loading ? (
        <p className="empty-state">Dealing the standings...</p>
      ) : (
        <div className="panel">
          <div style={{ color: 'var(--cream-dim)', fontSize: '0.85rem', marginBottom: 8 }}>
            {data?.gameCount ?? 0} game{data?.gameCount === 1 ? '' : 's'} played this season
          </div>
          {data?.standings.length === 0 ? (
            <div className="empty-state">No results logged for {year} yet.</div>
          ) : (
            data?.standings.map((row) => (
              <div className="rail-row" key={row.playerId}>
                <div className={`rail-rank ${row.rank === 1 ? 'gold' : ''}`}>{row.rank}</div>
                <div>
                  <Link to={`/players/${row.playerId}`} className="rail-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                    {row.playerName}
                  </Link>
                  {row.tied && <span className="tied-flag">tied &mdash; check H2H</span>}
                  <div className="rail-meta">
                    {row.gamesPlayed} games &middot; avg finish {row.avgFinish} &middot; {row.firstPlaceFinishes}x 1st &middot; ${row.totalWinnings.toFixed(0)} won
                  </div>
                  <div className="chip-bar-track">
                    <div
                      className="chip-bar-fill"
                      style={{ width: `${Math.max(4, (row.totalPoints / maxPoints) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rail-points">
                  {row.totalPoints}
                  <span className="label">points</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
