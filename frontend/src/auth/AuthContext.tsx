import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  confirmSignIn,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import './amplifyConfig';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  needsNewPassword: boolean;
  email: string | null;
  getToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  confirmNewPassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsNewPassword, setNeedsNewPassword] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  async function refresh() {
    try {
      const user = await getCurrentUser();
      setIsAuthenticated(true);
      setEmail(user.signInDetails?.loginId ?? user.username);
    } catch {
      setIsAuthenticated(false);
      setEmail(null);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function signIn(emailInput: string, password: string) {
    const result = await amplifySignIn({ username: emailInput, password });
    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setNeedsNewPassword(true);
      return;
    }
    await refresh();
  }

  async function confirmNewPassword(newPassword: string) {
    await confirmSignIn({ challengeResponse: newPassword });
    setNeedsNewPassword(false);
    await refresh();
  }

  async function signOut() {
    await amplifySignOut();
    setIsAuthenticated(false);
    setEmail(null);
  }

  async function getToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() ?? null;
    } catch {
      return null;
    }
  }

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, isLoading, needsNewPassword, email, getToken, signIn, confirmNewPassword, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
