import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api/client';
import { PlayerProfileResponse } from '../types';

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const [data, setData] = useState<PlayerProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;
    api.getPlayerProfile(playerId).then(setData).catch((e) => setError(e.message));
  }, [playerId]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!data) return <div className="empty-state">Loading player...</div>;

  const { player, careerStats, history } = data;

  // Running point total across career, chronological
  let running = 0;
  const chartData = history.map((r, i) => {
    running += r.points;
    return { game: i + 1, points: running, label: r.playerName };
  });

  return (
    <div>
      <h1>{player.firstName} {player.lastName}</h1>
      <div className="panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 24 }}>
        <Stat label="Games played" value={careerStats.gamesPlayed} />
        <Stat label="Career points" value={careerStats.totalPoints} />
        <Stat label="1st place finishes" value={careerStats.firstPlaceFinishes} />
        <Stat label="Best finish" value={careerStats.bestFinish ?? '—'} />
        <Stat label="Net profit" value={`$${careerStats.netProfit.toFixed(0)}`} />
        <Stat label="Total winnings" value={`$${careerStats.totalWinnings.toFixed(0)}`} />
      </div>

      <div className="suit-divider">&spades; &hearts; &clubs; &diams;</div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>Points over career</h3>
        {chartData.length < 2 ? (
          <div className="empty-state">Play a few more games to see a trend line.</div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="rgba(244,239,230,0.08)" />
              <XAxis dataKey="game" stroke="var(--cream-dim)" tick={{ fontSize: 12 }} label={{ value: 'Game #', position: 'insideBottom', offset: -3, fill: 'var(--cream-dim)', fontSize: 12 }} />
              <YAxis stroke="var(--cream-dim)" tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ background: 'var(--felt-dark)', border: '1px solid var(--brass)', borderRadius: 8 }} labelStyle={{ color: 'var(--cream)' }} />
              <Line type="monotone" dataKey="points" stroke="var(--brass-bright)" strokeWidth={2} dot={{ fill: 'var(--brass)', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel">
        <h3>Game history</h3>
        {history.length === 0 ? (
          <div className="empty-state">No games logged yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Points</th>
                <th>Buy-in</th>
                <th>Winnings</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.gameId}>
                  <td>{r.position}</td>
                  <td>{r.points}</td>
                  <td>${r.buyIn}</td>
                  <td>${r.winnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--cream-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="mono" style={{ fontSize: '1.4rem', color: 'var(--brass-bright)' }}>{value}</div>
    </div>
  );
}
