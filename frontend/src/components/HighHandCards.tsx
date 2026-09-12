import React from 'react';
import { HighHand } from '../types';
import { describeHand } from '../utils/handRank';
import PlayingCard from './PlayingCard';

// Read-only graphical display of a game's high hand: the five cards plus
// the player, the derived hand ranking (e.g. "Full House, Kings full of
// Fours"), and the optional payout. Shared between GameDetail (public) and
// GameManage (admin) so both stay visually identical.
export default function HighHandCards({
  highHand,
  size = 'md',
}: {
  highHand: HighHand | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!highHand) {
    return <div className="empty-state">No high hand recorded for this game yet.</div>;
  }

  return (
    <div>
      <p className="rail-name" style={{ fontFamily: 'var(--font-body)' }}>
        {highHand.playerName}
        {highHand.amount ? (
          <span style={{ color: 'var(--brass-bright)', fontWeight: 600 }}> &middot; ${highHand.amount}</span>
        ) : null}
      </p>
      <div className="high-hand-cards">
        {highHand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} size={size} />
        ))}
      </div>
      <p className="rail-meta">{describeHand(highHand.cards)}</p>
      {highHand.notes && (
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--cream-dim)', fontSize: '0.88rem' }}>
          {highHand.notes}
        </p>
      )}
    </div>
  );
}
