import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { BlindTimerState, GameWithResults, HighHand, Player, Result } from '../types';
import { calculatePayouts, calculatePayoutStructure, PayoutRow, PayoutStructureRow } from '../utils/payouts';
import { calculateHighHandPot } from '../utils/highHandPot';
import HighHandCards from '../components/HighHandCards';
import AddPlayersModal from '../components/AddPlayersModal';
import HighHandModal from '../components/HighHandModal';
import BlindTimer, { defaultBlindTimerState } from '../components/BlindTimer';

// Formats a finish place as "1st", "2nd", "3rd", "4th", etc. -- used to
// label the "Knocked Out" button with the place it's about to record.
function ordinal(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) return `${n}st`;
  if (j === 2 && k !== 12) return `${n}nd`;
  if (j === 3 && k !== 13) return `${n}rd`;
  return `${n}th`;
}

// The /admin/games/:gameId view -- per the "the only thing on the page is
// the new game" request, this renders exactly one game: its results table
// (with inline finish-position editing and rebuys front and center) plus
// the payout calculator/preview, which operate on and are clearly part of
// this game rather than being create-form/other-games clutter. No
// create-form, no cross-game list here -- that's GameEntry's job.
export default function GameManage() {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState<GameWithResults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finishNotice, setFinishNotice] = useState<string | null>(null);

  // "Add Players" modal (opened from the Results panel): lets an admin
  // check off any number of players not already on the roster and attach
  // them all at once (one POST /games/{gameId}/players per checked player),
  // the same "roster entrant, finish TBD" shape createGame's roster
  // produces -- but usable after the game exists, unlike GameEntry's roster
  // builder which only runs at creation.
  const [players, setPlayers] = useState<Player[]>([]);
  const [showAddPlayers, setShowAddPlayers] = useState(false);

  // Selection for a tied-knockout: still-playing players checked off to be
  // knocked out together, sharing one finish position (see handleTieKnockOut).
  const [tieSelection, setTieSelection] = useState<Set<string>>(new Set());
  const [tieKnockingOut, setTieKnockingOut] = useState(false);

  // Admin override for how many places get paid (blank = auto, the default
  // "pay up to 3, capped by how many are scored" behavior in payouts.ts).
  const [placesPaid, setPlacesPaid] = useState<number | ''>('');
  const placesPaidNumber = placesPaid === '' ? undefined : Number(placesPaid);

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
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }, []);

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
  // payouts are recomputed from the fresh results (using the same "places
  // paid" override, if any) rather than just cleared, so an admin viewing
  // the payout preview doesn't lose it every time they touch an unrelated
  // row -- if it wasn't being shown, this is a no-op.
  async function refreshGame() {
    if (!activeGame) return;
    const refreshed = await api.getGame(activeGame.gameId);
    setActiveGame(refreshed);
    setPayoutResult((prev) => (prev ? calculatePayouts(refreshed.results, placesPaidNumber) : null));
    setPayoutStructureResult((prev) =>
      prev ? calculatePayoutStructure(refreshed.results, placesPaidNumber) : null
    );
  }

  async function handleAddPlayers(
    selected: { playerId: string; playerName: string; buyIn: number; highHandOptIn: boolean }[]
  ) {
    if (!activeGame) return;
    setError(null);
    await Promise.all(
      selected.map((p) => api.addPlayerToGame(activeGame.gameId, p))
    );
    await refreshGame();
    setShowAddPlayers(false);
  }

  // Persists a blind-timer state change (Start/Pause/Skip/Reset/duration
  // edit, all from BlindTimer) via the same PUT /games/{gameId} endpoint
  // used elsewhere on this page -- updated optimistically in local state so
  // the countdown doesn't stutter waiting on the round trip.
  async function handleBlindTimerChange(next: BlindTimerState) {
    if (!activeGame) return;
    setActiveGame({ ...activeGame, blindTimer: next });
    try {
      await api.updateGame(activeGame.gameId, { blindTimer: next });
    } catch (err: any) {
      setError(err.message);
    }
  }

  // Knocks out every currently-selected still-playing player together,
  // tied for the same finish position. Generalizes the single "Knocked Out"
  // button's math: if N players are eliminated together while R players
  // (the group included) still lack a position, they all finish at
  // R - N + 1 -- for N=1 that's exactly `remainingCount`, so a normal single
  // knockout is just this formula's N=1 case.
  async function handleTieKnockOut() {
    if (!activeGame) return;
    const selected = activeGame.results.filter(
      (r) => r.position === undefined && tieSelection.has(r.playerId)
    );
    if (selected.length < 2) return;
    setError(null);
    setTieKnockingOut(true);
    try {
      const remainingCount = activeGame.results.filter((r) => r.position === undefined).length;
      const position = remainingCount - selected.length + 1;
      await Promise.all(
        selected.map((r) =>
          api.upsertResult(activeGame.gameId, r.playerId, {
            playerName: r.playerName,
            position,
            buyIn: r.buyIn,
            rebuys: r.rebuys,
            addOns: r.addOns,
            winnings: r.winnings,
            notes: r.notes,
          })
        )
      );
      setTieSelection(new Set());
      await refreshGame();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTieKnockingOut(false);
    }
  }

  function toggleTieSelection(playerId: string) {
    setTieSelection((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  function showPayouts() {
    if (!activeGame) return;
    setPayoutResult(calculatePayouts(activeGame.results, placesPaidNumber));
  }

  function showPayoutStructure() {
    if (!activeGame) return;
    setPayoutStructureResult(calculatePayoutStructure(activeGame.results, placesPaidNumber));
  }

  // "Finish Game": computes the payout for each paid finisher (same
  // calculatePayouts used by the preview above) and writes it into that
  // player's `winnings`, persisting the payout rather than just previewing
  // it. upsertResult is a full PUT, so each call carries the player's other
  // fields through unchanged (sourced from server-truth `activeGame.results`,
  // never from another row's draft) with only `winnings` replaced.
  async function handleFinishGame() {
    if (!activeGame) return;
    setError(null);
    setFinishNotice(null);
    const { payouts } = calculatePayouts(activeGame.results, placesPaidNumber);
    if (payouts.length === 0) {
      setError('No finish positions recorded yet -- nothing to pay out.');
      return;
    }
    const unplacedCount = activeGame.results.filter((r) => r.position === undefined).length;
    if (
      unplacedCount > 0 &&
      !window.confirm(
        `${unplacedCount} player(s) still don't have a finish position and won't be paid. Finish the game anyway?`
      )
    ) {
      return;
    }
    setFinishing(true);
    try {
      await Promise.all(
        payouts.map((p) => {
          const result = activeGame.results.find((r) => r.playerId === p.playerId)!;
          return api.upsertResult(activeGame.gameId, p.playerId, {
            playerName: result.playerName,
            position: result.position,
            buyIn: result.buyIn,
            rebuys: result.rebuys,
            addOns: result.addOns,
            winnings: p.payout,
            notes: result.notes,
          });
        })
      );
      await refreshGame();
      setFinishNotice('Game finished -- payouts saved to the winners below.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setFinishing(false);
    }
  }

  // Lets an admin override one player's calculated payout directly in the
  // payout preview table (e.g. the tier split isn't quite how the table
  // wants to divide it up) -- writes straight to that player's `winnings`
  // via the same upsertResult PUT used everywhere else, then updates both
  // the payout preview and the results table's local copy without a full
  // page reload.
  async function savePayoutOverride(playerId: string, amount: number) {
    if (!activeGame) return;
    const result = activeGame.results.find((r) => r.playerId === playerId);
    if (!result) return;
    setError(null);
    try {
      const saved = await api.upsertResult(activeGame.gameId, playerId, {
        playerName: result.playerName,
        position: result.position,
        buyIn: result.buyIn,
        rebuys: result.rebuys,
        addOns: result.addOns,
        winnings: amount,
        notes: result.notes,
      });
      setActiveGame({
        ...activeGame,
        results: activeGame.results.map((r) => (r.playerId === playerId ? saved : r)),
      });
      setPayoutResult((prev) =>
        prev
          ? {
              ...prev,
              payouts: prev.payouts.map((p) =>
                p.playerId === playerId ? { ...p, payout: saved.winnings } : p
              ),
            }
          : prev
      );
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function toggleArchived() {
    if (!activeGame) return;
    setError(null);
    setArchiving(true);
    try {
      const updated = activeGame.archived
        ? await api.unarchiveGame(activeGame.gameId)
        : await api.archiveGame(activeGame.gameId);
      setActiveGame({ ...activeGame, archived: updated.archived });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setArchiving(false);
    }
  }

  async function handleDeleteGame() {
    if (!activeGame) return;
    if (
      !window.confirm(
        `Permanently delete this game and all ${activeGame.results.length} recorded result(s)? This cannot be undone.`
      )
    ) {
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      await api.deleteGame(activeGame.gameId);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message);
      setDeleting(false);
    }
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
      <h1>{activeGame.date}{activeGame.archived ? ' (Archived)' : ''}</h1>
      <p className="rail-meta">
        {activeGame.location ?? 'Location TBD'} &middot; {activeGame.entrantsCount} entrants
        {activeGame.totalPot ? ` · $${activeGame.totalPot} pot` : ''}
      </p>
      {error && <p style={{ color: 'var(--rail-red)' }}>{error}</p>}

      <div className="panel" style={{ marginTop: 20, marginBottom: 24 }}>
        <h3>Blind Timer</h3>
        <BlindTimer
          state={activeGame.blindTimer ?? defaultBlindTimerState()}
          onChange={handleBlindTimerChange}
        />
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <h3>Results</h3>
          <button className="btn" onClick={() => setShowAddPlayers(true)}>
            Add Player(s)
          </button>
        </div>
        {tieSelection.size >= 2 && (
          <p style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {tieSelection.size} players selected for a tied knockout.{' '}
            <button className="btn primary" onClick={handleTieKnockOut} disabled={tieKnockingOut}>
              {tieKnockingOut ? 'Saving...' : 'Knock out selected (tied)'}
            </button>
          </p>
        )}
        {activeGame.results.length === 0 ? (
          <div className="empty-state">No players in this game yet.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Pos</th>
                <th>Player</th>
                <th title="Opted into the high hand pot">HH</th>
                <th>Points</th>
                <th>Buy-in</th>
                <th>Rebuys</th>
                <th>Winnings</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {[...activeGame.results]
                // Still-playing entrants (no position yet) stay on top; a
                // "Knocked Out" click gives a real (finite) position, which
                // sorts below every -Infinity (still-playing) row instead of
                // jumping above them -- so knocking someone out moves their
                // row down to the bottom, never up to the top.
                .sort((a, b) => (a.position ?? -Infinity) - (b.position ?? -Infinity))
                .map((r) => (
                  <ResultRow
                    key={r.playerId}
                    gameId={activeGame.gameId}
                    result={r}
                    // How many entrants still lack a finish position, r included --
                    // the place a "Knocked Out" click on r would assign, since
                    // everyone still standing outranks whoever leaves next.
                    remainingCount={activeGame.results.filter((x) => x.position === undefined).length}
                    tieSelected={tieSelection.has(r.playerId)}
                    onToggleTieSelected={() => toggleTieSelection(r.playerId)}
                    onSaved={refreshGame}
                    onError={setError}
                    onClearError={() => setError(null)}
                  />
                ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 24 }}>
        <h3>High Hand</h3>
        <HighHandPanel
          gameId={activeGame.gameId}
          highHandBuyIn={activeGame.highHandBuyIn}
          results={activeGame.results}
          highHand={activeGame.highHand}
          onSaved={refreshGame}
          onError={setError}
          onClearError={() => setError(null)}
        />
      </div>

      <div className="panel">
        <h3>Payouts</h3>
        <label htmlFor="placesPaid" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 16 }}>
          Places paid (blank = auto)
          <input
            id="placesPaid"
            type="number"
            min={1}
            value={placesPaid}
            onChange={(e) => setPlacesPaid(e.target.value === '' ? '' : Number(e.target.value))}
            style={{ width: 64, marginBottom: 0 }}
          />
        </label>
        <button className="btn" onClick={showPayouts} disabled={activeGame.results.length === 0}>
          Calculate Payouts
        </button>{' '}
        <button className="btn" onClick={showPayoutStructure} disabled={activeGame.results.length === 0}>
          Preview Payout Structure
        </button>{' '}
        <button
          className="btn primary"
          onClick={handleFinishGame}
          disabled={finishing || activeGame.results.every((r) => r.position === undefined)}
        >
          {finishing ? 'Finishing...' : 'Finish Game'}
        </button>
        {finishNotice && <p style={{ color: 'var(--brass-bright)' }}>{finishNotice}</p>}
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
                      <td>
                        <PayoutAmountEditor
                          payout={p.payout}
                          playerName={p.playerName}
                          onSave={(amount) => savePayoutOverride(p.playerId, amount)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="rail-meta">Override any payout above if it needs to differ from the calculated split.</p>
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

      <div className="panel" style={{ marginTop: 24, borderColor: 'var(--rail-red)' }}>
        <h3>Danger Zone</h3>
        <p className="rail-meta">
          {activeGame.archived
            ? 'This game is archived: it is hidden from the season history and standings, but its data is untouched.'
            : 'Archiving hides this game from the season history and standings without deleting any data.'}
        </p>
        <button className="btn" onClick={toggleArchived} disabled={archiving}>
          {archiving
            ? 'Saving...'
            : activeGame.archived
              ? 'Unarchive game'
              : 'Archive game'}
        </button>{' '}
        <button
          className="btn"
          style={{ color: 'var(--rail-red)', borderColor: 'var(--rail-red)' }}
          onClick={handleDeleteGame}
          disabled={deleting}
        >
          {deleting ? 'Deleting...' : 'Delete game permanently'}
        </button>
      </div>

      {showAddPlayers && (
        <AddPlayersModal
          players={players.filter(
            (p) => p.active && !activeGame.results.some((r) => r.playerId === p.playerId)
          )}
          defaultBuyIn={activeGame.buyInAmount ?? ''}
          highHandBuyIn={activeGame.highHandBuyIn}
          onClose={() => setShowAddPlayers(false)}
          onSubmit={handleAddPlayers}
        />
      )}
    </div>
  );
}

// A single editable payout amount in the "Calculate Payouts" preview table --
// lets an admin override the tier-calculated split for one player (e.g. the
// group wants a different cut than the formula produced). Auto-saves on
// blur, matching the position/winnings inputs in the results table below;
// seeded once from the calculated `payout` on mount rather than resyncing on
// every prop change, same reasoning as ResultRow's drafts (a payout preview
// recomputed for an unrelated row shouldn't blow away this one's edit).
function PayoutAmountEditor({
  payout,
  playerName,
  onSave,
}: {
  payout: number;
  playerName: string;
  onSave: (amount: number) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(payout);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === payout || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="number"
      min={0}
      value={draft}
      onChange={(e) => setDraft(Number(e.target.value))}
      onBlur={save}
      disabled={saving}
      aria-label={`Payout for ${playerName}`}
      style={{ width: 80, marginBottom: 0 }}
    />
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
  remainingCount,
  tieSelected,
  onToggleTieSelected,
  onSaved,
  onError,
  onClearError,
}: {
  gameId: string;
  result: Result;
  remainingCount: number;
  tieSelected: boolean;
  onToggleTieSelected: () => void;
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
  const [notesDraft, setNotesDraft] = useState(result.notes ?? '');
  const [savingAdvanced, setSavingAdvanced] = useState(false);
  const [knockingOut, setKnockingOut] = useState(false);

  const [winningsDraft, setWinningsDraft] = useState<number>(result.winnings);
  const [savingWinnings, setSavingWinnings] = useState(false);

  const positionDirty = positionDraft !== (result.position ?? '');
  const winningsDirty = winningsDraft !== result.winnings;
  const advancedDirty =
    buyInDraft !== result.buyIn ||
    addOnsDraft !== result.addOns ||
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

  // "Knocked Out" -- a shortcut for savePosition that fills in the finish
  // position automatically instead of the admin typing it: whoever is
  // knocked out next finishes in `remainingCount` place, since everyone
  // still standing (this player included, until now) necessarily outlasts
  // them. The last player left un-eliminated has remainingCount 1, so
  // clicking it for them correctly records a 1st-place finish -- there's no
  // separate "declare the winner" action needed.
  async function handleKnockOut() {
    onClearError();
    setKnockingOut(true);
    try {
      const saved = await api.upsertResult(gameId, result.playerId, {
        playerName: result.playerName,
        position: remainingCount,
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
      setKnockingOut(false);
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
        winnings: result.winnings,
        notes: notesDraft || undefined,
      });
      setBuyInDraft(saved.buyIn);
      setAddOnsDraft(saved.addOns);
      setNotesDraft(saved.notes ?? '');
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingAdvanced(false);
    }
  }

  // Winnings/payout gets its own always-visible inline editor (mirroring the
  // Position cell) rather than living in the "Edit full result" disclosure,
  // so adjusting a payout -- including after clicking "Finish Game" -- is a
  // direct, discoverable action instead of something buried in a collapsed
  // form. There's no "finished" lock anywhere in this app; this is purely
  // about making an always-available edit easy to find.
  async function saveWinnings() {
    onClearError();
    setSavingWinnings(true);
    try {
      const saved = await api.upsertResult(gameId, result.playerId, {
        playerName: result.playerName,
        position: result.position,
        buyIn: result.buyIn,
        rebuys: result.rebuys,
        addOns: result.addOns,
        winnings: winningsDraft,
        notes: result.notes,
      });
      setWinningsDraft(saved.winnings);
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingWinnings(false);
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
          {result.position === undefined && (
            <input
              type="checkbox"
              checked={tieSelected}
              onChange={onToggleTieSelected}
              aria-label={`Select ${result.playerName} for a tied knockout`}
              style={{ width: 'auto', marginBottom: 0 }}
            />
          )}
        </td>
        <td>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              savePosition();
            }}
          >
            <input
              type="number"
              min={1}
              value={positionDraft}
              onChange={(e) => setPositionDraft(e.target.value === '' ? '' : Number(e.target.value))}
              onBlur={() => positionDirty && !savingPosition && savePosition()}
              aria-label={`Finish position for ${result.playerName}`}
              style={{ width: 60, marginBottom: 0 }}
            />
          </form>
        </td>
        <td style={{ fontFamily: 'var(--font-body)' }}>{result.playerName}</td>
        <td style={{ textAlign: 'center' }} aria-label={result.highHandOptIn ? `${result.playerName} opted into the high hand pot` : undefined}>
          {result.highHandOptIn ? (
            <span style={{ color: '#2196f3', fontSize: '1.3em', fontWeight: 'bold' }}>✓</span>
          ) : (
            ''
          )}
        </td>
        <td>{result.points}</td>
        <td>${result.buyIn}</td>
        <td>{result.rebuyCount > 0 ? `${result.rebuyCount} ($${result.rebuys})` : '—'}</td>
        <td>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveWinnings();
            }}
          >
            <input
              type="number"
              min={0}
              value={winningsDraft}
              onChange={(e) => setWinningsDraft(Number(e.target.value))}
              onBlur={() => winningsDirty && !savingWinnings && saveWinnings()}
              aria-label={`Winnings for ${result.playerName}`}
              style={{ width: 70, marginBottom: 0 }}
            />
          </form>
        </td>
        <td>
          {result.position === undefined && (
            <>
              <button className="btn primary" onClick={handleKnockOut} disabled={knockingOut}>
                {knockingOut
                  ? 'Saving...'
                  : remainingCount === 1
                    ? 'Winner!'
                    : `K.O. (${ordinal(remainingCount)})`}
              </button>{' '}
              <button className="btn" onClick={handleAddRebuy}>
                Add Rebuy
              </button>{' '}
              <button className="btn" onClick={handleRemove} aria-label={`Remove ${result.playerName}'s result`}>
                Remove
              </button>
            </>
          )}
        </td>
      </tr>
      <tr>
        <td colSpan={9} style={{ paddingTop: 0 }}>
          <details>
            <summary style={{ cursor: 'pointer', color: 'var(--cream-dim)', fontSize: '0.82rem' }}>
              Edit full result (buy-in, add-ons, notes)
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

// The "High Hand" panel -- shows the current high hand (if any) plus a
// button that opens HighHandModal to set/edit it, mirroring the Results
// panel's "Add Player(s)" button opening AddPlayersModal. Removing a
// recorded high hand is a single immediate action, so it stays here rather
// than living inside the modal.
function HighHandPanel({
  gameId,
  highHandBuyIn,
  results,
  highHand,
  onSaved,
  onError,
  onClearError,
}: {
  gameId: string;
  highHandBuyIn?: number;
  results: Result[];
  highHand: HighHand | null | undefined;
  onSaved: () => void | Promise<void>;
  onError: (message: string) => void;
  onClearError: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // The high hand buy-in amount used to only be settable at game creation
  // (GameEntry), which meant a game created without one -- or created
  // before this feature existed -- had no way to ever get one, so the
  // "high hand pot" checkbox on the Add Player(s) modal could never appear
  // (it's gated on this being truthy). Editable here too now, via the same
  // PUT /games/{gameId} merge the blind timer and archive toggle already use.
  const [buyInDraft, setBuyInDraft] = useState<number | ''>(highHandBuyIn ?? '');
  const [savingBuyIn, setSavingBuyIn] = useState(false);
  const buyInDirty = buyInDraft !== (highHandBuyIn ?? '');

  async function saveBuyIn() {
    onClearError();
    setSavingBuyIn(true);
    try {
      const saved = await api.updateGame(gameId, {
        highHandBuyIn: buyInDraft === '' ? undefined : Number(buyInDraft),
      });
      setBuyInDraft(saved.highHandBuyIn ?? '');
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSavingBuyIn(false);
    }
  }

  async function handleRemove() {
    onClearError();
    setRemoving(true);
    try {
      await api.deleteHighHand(gameId);
      await onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  const { participantCount, total } = calculateHighHandPot({ highHandBuyIn }, results);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveBuyIn();
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}
      >
        <label htmlFor="highHandBuyIn" style={{ marginBottom: 0 }}>
          High hand pot buy-in per player
        </label>
        <input
          id="highHandBuyIn"
          type="number"
          min={0}
          value={buyInDraft}
          onChange={(e) => setBuyInDraft(e.target.value === '' ? '' : Number(e.target.value))}
          style={{ width: 80, marginBottom: 0 }}
        />
        <button className="btn" type="submit" disabled={!buyInDirty || savingBuyIn}>
          {savingBuyIn ? 'Saving...' : 'Save'}
        </button>
      </form>
      {!!highHandBuyIn && (
        <p className="rail-meta">
          {participantCount} player{participantCount === 1 ? '' : 's'} opted in at ${highHandBuyIn}{' '}
          each &mdash; ${total} pot
        </p>
      )}
      {highHand ? (
        <div style={{ marginBottom: 20 }}>
          <HighHandCards highHand={highHand} size="md" />
          <button className="btn" onClick={() => setShowModal(true)}>
            Edit high hand
          </button>{' '}
          <button className="btn" onClick={handleRemove} disabled={removing}>
            {removing ? 'Removing...' : 'Remove high hand'}
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          <div className="empty-state">No high hand recorded for this game yet.</div>
          <button className="btn primary" onClick={() => setShowModal(true)}>
            Set high hand
          </button>
        </div>
      )}

      {showModal && (
        <HighHandModal
          gameId={gameId}
          results={results}
          highHand={highHand}
          onClose={() => setShowModal(false)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
