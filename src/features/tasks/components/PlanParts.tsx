// Bagian tab "Hari ini" & "Minggu ini" Rencana (Rencana.dc.html, Desktop-Rencana.dc.html).
import { Link } from 'react-router';
import { dayLabelComma } from '@common/format.ts';
import { CheckBox, Menu, Ring } from '@/components/ui';
import type { Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useUi } from '@/stores/ui';
import { SNOOZE_LABEL, type SnoozeOption, type WeekItem, type WeekTone } from '../derive';

/** Kartu progres: Ring 52 (brand-500 di brand-100), "x dari y tugas selesai", fokus, chip +XP. */
export function ProgressCard({ done, total, focus, xp, desktop }: { done: number; total: number; focus: number; xp: number; desktop: boolean }) {
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className={cx('flex items-center gap-3.5 rounded-3xl border border-line bg-surface', desktop ? 'px-4 py-3.5' : 'p-3.5')}>
      <Ring value={pct} size={52} stroke={7} color="var(--brand-500)" track="var(--brand-100)" label={total ? `Progres ${done} dari ${total} tugas` : 'Belum ada tugas'} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-card font-extrabold">{total ? `${done} dari ${total} tugas selesai` : 'Belum ada tugas'}</span>
        <span className="text-meta text-ink-3">{focus ? `Fokus: ${focus} tugas prioritas tinggi` : total ? 'Tidak ada tugas prioritas tinggi' : 'Mau tambah satu?'}</span>
      </div>
      <span className="shrink-0 rounded-full bg-primary-soft px-2.5 py-1.5 text-meta font-extrabold text-brand-800">+{xp} XP</span>
    </div>
  );
}

/** Kartu terlambat (merah) + tombol "Tunda" → +1 jam / Besok / Akhir pekan (TASK-08). */
export function OverdueRow({ t, meta, onToggle, onSnooze, desktop }: {
  t: Task; meta: string; onToggle: (t: Task) => void; onSnooze: (t: Task, o: SnoozeOption) => void; desktop: boolean;
}) {
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl border border-danger-line bg-danger-soft pr-3.5 pl-2', desktop ? 'py-2' : 'py-2.5')}>
      <CheckBox checked={false} tone="danger" onToggle={() => onToggle(t)} label={`Tandai selesai: ${t.title}`} />
      <Link to={`/rencana/tugas/${t.id}`} className="flex min-w-0 flex-1 flex-col gap-0.75 text-ink no-underline">
        <span className="truncate text-body font-semibold">{t.title}</span>
        <span className="truncate text-meta text-danger-fg">{meta}</span>
      </Link>
      <Menu
        width={190}
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="menu"
            aria-label={`Tunda: ${t.title}`}
            className="h-9 shrink-0 rounded-full border border-danger-line bg-surface px-3 text-meta font-bold text-danger-fg hover:bg-danger-bg"
          >
            Tunda
          </button>
        )}
        items={(['hour', 'tomorrow', 'weekend'] as SnoozeOption[]).map((o) => ({ label: SNOOZE_LABEL[o], onSelect: () => onSnooze(t, o) }))}
      />
    </div>
  );
}

const TONE: Record<WeekTone, string> = {
  danger: 'text-danger-fg',
  muted: 'text-ink-3',
  kuliah: 'text-kuliah-fg',
  rutin: 'text-brand-600',
  belajar: 'text-info-fg',
  keuangan: 'text-brand-800',
  pribadi: 'text-invest-fg',
  proyek: 'text-invest-fg',
};

function WeekRowInner({ it, compact }: { it: WeekItem; compact: boolean }) {
  return (
    <>
      <span className={cx('min-w-0 font-semibold', compact ? 'text-label' : 'text-body')}>{it.title}</span>
      <span className={cx('shrink-0 font-bold', compact ? 'text-label' : 'text-meta', TONE[it.tone])}>{it.right}</span>
    </>
  );
}

function WeekRow({ it, compact }: { it: WeekItem; compact: boolean }) {
  const openQuick = useUi((s) => s.openQuick);
  const cls = cx(
    'flex items-center justify-between gap-2 text-left text-ink no-underline',
    compact ? 'min-h-8 rounded-md hover:bg-surface-2' : 'min-h-11 rounded-2xl border border-line bg-surface px-3.5 py-3 hover:bg-surface-2',
  );
  if (it.to) return <Link to={it.to} className={cls}><WeekRowInner it={it} compact={compact} /></Link>;
  return (
    <button type="button" onClick={() => openQuick('event', { id: it.eventId })} className={cx(cls, 'w-full')}>
      <WeekRowInner it={it} compact={compact} />
    </button>
  );
}

/** Tab "Minggu ini": HP = judul hari + kartu per item; desktop = grid kartu per hari. */
export function WeekList({ groups, desktop }: { groups: { day: string; items: WeekItem[] }[]; desktop: boolean }) {
  if (desktop) {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-3">
        {groups.map((g) => (
          <section key={g.day} aria-label={dayLabelComma(g.day)} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface px-3.5 py-3">
            <h2 className="m-0 text-body font-extrabold">{dayLabelComma(g.day)}</h2>
            {g.items.map((it) => <WeekRow key={it.key} it={it} compact />)}
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.day} aria-label={dayLabelComma(g.day)} className="flex flex-col gap-2">
          <h2 className="m-0 text-body font-extrabold">{dayLabelComma(g.day)}</h2>
          {g.items.map((it) => <WeekRow key={it.key} it={it} compact={false} />)}
        </section>
      ))}
    </div>
  );
}
