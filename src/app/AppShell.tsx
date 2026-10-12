// Kerangka app: HP = konten + navigasi bawah; desktop ≥1024 = sidebar kiri + konten + panel Chat kanan (DESIGN-SYSTEM §11).
import { lazy, Suspense, useEffect } from 'react';
import { Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { useSettings } from '@/data/hooks';
import { DEMO } from '@/data';
import { useOutboxCount } from '@/data/outbox';
import { useHotkeys, useIsDesktop, useOnline } from '@/lib/hooks';
import { useUi, type QuickKind } from '@/stores/ui';
import { useTimer } from '@/stores/timer';
import { ToastHost } from '@/components/ui';
import { Icon } from '@/components/icons';
import { BottomNav } from './BottomNav';
import { Sidebar } from './Sidebar';
import { QuickHost } from './QuickHost';
import { hideBottomNav } from './nav';
import { PwaPrompt } from './PwaPrompt';
import { TimerChip } from './TimerChip';
import { RouteFallback } from './RouteFallback';

const ChatPanel = lazy(() => import('@/features/chat/components/ChatPanel').then((m) => ({ default: m.ChatPanel })));
const TimerOverlay = lazy(() => import('@/features/learning/components/TimerOverlay').then((m) => ({ default: m.TimerOverlay })));
const ReminderEngine = lazy(() => import('@/features/notifications/ReminderEngine').then((m) => ({ default: m.ReminderEngine })));

const QUICK_KINDS: QuickKind[] = ['expense', 'income', 'task', 'event', 'routine', 'module', 'timer', 'exam', 'course', 'course-task'];

function useAppearance() {
  const s = useSettings();
  const setMinimal = useUi((x) => x.setMinimal);
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    m.addEventListener('change', apply);
    return () => m.removeEventListener('change', apply);
  }, [s.theme]);
  useEffect(() => {
    document.documentElement.dataset.minimal = String(s.minimal_mode);
    setMinimal(s.minimal_mode);
  }, [s.minimal_mode, setMinimal]);
}

export function AppShell() {
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const chatOpen = useUi((s) => s.chatOpen);
  const openQuick = useUi((s) => s.openQuick);
  const toggleChat = useUi((s) => s.toggleChat);
  const timerOpen = useTimer((s) => !!s.active && !s.minimized);
  const online = useOnline();
  const pending = useOutboxCount(!DEMO);
  useAppearance();

  // ?quick=expense|income|task|timer|routine|module (manifest shortcuts, tautan notifikasi)
  useEffect(() => {
    const q = params.get('quick') as QuickKind | null;
    if (q && QUICK_KINDS.includes(q)) {
      openQuick(q);
      params.delete('quick');
      setParams(params, { replace: true });
    }
  }, [params, setParams, openQuick]);

  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  useHotkeys({
    n: () => openQuick('task'),
    e: () => openQuick('expense'),
    t: () => openQuick('timer'),
    r: () => openQuick('routine'),
    c: () => (desktop ? toggleChat() : nav('/chat')),
    '/': () => {
      const el = document.getElementById('global-search') as HTMLInputElement | null;
      if (el) el.focus(); else nav('/cari');
    },
  });

  const offline = !online ? (
    <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-warn-banner px-4 py-2 text-meta font-semibold text-warn-fg">
      <Icon.Alert size={16} /> Kamu sedang offline. Data tersimpan di perangkat; AI & sinkron menunggu internet.
      {pending > 0 && <span className="font-extrabold">· {pending} perubahan menunggu sinkron</span>}
    </div>
  ) : pending > 0 ? (
    <div role="status" className="sticky top-0 z-30 flex items-center justify-center gap-2 bg-info-bg px-4 py-1.5 text-meta font-semibold text-info-fg">
      <Icon.Repeat size={14} /> Menyinkronkan {pending} perubahan…
    </div>
  ) : null;

  const overlays = (
    <>
      <QuickHost />
      {timerOpen && <Suspense fallback={null}><TimerOverlay /></Suspense>}
      <Suspense fallback={null}><ReminderEngine /></Suspense>
      <ToastHost desktop={desktop} />
      <PwaPrompt />
    </>
  );

  if (desktop) {
    const chatRoute = pathname.startsWith('/chat');
    return (
      <div className="flex h-dvh overflow-hidden bg-bg">
        <Sidebar />
        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          {offline}
          <Suspense fallback={<RouteFallback />}><Outlet /></Suspense>
        </main>
        {chatOpen && !chatRoute && (
          <aside aria-label="Chat Hamzi" className="h-full w-95 shrink-0 border-l border-line bg-surface">
            <Suspense fallback={<RouteFallback />}><ChatPanel onClose={toggleChat} /></Suspense>
          </aside>
        )}
        <TimerChip />
        {overlays}
      </div>
    );
  }

  const showNav = !hideBottomNav(pathname);
  return (
    <div className="min-h-dvh bg-bg">
      {offline}
      <main id="main" className={showNav ? 'pb-19' : undefined}>
        <Suspense fallback={<RouteFallback />}><Outlet /></Suspense>
      </main>
      {showNav && <TimerChip />}
      {showNav && <BottomNav />}
      {overlays}
    </div>
  );
}
