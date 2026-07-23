import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { signIn, confirmNewPassword, needsNewPassword } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      if (!needsNewPassword) navigate('/admin');
    } catch (err: any) {
      setError(err.message ?? 'Sign in failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await confirmNewPassword(newPassword);
      navigate('/admin');
    } catch (err: any) {
      setError(err.message ?? 'Failed to set new password');
    } finally {
      setLoading(false);
    }
  }

  if (needsNewPassword) {
    return (
      <div style={{ maxWidth: 380, margin: '40px auto' }}>
        <h1>Set a new password</h1>
        <div className="panel">
          <form onSubmit={handleNewPassword}>
            <label htmlFor="new-password">New password</label>
            <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoFocus />
            <label htmlFor="confirm-password">Confirm new password</label>
            <input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            {error && <p style={{ color: 'var(--rail-red)', fontSize: '0.85rem' }}>{error}</p>}
            <button className="btn primary" type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Set password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: '40px auto' }}>
      <h1>Admin login</h1>
      <div className="panel">
        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p style={{ color: 'var(--rail-red)', fontSize: '0.85rem' }}>{error}</p>}
          <button className="btn primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
      <p style={{ color: 'var(--cream-dim)', fontSize: '0.82rem', marginTop: 12 }}>
        Admin accounts are created in the Cognito user pool console by whoever deployed the app.
      </p>
    </div>
  );
}
