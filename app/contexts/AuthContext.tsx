import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { authService, AuthResult } from '../services/authService';
import { cloudSync } from '../services/cloudSync';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  /** True while we're bootstrapping the initial session from persisted storage */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Hydrate the initial session from AsyncStorage (supabase-js does this for us).
    authService.getSession().then((s) => {
      if (!mounted) return;
      setSession(s);
      setUser(s?.user ?? null);
      // Tell cloudSync whether we're authenticated so it can skip network
      // work entirely while the user browses as a guest.
      cloudSync.setHasActiveSession(!!s);
      setInitializing(false);
    });

    // Subscribe to auth events: sign in, sign out, token refresh, etc.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      cloudSync.setHasActiveSession(!!newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    (email: string, password: string) => authService.signIn(email, password),
    []
  );
  const signUp = useCallback(
    (email: string, password: string) => authService.signUp(email, password),
    []
  );
  const signOut = useCallback(() => authService.signOut(), []);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        initializing,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
