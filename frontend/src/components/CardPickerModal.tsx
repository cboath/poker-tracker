import React, { useEffect } from 'react';
import { Card, Rank, Suit } from '../types';
import PlayingCard from './PlayingCard';

const RANKS: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS: Suit[] = ['spades', 'hearts', 'clubs', 'diamonds'];

function cardKey(c: Card): string {
  return `${c.rank}-${c.suit}`;
}

// Full 52-card picker, grouped one suit per row. Cards already used
// elsewhere in the hand being built (`disabledCards`) render dimmed and
// unclickable -- a physical hand can't hold the same card twice. Closes on
// backdrop click or Escape, same as any lightweight modal.
export default function CardPickerModal({
  onSelect,
  onClose,
  disabledCards = [],
}: {
  onSelect: (card: Card) => void;
  onClose: () => void;
  disabledCards?: Card[];
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const disabledKeys = new Set(disabledCards.map(cardKey));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Select a card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 style={{ margin: 0 }}>Select a card</h3>
          <button className="btn" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <div className="card-picker-grid">
          {SUITS.map((suit) => (
            <div className="card-picker-row" key={suit}>
              {RANKS.map((rank) => {
                const card: Card = { rank, suit };
                const isDisabled = disabledKeys.has(cardKey(card));
                return (
                  <button
                    key={rank}
                    type="button"
                    className="card-picker-slot"
                    disabled={isDisabled}
                    onClick={() => onSelect(card)}
                    aria-label={`${rank} of ${suit}`}
                  >
                    <PlayingCard card={card} size="sm" />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
