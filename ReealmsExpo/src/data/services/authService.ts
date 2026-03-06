import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';

export class AuthService {
  async getCurrentUser(): Promise<User | null> {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }

    return data.session?.user ?? null;
  }

  onAuthStateChange(listener: (event: AuthChangeEvent, session: Session | null) => void): Subscription {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(listener);

    return subscription;
  }

  async signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw error;
    }
  }

  async signUpWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      throw error;
    }
  }

  async signOut() {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      throw error;
    }
  }

  async signInAnonymously() {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw error;
    }
  }
}
