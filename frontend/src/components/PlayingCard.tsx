import React from 'react';
import { Card } from '../types';

const SUIT_SYMBOL: Record<Card['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const RED_SUITS = new Set<Card['suit']>(['hearts', 'diamonds']);

// A single graphical playing card, styled to match the felt/cream/brass
// theme rather than a generic white card face. `size` scales the whole
// card proportionally so the same component works in a compact row
// (results table, history) or a larger hero display (high-hand panel).
export default function PlayingCard({
  card,
  size = 'md',
}: {
  card: Card;
  size?: 'sm' | 'md' | 'lg';
}) {
  const isRed = RED_SUITS.has(card.suit);
  const dims = { sm: { w: 40, h: 56 }, md: { w: 60, h: 84 }, lg: { w: 84, h: 118 } }[size];

  return (
    <div
      className="playing-card"
      style={{
        width: dims.w,
        height: dims.h,
        color: isRed ? 'var(--rail-red)' : 'var(--ink)',
        fontSize: size === 'sm' ? '0.7rem' : size === 'md' ? '0.85rem' : '1.1rem',
      }}
      aria-label={`${card.rank} of ${card.suit}`}
    >
      <span className="playing-card-corner playing-card-corner-top">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
      <span className="playing-card-pip">{SUIT_SYMBOL[card.suit]}</span>
      <span className="playing-card-corner playing-card-corner-bottom">
        {card.rank}
        <br />
        {SUIT_SYMBOL[card.suit]}
      </span>
    </div>
  );
}
