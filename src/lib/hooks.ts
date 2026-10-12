// Hook utilitas UI (tanpa logika bisnis).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { wibDate } from '@common/calc/index.ts';
import { useUi } from '@/stores/ui';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener('change', cb);
      return () => m.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Desktop ≥ 1024 px (DESIGN-SYSTEM §11): sidebar, dialog alih-alih sheet, panel chat. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** prefers-reduced-motion ATAU mode Minimal. */
export function useReducedMotion(): boolean {
  const prefers = useMediaQuery('(prefers-reduced-motion: reduce)');
  const minimal = useUi((s) => s.minimal);
  return prefers || minimal;
}

/** Waktu sekarang, diperbarui berkala (default 30 dtk). */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    const vis = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, [intervalMs]);
  return now;
}

/** Tanggal WIB hari ini ('YYYY-MM-DD'); berganti otomatis lewat tengah malam. */
export function useToday(): string {
  return wibDate(useNow(60_000));
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
    },
    () => navigator.onLine,
    () => true,
  );
}

function typingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/** Pintasan keyboard satu huruf (diabaikan saat mengetik di input). DESIGN-SYSTEM §11.5. */
export function useHotkeys(map: Record<string, (e: KeyboardEvent) => void>, enabled = true) {
  const ref = useRef(map);
  useEffect(() => { ref.current = map; });
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key !== 'Escape' && typingTarget(e)) return;
      const fn = ref.current[e.key] ?? ref.current[e.key.toLowerCase()];
      if (fn) { e.preventDefault(); fn(e); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled]);
}

export { readLocal, writeLocal } from './storage';
