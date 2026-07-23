import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function NavBar() {
  const { isAuthenticated, email, signOut } = useAuth();

  return (
    <nav className="nav">
      <div className="nav-brand">♠ The Yearly Grind</div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
          Standings
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => (isActive ? 'active' : '')}>
          History
        </NavLink>
        <NavLink to="/players" className={({ isActive }) => (isActive ? 'active' : '')}>
          Players
        </NavLink>
        {isAuthenticated && (
          <NavLink to="/admin" className={({ isActive }) => (isActive ? 'active' : '')}>
            Enter Results
          </NavLink>
        )}
        {isAuthenticated ? (
          <button className="btn" onClick={() => signOut()}>
            Sign out ({email})
          </button>
        ) : (
          <NavLink to="/login" className="btn">
            Admin login
          </NavLink>
        )}
      </div>
    </nav>
  );
}
