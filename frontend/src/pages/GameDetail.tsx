import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { GameWithResults } from '../types';
import HighHandCards from '../components/HighHandCards';
import BlindTimer from '../components/BlindTimer';

// How often this public page re-fetches the game while it looks "live"
// (blind timer running, or at least one player still without a finish
// position) so a spectator's tab -- who has no way to be pushed an update --
// stays reasonably in sync with what the organizer's admin session is doing,
// without hammering the API for a game that's already over.
const LIVE_POLL_INTERVAL_MS = 15000;

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

  const isLive =
    !!game && (!!game.blindTimer?.running || game.results.some((r) => r.position === undefined));

  useEffect(() => {
    if (!gameId || !isLive) return;
    const interval = setInterval(() => {
      api.getGame(gameId).then(setGame).catch(() => {});
    }, LIVE_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [gameId, isLive]);

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

      {game.blindTimer && (
        <div className="panel" style={{ marginBottom: 24 }}>
          <h3>Blind Timer</h3>
          <BlindTimer state={game.blindTimer} readOnly />
        </div>
      )}

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>High Hand</h3>
        <HighHandCards highHand={game.highHand} size="lg" />
      </div>

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
                <th>Status</th>
                <th>Points</th>
                <th>Buy-in</th>
                <th>Rebuys/Add-ons</th>
                <th>Winnings</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {[...game.results]
                // Still-playing entrants (no position yet) stay on top,
                // matching the admin view -- the players spectators most
                // want to see (who's still in) aren't buried below everyone
                // already knocked out.
                .sort((a, b) => (a.position ?? -Infinity) - (b.position ?? -Infinity))
                .map((r) => (
                  <tr key={r.playerId}>
                    <td>{r.position ?? ''}</td>
                    <td style={{ fontFamily: 'var(--font-body)' }}>{r.playerName}</td>
                    <td>
                      {r.position === undefined ? (
                        <span style={{ color: 'var(--brass-bright)' }}>Still playing</span>
                      ) : r.position === 1 ? (
                        <span style={{ color: 'var(--brass-bright)' }}>Winner</span>
                      ) : (
                        <span className="rail-meta">Knocked out</span>
                      )}
                    </td>
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
