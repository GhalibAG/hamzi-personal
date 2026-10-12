// Sesi login. MODE DEMO selalu "masuk" (tanpa server). Supabase: Google OAuth / magic link (AUTH-01..03).
import { useEffect, useState } from 'react';
import { DEMO } from '@/data';
import { supabase } from '@/data/supabase';

export type SessionStatus = 'loading' | 'in' | 'out';

export function useSession(): { status: SessionStatus; userId: string | null; email: string | null } {
  const [state, setState] = useState<{ status: SessionStatus; userId: string | null; email: string | null }>(
    DEMO ? { status: 'in', userId: 'demo', email: null } : { status: 'loading', userId: null, email: null },
  );
  useEffect(() => {
    if (DEMO) return;
    const sb = supabase();
    let alive = true;
    void sb.auth.getSession().then(({ data }) => {
      if (!alive) return;
      const u = data.session?.user;
      setState({ status: u ? 'in' : 'out', userId: u?.id ?? null, email: u?.email ?? null });
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      setState({ status: u ? 'in' : 'out', userId: u?.id ?? null, email: u?.email ?? null });
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);
  return state;
}

export async function signInWithGoogle() {
  const { error } = await supabase().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/' } });
  if (error) throw new Error(error.message);
}

export async function signInWithEmail(email: string) {
  // shouldCreateUser:false → hanya akun pemilik yang sudah ada (sign-up publik dimatikan, TECH-SPEC §11).
  const { error } = await supabase().auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + '/', shouldCreateUser: false } });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  if (DEMO) return;
  await supabase().auth.signOut();
  const { clearQueryCache } = await import('@/data/persist');
  await clearQueryCache();
}
