import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import NavBar from './components/NavBar';
import ProtectedRoute from './components/ProtectedRoute';
import Leaderboard from './pages/Leaderboard';
import History from './pages/History';
import Players from './pages/Players';
import PlayerProfile from './pages/PlayerProfile';
import GameEntry from './pages/GameEntry';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { registerTokenGetter } from './api/client';

function TokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    registerTokenGetter(getToken);
  }, [getToken]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <TokenBridge />
      <HashRouter>
        <div className="app-shell">
          <NavBar />
          <Routes>
            <Route path="/" element={<Leaderboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/players" element={<Players />} />
            <Route path="/players/:playerId" element={<PlayerProfile />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <GameEntry />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </HashRouter>
    </AuthProvider>
  );
}
