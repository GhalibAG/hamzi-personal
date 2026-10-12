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
import { onDemoChange } from './data/local';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: DEMO ? Infinity : 30_000, refetchOnWindowFocus: !DEMO, retry: DEMO ? 0 : 2 },
    mutations: { retry: 0 },
  },
});

// Mode demo: perubahan dari tab lain → segarkan cache.
if (DEMO) {
  window.addEventListener('storage', (e) => {
    if (e.key === 'hamzi-demo-v1') { location.reload(); }
  });
  onDemoChange(() => { /* perubahan lokal sudah ditangani mutasi */ });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

export { queryClient };
