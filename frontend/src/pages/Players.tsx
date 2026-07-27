import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Player } from '../types';
import { useAuth } from '../auth/AuthContext';

export default function Players() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  // Inline edit state: the one player row currently being edited, if any.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');

  function load() {
    api.listPlayers().then(setPlayers).catch((e) => setError(e.message));
  }

  useEffect(load, []);

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    try {
      await api.createPlayer({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined });
      setFirstName('');
      setLastName('');
      setEmail('');
      setError(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function startEdit(p: Player) {
    setEditingId(p.playerId);
    setEditFirstName(p.firstName);
    setEditLastName(p.lastName);
    setEditEmail(p.email ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editFirstName.trim() || !editLastName.trim()) return;
    try {
      await api.updatePlayer(editingId, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        email: editEmail.trim() || undefined,
      });
      setEditingId(null);
      setError(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function deactivate(playerId: string) {
    try {
      await api.deactivatePlayer(playerId);
      setError(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function reactivate(playerId: string) {
    try {
      await api.updatePlayer(playerId, { active: true });
      setError(null);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1>Players</h1>
      {error && <div className="empty-state">{error}</div>}

      <div className="panel">
        {players.filter((p) => p.active).length === 0 ? (
          <div className="empty-state">No players added yet.</div>
        ) : (
          players
            .filter((p) => p.active)
            .map((p) =>
              editingId === p.playerId ? (
                <form key={p.playerId} onSubmit={saveEdit} className="rail-row" style={{ gridTemplateColumns: '1fr 1fr 1fr auto auto' }}>
                  <input aria-label="First name" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="First" />
                  <input aria-label="Last name" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Last" />
                  <input aria-label="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="name@example.com" />
                  <button className="btn primary" type="submit">
                    Save
                  </button>
                  <button className="btn" type="button" onClick={cancelEdit}>
                    Cancel
                  </button>
                </form>
              ) : (
                <div key={p.playerId} className="rail-row" style={{ gridTemplateColumns: isAuthenticated ? '1fr auto auto auto' : '1fr auto' }}>
                  <Link to={`/players/${p.playerId}`} className="rail-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                    {p.firstName} {p.lastName}
                  </Link>
                  <span className="mono" style={{ color: 'var(--cream-dim)', fontSize: '0.82rem' }}>
                    joined {p.joinedDate}
                  </span>
                  {isAuthenticated && (
                    <>
                      <button className="btn" type="button" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button className="btn" type="button" onClick={() => deactivate(p.playerId)}>
                        Deactivate
                      </button>
                    </>
                  )}
                </div>
              )
            )
        )}
      </div>

      {isAuthenticated && (
        <>
          <div className="suit-divider">&clubs; &diams; &hearts; &spades;</div>
          <div className="panel">
            <h3>Add a player</h3>
            <form onSubmit={addPlayer}>
              <label htmlFor="firstName">First name</label>
              <input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First" />
              <label htmlFor="lastName">Last name</label>
              <input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last" />
              <label htmlFor="email">Email (optional)</label>
              <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
              <button className="btn primary" type="submit">
                Add player
              </button>
            </form>
          </div>

          {players.some((p) => !p.active) && (
            <>
              <div className="suit-divider">&clubs; &diams; &hearts; &spades;</div>
              <div className="panel">
                <h3>Inactive players</h3>
                {players
                  .filter((p) => !p.active)
                  .map((p) => (
                    <div key={p.playerId} className="rail-row" style={{ gridTemplateColumns: '1fr auto' }}>
                      <span className="rail-name">
                        {p.firstName} {p.lastName}
                      </span>
                      <button className="btn" type="button" onClick={() => reactivate(p.playerId)}>
                        Reactivate
                      </button>
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
