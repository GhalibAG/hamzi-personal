// `/tumbuh/sesi?modul=<id>` — tautan langsung ke timer fokus (notifikasi, pintasan). Overlay global dirender AppShell;
// halaman ini memulai/menampilkan timer dan merender Tumbuh di bawahnya. Timer dikecilkan/dihapus → kembali ke /tumbuh.
import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useTimer } from '@/stores/timer';
import { useUi } from '@/stores/ui';
import GrowthPage from '@/features/growth/pages/GrowthPage';
import { useLearning, useStartFocus } from '../hooks';

export default function TimerPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const moduleId = params.get('modul');
  const active = useTimer((s) => s.active);
  const minimized = useTimer((s) => s.minimized);
  const quickOpen = useUi((s) => s.quick?.kind === 'timer');
  const openQuick = useUi((s) => s.openQuick);
  const learning = useLearning();
  const start = useStartFocus();
  const shown = useRef(false);
  const asked = useRef(false);

  // Mulai / tampilkan timer sekali saat halaman dibuka.
  useEffect(() => {
    if (shown.current || asked.current) return;
    // Aksi notifikasi (mis. "Tunda 10 mnt") ditangani ReminderEngine — jangan memulai timer.
    if (params.get('notif_action') && params.get('notif_action') !== 'start') return;
    const t = useTimer.getState();
    if (t.active) {
      t.setMinimized(false);
      shown.current = true;
      return;
    }
    if (moduleId) {
      if (learning.loading) return;
      const exists = learning.modules.some((m) => m.id === moduleId);
      start({ moduleId: exists ? moduleId : null });
      shown.current = true;
      return;
    }
    asked.current = true;
    openQuick('timer');
  }, [moduleId, params, learning.loading, learning.modules, start, openQuick]);

  // Timer dikecilkan, selesai & dihapus, atau sheet ditutup tanpa memulai → kembali ke Tumbuh.
  // (Hanya setelah overlay/sheet benar-benar pernah tampil, agar tidak terpicu oleh nilai render lama.)
  const overlaySeen = useRef(false);
  const sheetSeen = useRef(false);
  useEffect(() => {
    if (active && !minimized) overlaySeen.current = true;
    if (quickOpen) sheetSeen.current = true;
    if (overlaySeen.current && (!active || minimized)) nav('/tumbuh', { replace: true });
    else if (sheetSeen.current && !quickOpen && !active) nav('/tumbuh', { replace: true });
  }, [active, minimized, quickOpen, nav]);

  return <GrowthPage />;
}
