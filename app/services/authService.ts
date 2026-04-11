import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface AuthResult {
  success: boolean;
  session?: Session | null;
  user?: User | null;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Translates a Supabase AuthError into a stable code that the UI layer
 * can map to a localized message. We deliberately don't return the raw
 * English error string, so users of the Turkish/Portuguese UI never see
 * English error text.
 */
const toErrorCode = (error: AuthError | null): string => {
  if (!error) return 'unknown';
  const msg = (error.message || '').toLowerCase();

  if (msg.includes('invalid login credentials')) return 'invalid_credentials';
  if (msg.includes('email not confirmed')) return 'email_not_confirmed';
  if (msg.includes('user already registered')) return 'user_already_registered';
  if (msg.includes('password should be at least')) return 'weak_password';
  if (msg.includes('unable to validate email')) return 'invalid_email';
  if (msg.includes('rate limit')) return 'rate_limit';
  if (msg.includes('network')) return 'network';
  return 'unknown';
};

class AuthService {
  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return {
        success: false,
        errorCode: toErrorCode(error),
        errorMessage: error.message,
      };
    }

    return {
      success: true,
      session: data.session,
      user: data.user,
    };
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      return {
        success: false,
        errorCode: toErrorCode(error),
        errorMessage: error.message,
      };
    }

    return {
      success: true,
      session: data.session,
      user: data.user,
    };
  }

  async signOut(): Promise<AuthResult> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return {
        success: false,
        errorCode: toErrorCode(error),
        errorMessage: error.message,
      };
    }
    return { success: true };
  }

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }
}

export const authService = new AuthService();
