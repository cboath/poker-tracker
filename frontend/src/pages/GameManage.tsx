import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { GameWithResults, Result } from '../types';
import { calculatePayouts, calculatePayoutStructure, PayoutRow, PayoutStructureRow } from '../utils/payouts';

// The /admin/games/:gameId view -- per the "the only thing on the page is
// the new game" request, this renders exactly one game: its results table
// (with inline finish-position editing and rebuys front and center) plus
// the payout calculator/preview, which operate on and are clearly part of
// this game rather than being create-form/other-games clutter. No
// create-form, no cross-game list here -- that's GameEntry's job.
export default function GameManage() {
  const { gameId } = useParams<{ gameId: string }>();
  const [activeGame, setActiveGame] = useState<GameWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payout calculation (client-side only, computed from activeGame.results)
  const [payoutResult, setPayoutResult] = useState<{
    totalPot: number;
    payouts: PayoutRow[];
    remainder: number;
  } | null>(null);

  // Pot-based payout structure preview (client-side only), available as soon
  // as there's a roster -- unlike `payoutResult` above, this doesn't require
  // any finish positions to be assigned yet.
  const [payoutStructureResult, setPayoutStructureResult] = useState<{
    totalPot: number;
    structure: PayoutStructureRow[];
    remainder: number;
  } | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let ignore = false;
    setLoading(true);
    setError(null);
    setActiveGame(null);
    setPayoutResult(null);
    setPayoutStructureResult(null);
    api
      .getGame(gameId)
      .then((g) => {
        if (ignore) return;
        setActiveGame(g);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [gameId]);

  // Re-fetch the game after any per-row edit (position save, rebuy, full
  // result save, or removal) so the table and payout calculators always
  // reflect what's actually saved server-side. Any previously calculated
  // payouts are cleared since they no longer necessarily match the results.
  async function refreshGame() {
    if (!activeGame) return;
    const refreshed = await api.getGame(activeGame.gameId);
    setActiveGame(refreshed);
    setPayoutResult(null);
    setPayoutStructureResult(null);
  }

  function showPayouts() {
    if (!activeGame) return;
    setPayoutResult(calculatePayouts(activeGame.results));
  }

  function showPayoutStructure() {
    if (!activeGame) return;
    setPayoutStructureResult(calculatePayoutStructure(activeGame.results));
  }

  if (!gameId) {
    return <div className="empty-state">No game selected.</div>;
  }
  if (loading) {
    return <div className="empty-state">Loading game...</div>;
  }
  if (error && !activeGame) {
    return <div className="empty-state">{error}</div>;
  }
  if (!activeGame) {
    return <div className="empty-state">Game not found.</div>;
  }

  return (
    <div>
      <h1>{activeGame.date}</h1>
      <p className="rail-meta">
        {activeGame.location ?? 'Location TBD'} &middot; {activeGame.entrantsCount} entrants
        {activeGame.totalPot ? ` · $${activeGame.totalPot} pot` : ''}
      </p>
      {error && <p style={{ color: 'var(--rail-red)' }}>{error}</p>}

      <div className="panel" style={{ marginTop: 20, marginBottom: 24 }}>
        <h3>Results</h3>
        {activeGame.results.length === 0 ? (
          <div className="empty-state">No players in this game yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Pos</th>
                <th>Player</th>
                <th>Points</th>
                <th>Buy-in</th>
                <th>Rebuys</th>
                <th>Winnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...activeGame.results]
                // Position-less (not-yet-scored) entrants sort to the end.
                .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
                .map((r) => (
                  <ResultRow
                    key={r.playerId}
                    gameId={activeGame.gameId}
                    result={r}
                    onSaved={refreshGame}
                    onError={setError}
                    onClearError={() => setError(null)}
                  />
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h3>Payouts</h3>
        <button className="btn" onClick={showPayouts} disabled={activeGame.results.length === 0}>
          Calculate Payouts
        </button>{' '}
        <button className="btn" onClick={showPayoutStructure} disabled={activeGame.results.length === 0}>
          Preview Payout Structure
        </button>
        {payoutStructureResult && (
          <div style={{ marginTop: 12, marginBottom: 20 }}>
            <p>Total pot: ${payoutStructureResult.totalPot.toFixed(2)}</p>
            <p className="rail-meta">
              Structure based on current entrants/pot &mdash; final payouts depend on who
              finishes where.
            </p>
            {payoutStructureResult.structure.length === 0 ? (
              <div className="empty-state">No entrants yet to preview a payout structure.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Place</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutStructureResult.structure.map((s) => (
                    <tr key={s.place}>
                      <td>{s.place}</td>
                      <td>${s.payout.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {payoutStructureResult.structure.length > 0 && payoutStructureResult.remainder !== 0 && (
              <p>
                {payoutStructureResult.remainder > 0
                  ? `Leftover after rounding: $${payoutStructureResult.remainder.toFixed(2)} (unpaid, e.g. keep for next game or split as you see fit)`
                  : `Rounding pays out $${Math.abs(payoutStructureResult.remainder).toFixed(2)} more than the pot (organizer covers the difference)`}
              </p>
            )}
          </div>
        )}
        {payoutResult && (
          <div style={{ marginTop: 12, marginBottom: 20 }}>
            <p>Total pot: ${payoutResult.totalPot.toFixed(2)}</p>
            {payoutResult.payouts.length === 0 ? (
              <div className="empty-state">No results recorded yet to calculate payouts.</div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutResult.payouts.map((p) => (
                    <tr key={p.playerId}>
                      <td>{p.position}</td>
                      <td style={{ fontFamily: 'var(--font-body)' }}>{p.playerName}</td>
                      <td>${p.payout.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {payoutResult.payouts.length > 0 && payoutResult.remainder !== 0 && (
              <p>
                {payoutResult.remainder > 0
                  ? `Leftover after rounding: $${payoutResult.remainder.toFixed(2)} (unpaid, e.g. keep for next game or split as you see fit)`
                  : `Rounding pays out $${Math.abs(payoutResult.remainder).toFixed(2)} more than the pot (organizer covers the difference)`}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// One row of the results table, plus its own de-emphasized "full result"
// disclosure. Owns its own draft state for the fields it can edit and talks
// to the API directly -- it's genuinely its own little editing unit (two
// independent save actions, each with several fields), which is why it's
// broken out of the parent's render rather than inlined in the `.map`.
function ResultRow({
  gameId,
  result,
  onSaved,
  onError,
  onClearError,
}: {
  gameId: string;
  result: Result;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
  onClearError: () => void;
}) {
  // Seeded once from `result` on mount only -- there is deliberately no
  // effect that resyncs these from the `result` prop on every re-render.
  // `result` is a brand-new object reference after *any* row's action
  // anywhere in the table (GameManage's onSaved refetches the whole game),
  // not just after this row's own save, so reacting to prop changes here
  // would silently blow away this row's unsaved draft edits whenever a
  // completely unrelated row did something. Instead, each save function
  // below updates its own drafts from its own successful response.
  const [positionDraft, setPositionDraft] = useState<number | ''>(result.position ?? '');
  const [savingPosition, setSavingPosition] = useState(false);

  const [buyInDraft, setBuyInDraft] = useState(result.buyIn);
  const [addOnsDraft, setAddOnsDraft] = useState(result.addOns);
  const [winningsDraft, setWinningsDraft] = useState(result.winnings);
  const [notesDraft, setNotesDraft] = useState(result.notes ?? '');
  const [savingAdvanced, setSavingAdvanced] = useState(false);

  const positionDirty = positionDraft !== (result.position ?? '');
  const advancedDirty =
    buyInDraft !== result.buyIn ||
    addOnsDraft !== result.addOns ||
    winningsDraft !== result.winnings ||
    notesDraft !== (result.notes ?? '');

  // upsertResult is a full PUT of the whole Result, not a patch -- every
  // field below must be present on every call. Position-only and
  // full-result saves each source the fields *they* don't own from
  // `result` (server truth), never from each other's drafts, so saving one
  // never clobbers an unsaved edit sitting in the other.
  async function savePosition() {
    onClearError();
    setSavingPosition(true);
    try {
      const saved = await api.upsertResult(gameId, result.playerId, {
        playerName: result.playerName,
        position: positionDraft === '' ? undefined : Number(positionDraft),
        buyIn: result.buyIn,
        rebuys: result.rebuys,
        addOns: result.addOns,
        winnings: result.winnings,
        notes: result.notes,
      });
      setPositionDraft(saved.position ?? '');
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingPosition(false);
    }
  }

  async function saveAdvanced() {
    onClearError();
    setSavingAdvanced(true);
    try {
      const saved = await api.upsertResult(gameId, result.playerId, {
        playerName: result.playerName,
        position: result.position,
        buyIn: buyInDraft,
        rebuys: result.rebuys,
        addOns: addOnsDraft,
        winnings: winningsDraft,
        notes: notesDraft || undefined,
      });
      setBuyInDraft(saved.buyIn);
      setAddOnsDraft(saved.addOns);
      setWinningsDraft(saved.winnings);
      setNotesDraft(saved.notes ?? '');
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingAdvanced(false);
    }
  }

  async function handleAddRebuy() {
    onClearError();
    try {
      await api.addRebuy(gameId, result.playerId);
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    }
  }

  async function handleRemove() {
    onClearError();
    try {
      await api.deleteResult(gameId, result.playerId);
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    }
  }

  return (
    <>
      <tr>
        <td>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePosition();
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <input
              type="number"
              min={1}
              value={positionDraft}
              onChange={(e) => setPositionDraft(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label={`Finish position for ${result.playerName}`}
              style={{ width: 60, marginBottom: 0 }}
            />
            <button className="btn" type="submit" disabled={!positionDirty || savingPosition}>
              Save
            </button>
          </form>
        </td>
        <td style={{ fontFamily: 'var(--font-body)' }}>{result.playerName}</td>
        <td>{result.points}</td>
        <td>${result.buyIn}</td>
        <td>{result.rebuyCount > 0 ? `${result.rebuyCount} ($${result.rebuys})` : '—'}</td>
        <td>${result.winnings}</td>
        <td>
          <button className="btn" onClick={handleAddRebuy}>
            Add Rebuy
          </button>{' '}
          <button className="btn" onClick={handleRemove} aria-label={`Remove ${result.playerName}'s result`}>
            Remove
          </button>
        </td>
      </tr>
      <tr>
        <td colSpan={7} style={{ paddingTop: 0 }}>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--cream-dim)', fontSize: '0.82rem' }}>
              Edit full result (buy-in, add-ons, winnings, notes)
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveAdvanced();
              }}
              style={{ marginTop: 12, maxWidth: 320 }}
            >
              <label htmlFor={`buyIn-${result.playerId}`}>Buy-in</label>
              <input
                id={`buyIn-${result.playerId}`}
                type="number"
                min={0}
                value={buyInDraft}
                onChange={(e) => setBuyInDraft(Number(e.target.value))}
              />
              <label htmlFor={`addOns-${result.playerId}`}>Add-ons</label>
              <input
                id={`addOns-${result.playerId}`}
                type="number"
                min={0}
                value={addOnsDraft}
                onChange={(e) => setAddOnsDraft(Number(e.target.value))}
              />
              <label htmlFor={`winnings-${result.playerId}`}>Winnings</label>
              <input
                id={`winnings-${result.playerId}`}
                type="number"
                min={0}
                value={winningsDraft}
                onChange={(e) => setWinningsDraft(Number(e.target.value))}
              />
              <label htmlFor={`notes-${result.playerId}`}>Notes (bad beats, highlights, etc.)</label>
              <textarea
                id={`notes-${result.playerId}`}
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={2}
              />
              <button className="btn primary" type="submit" disabled={!advancedDirty || savingAdvanced}>
                Save full result
              </button>
            </form>
          </details>
        </td>
      </tr>
    </>
  );
}
