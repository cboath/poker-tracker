import { describe, it, expect } from 'vitest';
import { describeHand } from './handRank';
import { Card } from '../types';

function c(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

describe('describeHand', () => {
  it('recognizes a royal flush', () => {
    const hand = [c('A', 'spades'), c('K', 'spades'), c('Q', 'spades'), c('J', 'spades'), c('10', 'spades')];
    expect(describeHand(hand)).toBe('Royal Flush');
  });

  it('recognizes a straight flush below ace-high', () => {
    const hand = [c('9', 'hearts'), c('8', 'hearts'), c('7', 'hearts'), c('6', 'hearts'), c('5', 'hearts')];
    expect(describeHand(hand)).toBe('Straight Flush, Nines high');
  });

  it('recognizes four of a kind', () => {
    const hand = [c('K', 'hearts'), c('K', 'spades'), c('K', 'diamonds'), c('K', 'clubs'), c('2', 'clubs')];
    expect(describeHand(hand)).toBe('Four of a Kind, Kings');
  });

  it('recognizes a full house', () => {
    const hand = [c('K', 'hearts'), c('K', 'spades'), c('K', 'diamonds'), c('4', 'clubs'), c('4', 'hearts')];
    expect(describeHand(hand)).toBe('Full House, Kings full of Fours');
  });

  it('recognizes a flush', () => {
    const hand = [c('2', 'clubs'), c('5', 'clubs'), c('9', 'clubs'), c('J', 'clubs'), c('K', 'clubs')];
    expect(describeHand(hand)).toBe('Flush, Kings high');
  });

  it('recognizes a straight, including the wheel (ace-low)', () => {
    const straight = [c('6', 'hearts'), c('7', 'spades'), c('8', 'diamonds'), c('9', 'clubs'), c('10', 'hearts')];
    expect(describeHand(straight)).toBe('Straight, Tens high');

    const wheel = [c('A', 'hearts'), c('2', 'spades'), c('3', 'diamonds'), c('4', 'clubs'), c('5', 'hearts')];
    expect(describeHand(wheel)).toBe('Straight, Fives high');
  });

  it('recognizes three of a kind', () => {
    const hand = [c('7', 'hearts'), c('7', 'spades'), c('7', 'diamonds'), c('2', 'clubs'), c('9', 'hearts')];
    expect(describeHand(hand)).toBe('Three of a Kind, Sevens');
  });

  it('recognizes two pair, higher pair named first', () => {
    const hand = [c('4', 'hearts'), c('4', 'spades'), c('9', 'diamonds'), c('9', 'clubs'), c('2', 'hearts')];
    expect(describeHand(hand)).toBe('Two Pair, Nines and Fours');
  });

  it('recognizes a pair', () => {
    const hand = [c('Q', 'hearts'), c('Q', 'spades'), c('9', 'diamonds'), c('4', 'clubs'), c('2', 'hearts')];
    expect(describeHand(hand)).toBe('Pair, Queens');
  });

  it('recognizes high card', () => {
    const hand = [c('K', 'hearts'), c('9', 'spades'), c('7', 'diamonds'), c('4', 'clubs'), c('2', 'hearts')];
    expect(describeHand(hand)).toBe('High Card, Kings high');
  });

  it('returns empty string for a hand that is not exactly 5 cards', () => {
    expect(describeHand([c('A', 'spades')])).toBe('');
  });
});
