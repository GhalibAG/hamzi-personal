// Pembaruan service worker (registerType 'prompt') + banner "Pasang ke layar utama" (sekali).
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui';
import { readLocal, writeLocal } from '@/lib/storage';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    subs.forEach((f) => f());
  });
}

/** Dipakai Onboarding/Pengaturan: apakah bisa memunculkan dialog pasang. */
export function canInstall() {
  return !!deferred;
}
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const r = await deferred.userChoice;
  deferred = null;
  return r.outcome === 'accepted';
}
export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function PwaPrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ immediate: true });
  const [installable, setInstallable] = useState(!!deferred);
  const [dismissed, setDismissed] = useState(() => readLocal('hamzi-install-dismissed', false));
  useEffect(() => {
    const f = () => setInstallable(!!deferred);
    subs.add(f);
    return () => { subs.delete(f); };
  }, []);

  if (needRefresh) {
    return (
      <div role="alert" className="fixed inset-x-4 top-3 z-50 mx-auto flex max-w-120 items-center gap-3 rounded-4xl bg-surface p-3.5 shadow-notif">
        <span className="flex-1 text-label font-semibold">Versi baru Hamzi tersedia.</span>
        <Button size="xs" variant="secondary" onClick={() => setNeedRefresh(false)}>Nanti</Button>
        <Button size="xs" onClick={() => void updateServiceWorker(true)}>Muat ulang</Button>
      </div>
    );
  }
  if (installable && !dismissed && !isStandalone()) {
    return (
      <div role="dialog" aria-label="Pasang Hamzi" className="fixed inset-x-4 top-3 z-50 mx-auto flex max-w-120 items-center gap-3 rounded-4xl bg-surface p-3.5 shadow-notif">
        <span className="flex-1 text-label font-semibold">Pasang Hamzi ke layar utama supaya pengingat muncul walau app ditutup.</span>
        <Button size="xs" variant="secondary" onClick={() => { writeLocal('hamzi-install-dismissed', true); setDismissed(true); }}>Nanti</Button>
        <Button size="xs" onClick={() => void promptInstall().then(() => setInstallable(false))}>Pasang</Button>
      </div>
    );
  }
  return null;
}
