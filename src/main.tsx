import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import './styles/index.css';
import { router } from './app/router';
import { DEMO } from './data';
import { persistQueryCache, restoreQueryCache } from './data/persist';
import { flushSupabaseOutbox } from './data/supabase';
import { toast } from './stores/ui';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: DEMO ? Infinity : 30_000, refetchOnWindowFocus: !DEMO, retry: DEMO ? 0 : 2, networkMode: DEMO ? 'always' : 'offlineFirst' },
    mutations: { retry: 0, networkMode: 'always' },
  },
});

function render() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}

if (DEMO) {
  // Mode demo: data di localStorage; perubahan dari tab lain → muat ulang supaya konsisten.
  window.addEventListener('storage', (e) => {
    if (e.key === 'hamzi-demo-v1') location.reload();
  });
  render();
} else {
  // Mode Supabase: cache baca dari IndexedDB + outbox tulis offline (TECH-SPEC §9).
  const flush = () =>
    flushSupabaseOutbox((msg) => toast(`Satu perubahan offline ditolak server: ${msg}`)).then((n) => {
      if (n > 0) void queryClient.invalidateQueries();
    });
  window.addEventListener('online', () => void flush());
  window.setTimeout(() => void flush(), 3000);
  window.setInterval(() => { if (navigator.onLine) void flush(); }, 60_000);
  void Promise.race([restoreQueryCache(queryClient), new Promise((r) => setTimeout(r, 600))]).finally(() => {
    persistQueryCache(queryClient);
    render();
  });
}
