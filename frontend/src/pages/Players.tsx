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
        {players.length === 0 ? (
          <div className="empty-state">No players added yet.</div>
        ) : (
          players
            .filter((p) => p.active)
            .map((p) => (
              <div key={p.playerId} className="rail-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <Link to={`/players/${p.playerId}`} className="rail-name" style={{ textDecoration: 'none', color: 'inherit' }}>
                  {p.firstName} {p.lastName}
                </Link>
                <span className="mono" style={{ color: 'var(--cream-dim)', fontSize: '0.82rem' }}>
                  joined {p.joinedDate}
                </span>
              </div>
            ))
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
        </>
      )}
    </div>
  );
}
