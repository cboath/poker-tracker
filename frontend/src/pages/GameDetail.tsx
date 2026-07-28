import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { GameWithResults } from '../types';

export default function GameDetail() {
  const { gameId } = useParams<{ gameId: string }>();
  const [game, setGame] = useState<GameWithResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gameId) return;
    setGame(null);
    setError(null);
    api.getGame(gameId).then(setGame).catch((e) => setError(e.message));
  }, [gameId]);

  if (error) return <div className="empty-state">{error}</div>;
  if (!game) return <div className="empty-state">Loading game...</div>;

  return (
    <div>
      <h1>
        {new Date(game.date + 'T00:00:00').toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })}
      </h1>
      <p className="rail-meta">
        {game.location ?? 'Location TBD'} &middot; {game.entrantsCount} entrants
        {game.totalPot ? ` · $${game.totalPot} pot` : ''}
      </p>

      <div className="suit-divider">&hearts; &spades; &diams; &clubs;</div>

      <div className="panel">
        <h3>Results</h3>
        {game.results.length === 0 ? (
          <div className="empty-state">No results recorded for this game yet.</div>
        ) : (
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
              {[...game.results]
                // Position-less (not-yet-scored) entrants sort to the end.
                .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
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
        )}
      </div>
    </div>
  );
}
