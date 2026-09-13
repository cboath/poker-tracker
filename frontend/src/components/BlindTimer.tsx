import React, { useEffect, useRef, useState } from 'react';
import { BlindTimerState } from '../types';
import { blindsForLevel, DEFAULT_LEVEL_DURATION_SECONDS } from '../utils/blinds';

export function defaultBlindTimerState(): BlindTimerState {
  return {
    levelIndex: 0,
    levelDurationSeconds: DEFAULT_LEVEL_DURATION_SECONDS,
    running: false,
    remainingSeconds: DEFAULT_LEVEL_DURATION_SECONDS,
  };
}

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}

/** Seconds remaining in the current level right now, derived rather than ticked. */
function remainingSecondsNow(state: BlindTimerState): number {
  if (state.running && state.levelEndsAt) {
    return Math.max(0, (new Date(state.levelEndsAt).getTime() - Date.now()) / 1000);
  }
  return state.remainingSeconds;
}

// The game page's hand/blind timer -- counts down a level, shows the
// current SB/BB (see utils/blinds.ts), and auto-advances to the next level
// on hitting zero. State is persisted to the game record via `onChange`
// (a thin wrapper around api.updateGame from GameManage) so it survives a
// page refresh; there's no live push to other viewers, just refresh-safety
// for whoever's running it.
export default function BlindTimer({
  state,
  onChange,
  readOnly,
}: {
  state: BlindTimerState;
  // Optional in read-only mode (the public GameDetail view): a spectator's
  // page shouldn't write timer state, so it just displays the countdown as
  // fetched and relies on GameDetail's own polling to pick up whatever the
  // organizer's session persists (start/pause/skip/level-advance) -- see the
  // guard on the auto-advance effect below.
  onChange?: (next: BlindTimerState) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [, forceTick] = useState(0);
  const advancingRef = useRef(false);

  useEffect(() => {
    if (!state.running) return;
    const interval = setInterval(() => forceTick((n) => n + 1), 250);
    return () => clearInterval(interval);
  }, [state.running]);

  const remaining = remainingSecondsNow(state);

  useEffect(() => {
    if (readOnly || !onChange) return;
    if (state.running && remaining <= 0 && !advancingRef.current) {
      advancingRef.current = true;
      const next: BlindTimerState = {
        ...state,
        levelIndex: state.levelIndex + 1,
        remainingSeconds: state.levelDurationSeconds,
        levelEndsAt: new Date(Date.now() + state.levelDurationSeconds * 1000).toISOString(),
      };
      Promise.resolve(onChange(next)).finally(() => {
        advancingRef.current = false;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.running, remaining <= 0, readOnly]);

  function start() {
    onChange?.({
      ...state,
      running: true,
      levelEndsAt: new Date(Date.now() + remaining * 1000).toISOString(),
    });
  }

  function pause() {
    onChange?.({ ...state, running: false, remainingSeconds: remaining, levelEndsAt: undefined });
  }

  function resetLevel() {
    onChange?.({
      ...state,
      remainingSeconds: state.levelDurationSeconds,
      levelEndsAt: state.running
        ? new Date(Date.now() + state.levelDurationSeconds * 1000).toISOString()
        : undefined,
    });
  }

  function skipLevel() {
    onChange?.({
      ...state,
      levelIndex: state.levelIndex + 1,
      remainingSeconds: state.levelDurationSeconds,
      levelEndsAt: state.running
        ? new Date(Date.now() + state.levelDurationSeconds * 1000).toISOString()
        : undefined,
    });
  }

  function resetTournament() {
    onChange?.({
      ...state,
      levelIndex: 0,
      remainingSeconds: state.levelDurationSeconds,
      levelEndsAt: state.running
        ? new Date(Date.now() + state.levelDurationSeconds * 1000).toISOString()
        : undefined,
    });
  }

  function setDurationMinutes(minutes: number) {
    const levelDurationSeconds = Math.max(1, Math.round(minutes * 60));
    onChange?.({
      ...state,
      levelDurationSeconds,
      remainingSeconds: state.running ? state.remainingSeconds : levelDurationSeconds,
      levelEndsAt: state.running
        ? new Date(Date.now() + levelDurationSeconds * 1000).toISOString()
        : undefined,
    });
  }

  const { bigBlind, smallBlind } = blindsForLevel(state.levelIndex);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '2rem', fontFamily: 'var(--font-display, inherit)' }}>
          {formatClock(remaining)}
        </div>
        <div>
          <div className="rail-meta">Level {state.levelIndex + 1}</div>
          <div>
            Blinds: ${smallBlind} / ${bigBlind}
          </div>
        </div>
      </div>

      {!readOnly && (
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {state.running ? (
            <button className="btn" onClick={pause}>
              Pause
            </button>
          ) : (
            <button className="btn primary" onClick={start}>
              Start
            </button>
          )}
          <button className="btn" onClick={resetLevel}>
            Reset level
          </button>
          <button className="btn" onClick={skipLevel}>
            Next level
          </button>
          <button className="btn" onClick={resetTournament}>
            Reset to level 1
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            Minutes per level
            <input
              type="number"
              min={1}
              value={Math.round((state.levelDurationSeconds / 60) * 100) / 100}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              style={{ width: 64, marginBottom: 0 }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
