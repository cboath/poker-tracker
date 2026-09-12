import React, { useEffect, useState } from 'react';
import { Player } from '../types';

// Lets an admin check off any number of players (from those not already on
// the game's roster) and add them all at once with a shared buy-in, rather
// than repeating the old one-at-a-time "Add Player" form. Opened from the
// Results panel on GameManage; submission fans out to one
// addPlayerToGame call per checked player, left to the caller (GameManage
// owns the API calls/refetch, this component only collects the selection).
export default function AddPlayersModal({
  players,
  defaultBuyIn,
  highHandBuyIn,
  onClose,
  onSubmit,
}: {
  players: Player[];
  defaultBuyIn: number | '';
  // The game's per-player high hand buy-in, if one was set at creation --
  // shown next to each player's opt-in checkbox so the admin knows what
  // checking it costs. Undefined/0 means this game has no high hand pot.
  highHandBuyIn?: number;
  onClose: () => void;
  onSubmit: (
    selected: { playerId: string; playerName: string; buyIn: number; highHandOptIn: boolean }[]
  ) => Promise<void>;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [highHandIds, setHighHandIds] = useState<Set<string>>(new Set());
  const [buyIn, setBuyIn] = useState<number | ''>(defaultBuyIn);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function toggle(playerId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function toggleHighHand(playerId: string) {
    setHighHandIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedIds.size === 0) {
      setError('Select at least one player to add.');
      return;
    }
    if (buyIn === '' || !Number.isFinite(Number(buyIn)) || Number(buyIn) < 0) {
      setError('Enter a non-negative buy-in.');
      return;
    }
    const selected = players
      .filter((p) => selectedIds.has(p.playerId))
      .map((p) => ({
        playerId: p.playerId,
        playerName: `${p.firstName} ${p.lastName}`,
        buyIn: Number(buyIn),
        highHandOptIn: highHandIds.has(p.playerId),
      }));
    setSubmitting(true);
    try {
      await onSubmit(selected);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Add players"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Add Players</h3>
          <button className="btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {error && <p style={{ color: 'var(--rail-red)' }}>{error}</p>}

        <form onSubmit={handleSubmit}>
          {players.length === 0 ? (
            <div className="empty-state">Every active player is already in this game.</div>
          ) : (
            <div style={{ maxHeight: '45vh', overflowY: 'auto', marginBottom: 16 }}>
              {players.map((p) => (
                <div
                  key={p.playerId}
                  style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 0' }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.playerId)}
                      onChange={() => toggle(p.playerId)}
                      style={{ width: 'auto', marginBottom: 0 }}
                    />
                    <span style={{ fontFamily: 'var(--font-body)' }}>
                      {p.firstName} {p.lastName}
                    </span>
                  </label>
                  {!!highHandBuyIn && (
                    <label
                      className="rail-meta"
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        checked={highHandIds.has(p.playerId)}
                        onChange={() => toggleHighHand(p.playerId)}
                        disabled={!selectedIds.has(p.playerId)}
                        style={{ width: 'auto', marginBottom: 0 }}
                      />
                      High hand pot (${highHandBuyIn})
                    </label>
                  )}
                </div>
              ))}
            </div>
          )}

          <label htmlFor="addPlayersBuyIn">Buy-in (applied to each selected player)</label>
          <input
            id="addPlayersBuyIn"
            type="number"
            min={0}
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value === '' ? '' : Number(e.target.value))}
          />

          <button className="btn primary" type="submit" disabled={submitting || players.length === 0}>
            {submitting ? 'Adding...' : `Add ${selectedIds.size || ''} Player${selectedIds.size === 1 ? '' : 's'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
