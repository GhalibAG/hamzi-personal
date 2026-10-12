// Persist cache TanStack Query ke IndexedDB (TECH-SPEC §9 "Baca: persister IndexedDB") — mode Supabase.
// Data terakhir tetap tampil saat offline / app dibuka tanpa internet.
import { dehydrate, hydrate, type DehydratedState, type QueryClient } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';

const KEY = 'hamzi-query-cache-v1';
const BUSTER = 'v1';
const MAX_AGE = 7 * 86_400_000;

interface Stored { at: number; buster: string; state: DehydratedState }

export async function restoreQueryCache(qc: QueryClient): Promise<void> {
  try {
    const s = (await get(KEY)) as Stored | undefined;
    if (s && s.buster === BUSTER && Date.now() - s.at < MAX_AGE) hydrate(qc, s.state);
  } catch {
    /* abaikan cache rusak */
  }
}

export function persistQueryCache(qc: QueryClient): () => void {
  let t: number | undefined;
  const unsub = qc.getQueryCache().subscribe(() => {
    window.clearTimeout(t);
    t = window.setTimeout(() => {
      const state = dehydrate(qc, { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'ai' });
      void set(KEY, { at: Date.now(), buster: BUSTER, state } satisfies Stored).catch(() => undefined);
    }, 1000);
  });
  return () => { window.clearTimeout(t); unsub(); };
}

/** Hapus cache (keluar akun). */
export async function clearQueryCache() {
  try {
    await del(KEY);
  } catch {
    /* abaikan */
  }
}
