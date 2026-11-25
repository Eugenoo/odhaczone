import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import { cloudConfigured, supabase } from '@/lib/supabase';
import { startSync, stopSync, syncNow } from '@/lib/sync';
import { useTodoStore } from '@/store/todo-store';

type AuthState = {
  /** False until the saved session has been read (avoids flashing "signed out"). */
  ready: boolean;
  session: Session | null;
};

export const useAuthStore = create<AuthState>(() => ({ ready: !cloudConfigured, session: null }));

let started = false;

/** Call once at app start: restores the saved session and starts syncing if there is one. */
export function initAuth() {
  if (started || !cloudConfigured) return;
  started = true;

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({ session, ready: true });
    if (session) startSync(session.user.id);
    else stopSync();
  });
  void supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ session: data.session, ready: true });
    if (data.session) startSync(data.session.user.id);
  });
}

/** Emails a one-time code (creates the account on first use). */
export async function sendCode(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, code: string) {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

/** Signs out and clears this device, so the next person to sign in never inherits these tasks. */
export async function signOut() {
  try {
    await syncNow(); // best effort: upload anything still pending
  } catch {
    /* offline: pending changes stay in the account's last synced state */
  }
  await supabase.auth.signOut();
  useTodoStore.getState().resetAll();
}

/** Permanently deletes the account and all its data, then clears this device. */
export async function deleteAccount() {
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
  await supabase.auth.signOut().catch(() => {});
  useTodoStore.getState().resetAll();
}
