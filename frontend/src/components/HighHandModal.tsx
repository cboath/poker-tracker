import React, { useState } from 'react';
import { api } from '../api/client';
import { Card, HighHand, Result } from '../types';
import PlayingCard from './PlayingCard';
import CardPickerModal from './CardPickerModal';

function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`;
}

// The "set/edit high hand" form, lifted out of the High Hand panel into its
// own modal -- same pattern as AddPlayersModal for the Results panel: the
// panel itself only shows the current high hand (read-only) plus a button
// that opens this modal, and this modal owns the form's draft state and its
// own save action, closing itself on success. Nested inside it is
// CardPickerModal (the full 52-card grid) for each of the 5 card slots.
export default function HighHandModal({
  gameId,
  results,
  highHand,
  onClose,
  onSaved,
}: {
  gameId: string;
  results: Result[];
  highHand: HighHand | null | undefined;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [playerId, setPlayerId] = useState(highHand?.playerId ?? '');
  const [cards, setCards] = useState<(Card | null)[]>(
    highHand?.cards.length === 5 ? highHand.cards : [null, null, null, null, null]
  );
  const [amount, setAmount] = useState<number | ''>(highHand?.amount ?? '');
  const [notes, setNotes] = useState(highHand?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  function handlePickCard(card: Card) {
    if (activeSlot === null) return;
    setCards((prev) => prev.map((c, i) => (i === activeSlot ? card : c)));
    setActiveSlot(null);
  }

  function validate(): string | null {
    if (!playerId) return 'Select which player had the high hand.';
    if (cards.some((c) => c === null)) return 'Select all 5 cards.';
    const keys = (cards as Card[]).map(cardKey);
    if (new Set(keys).size !== keys.length) return 'A physical hand can’t repeat the same card twice.';
    return null;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    const player = results.find((r) => r.playerId === playerId);
    setSaving(true);
    try {
      await api.setHighHand(gameId, {
        playerId,
        playerName: player?.playerName ?? '',
        cards: cards as Card[],
        amount: amount === '' ? undefined : Number(amount),
        notes: notes || undefined,
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={highHand ? 'Edit high hand' : 'Set high hand'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>{highHand ? 'Edit High Hand' : 'Set High Hand'}</h3>
          <button className="btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>

        {error && <p style={{ color: 'var(--rail-red)' }}>{error}</p>}

        <form onSubmit={handleSave} style={{ maxWidth: 480 }}>
          <label htmlFor="highHandPlayer">Player</label>
          <select id="highHandPlayer" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">Select a player&hellip;</option>
            {results.map((r) => (
              <option key={r.playerId} value={r.playerId}>
                {r.playerName}
              </option>
            ))}
          </select>

          <label>Cards</label>
          <div className="card-slot-picker">
            {cards.map((card, i) => (
              <button
                type="button"
                className="card-slot-button"
                key={i}
                onClick={() => setActiveSlot(i)}
                aria-label={card ? `Change card ${i + 1} (currently ${card.rank} of ${card.suit})` : `Select card ${i + 1}`}
              >
                {card ? <PlayingCard card={card} size="md" /> : <div className="card-slot-empty">+</div>}
              </button>
            ))}
          </div>

          <label htmlFor="highHandAmount">Payout (optional)</label>
          <input
            id="highHandAmount"
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
          />

          <label htmlFor="highHandNotes">Notes (optional)</label>
          <textarea id="highHandNotes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />

          <button className="btn primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : highHand ? 'Update high hand' : 'Save high hand'}
          </button>
        </form>
      </div>

      {activeSlot !== null && (
        <CardPickerModal
          onSelect={handlePickCard}
          onClose={() => setActiveSlot(null)}
          disabledCards={cards.filter((c, i) => i !== activeSlot && c !== null) as Card[]}
        />
      )}
    </div>
  );
}
