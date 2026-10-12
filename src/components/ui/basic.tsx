// Komponen dasar (DESIGN-SYSTEM §5): Card, Chip, Tag, Priority, CheckBox, StatTile, ProgressBar, Ring, Amount, Switch,
// Skeleton, EmptyState, SectionTitle, ServiceTile.
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { rupiah, rupiahShort } from '@common/format.ts';
import { budgetTone } from '@common/calc/index.ts';
import type { Mood } from '@common/lines.id.ts';
import { cx } from '@/lib/cx';
import { useHideAmounts } from '@/lib/amounts';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('rounded-3xl border border-line bg-surface', className)} {...rest}>
      {children}
    </div>
  );
}

/* ---------- Section title ---------- */
export function SectionTitle({ title, right, as: As = 'h2', size = 'md', tone, className }: {
  title: ReactNode; right?: ReactNode; as?: 'h2' | 'h3'; size?: 'lg' | 'md' | 'sm'; tone?: 'danger'; className?: string;
}) {
  const sz = size === 'lg' ? 'text-section-lg' : size === 'sm' ? 'text-body' : 'text-section';
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <As className={cx('m-0 font-extrabold', sz, tone === 'danger' && 'text-danger-fg')}>{title}</As>
      {right}
    </div>
  );
}

/** Tautan teks kecil di kanan judul seksi ("Lihat semua"). */
export function SectionLink({ to, children, onClick }: { to?: string; children: ReactNode; onClick?: () => void }) {
  const cls = 'text-label font-bold text-primary no-underline hover:text-primary-hover';
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cx(cls, 'bg-transparent')}>{children}</button>;
}

/* ---------- Chip pilihan ---------- */
export function Chip({ selected = false, className, children, size = 'md', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; size?: 'md' | 'lg' }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-label font-bold transition-colors',
        size === 'lg' ? 'h-10' : 'h-9',
        selected ? 'border-brand-300 bg-primary-soft text-on-primary-soft' : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-2',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- Tag ---------- */
export type TagTone =
  | 'kuliah' | 'belajar' | 'keuangan' | 'tugas' | 'ujian' | 'rutinitas' | 'keluar' | 'masuk' | 'jadwal' | 'modul' | 'event'
  | 'setoran' | 'pribadi' | 'proyek' | 'skill' | 'lomba' | 'neutral' | 'danger';
const TAG: Record<TagTone, string> = {
  kuliah: 'bg-kuliah-bg text-kuliah-hero',
  jadwal: 'bg-kuliah-bg text-kuliah-hero',
  belajar: 'bg-info-bg text-info-fg',
  modul: 'bg-info-bg text-info-fg',
  keuangan: 'bg-brand-tint text-brand-800',
  tugas: 'bg-rencana-bg text-rencana-text',
  ujian: 'bg-warn-bg text-warn-fg',
  rutinitas: 'bg-primary-soft text-brand-800',
  keluar: 'bg-danger-bg text-danger-fg',
  masuk: 'bg-primary-soft text-brand-800',
  event: 'bg-surface-2 text-ink-muted',
  setoran: 'bg-target-bg text-warn-strong',
  pribadi: 'bg-invest-bg text-invest-fg',
  proyek: 'bg-invest-bg text-invest-fg',
  skill: 'bg-belajar-bg text-belajar-fg',
  lomba: 'bg-target-bg text-target-fg',
  neutral: 'bg-line text-ink-muted',
  danger: 'bg-danger-bg text-danger-fg',
};
export function Tag({ tone, children, className }: { tone: TagTone; children: ReactNode; className?: string }) {
  return <span className={cx('inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-micro leading-none font-bold whitespace-nowrap', TAG[tone], className)}>{children}</span>;
}

/** Tag sumber tugas (Kuliah/Belajar/Keuangan/Pribadi/Proyek). */
export const SOURCE_TAG: Record<string, { label: string; tone: TagTone }> = {
  kuliah: { label: 'Kuliah', tone: 'kuliah' },
  belajar: { label: 'Belajar', tone: 'belajar' },
  keuangan: { label: 'Keuangan', tone: 'keuangan' },
  pribadi: { label: 'Pribadi', tone: 'pribadi' },
  proyek: { label: 'Proyek', tone: 'proyek' },
};

/* ---------- Prioritas ---------- */
const PRIO_PILL: Record<number, [string, string]> = {
  1: ['Rendah', 'bg-line text-ink-muted'],
  2: ['Sedang', 'bg-warn-bg text-warn-fg'],
  3: ['Tinggi', 'bg-danger-bg text-danger-fg'],
  4: ['Kritis', 'bg-danger-fg text-on-primary'],
};
export function PriorityPill({ priority }: { priority: number }) {
  const [label, cls] = PRIO_PILL[priority] ?? PRIO_PILL[2];
  return <span className={cx('shrink-0 rounded-full px-2 py-1 text-micro leading-none font-bold', cls)}>{label}</span>;
}
const PRIO_DOT: Record<number, string> = { 1: 'bg-n-400', 2: 'bg-target-bar', 3: 'bg-danger', 4: 'bg-danger-deep' };
export function PriorityDot({ priority }: { priority: number }) {
  const label = (PRIO_PILL[priority] ?? PRIO_PILL[2])[0];
  return <span role="img" aria-label={`Prioritas ${label.toLowerCase()}`} className={cx('inline-block size-2.5 shrink-0 rounded-full', PRIO_DOT[priority] ?? PRIO_DOT[2])} />;
}

/* ---------- CheckBox / CheckCircle ---------- */
export function CheckBox({ checked, onToggle, label, round = false, tone = 'default', disabled }: {
  checked: boolean; onToggle: () => void; label: string; round?: boolean; tone?: 'default' | 'danger'; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex size-11 shrink-0 items-center justify-center bg-transparent"
    >
      <span
        className={cx(
          'flex size-6 items-center justify-center transition-colors duration-150',
          round ? 'rounded-full' : 'rounded-sm',
          checked ? 'bg-brand-500' : tone === 'danger' ? 'border-2 border-danger bg-surface' : 'border-2 border-n-300 bg-surface',
        )}
      >
        {checked && <Icon.Check size={14} strokeWidth={3.2} className="text-on-primary" />}
      </span>
    </button>
  );
}

/* ---------- StatTile ---------- */
export function StatTile({ label, value, tone = 'soft', sub, className }: {
  label: ReactNode; value: ReactNode; tone?: 'soft' | 'plain' | 'hero' | 'hero-purple'; sub?: ReactNode; className?: string;
}) {
  const t = {
    soft: ['bg-primary-soft', 'text-brand-800', 'text-brand-900'],
    plain: ['bg-surface-2', 'text-ink-2', 'text-ink'],
    hero: ['bg-white-14', 'text-on-header-sub', 'text-on-primary'],
    'hero-purple': ['bg-white-14', 'text-kuliah-sub', 'text-on-primary'],
  }[tone];
  return (
    <div className={cx('flex min-w-0 flex-1 flex-col gap-0.5 rounded-lg px-3 py-2.5', t[0], className)}>
      <span className={cx('text-micro font-semibold', t[1])}>{label}</span>
      <span className={cx('truncate text-card font-extrabold', t[2])}>{value}</span>
      {sub}
    </div>
  );
}

/* ---------- ProgressBar ---------- */
export type BarColor = 'brand' | 'belajar' | 'target' | 'rencana' | 'kuliah' | 'invest' | 'warn' | 'danger' | 'white' | `lm-${number}`;
const BAR: Record<string, string> = {
  brand: 'bg-brand-500', belajar: 'bg-belajar-bar', target: 'bg-target-bar', rencana: 'bg-rencana-bar', kuliah: 'bg-kuliah-bar',
  invest: 'bg-invest-bar', warn: 'bg-target-bar', danger: 'bg-danger', white: 'bg-surface',
  'lm-0': 'bg-lm-0-bar', 'lm-1': 'bg-lm-1-bar', 'lm-2': 'bg-lm-2-bar', 'lm-3': 'bg-lm-3-bar', 'lm-4': 'bg-lm-4-bar',
};
export function ProgressBar({ value, color = 'brand', height = 8, track = 'default', label, className }: {
  value: number; color?: BarColor; height?: 6 | 8 | 10; track?: 'default' | 'white' | 'target'; label?: string; className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const h = height === 6 ? 'h-1.5' : height === 10 ? 'h-2.5' : 'h-2';
  const tr = track === 'white' ? 'bg-surface' : track === 'target' ? 'bg-target-track' : 'bg-line';
  return (
    <div className={cx('overflow-hidden rounded-full', h, tr, className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.2,.8,.2,1)]', BAR[color] ?? BAR.brand)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Warna bar anggaran (PRD §7.4): hijau < 80, kuning 80–99, merah ≥ 100. */
export function budgetBarColor(pct: number): BarColor {
  const t = budgetTone(pct);
  return t === 'over' ? 'danger' : t === 'warn' ? 'warn' : 'brand';
}

/* ---------- Ring ---------- */
export function Ring({ value, size = 56, stroke = 7, color = 'var(--mod-target-bar)', track = 'var(--mod-target-track)', label, children, textClass }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; label: string; children?: ReactNode; textClass?: string;
}) {
  const r = (size - stroke) / 2 - (size >= 200 ? 6 : 0);
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      {children !== undefined && <span className={cx('absolute inset-0 flex items-center justify-center', textClass ?? 'text-meta font-extrabold')}>{children}</span>}
    </div>
  );
}

/* ---------- Amount ---------- */
export function Amount({ value, short = false, signed = false, className }: { value: number; short?: boolean; signed?: boolean; className?: string }) {
  const hidden = useHideAmounts();
  const base = short ? rupiahShort(Math.abs(value), hidden) : rupiah(Math.abs(value), hidden);
  const sign = signed ? (value < 0 ? '−' : '+') : value < 0 ? '−' : '';
  return <span className={cx('tabular', className)}>{sign}{base}</span>;
}

/* ---------- Switch ---------- */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex h-11 w-13 shrink-0 items-center justify-center bg-transparent disabled:opacity-50"
    >
      <span className={cx('relative h-6.5 w-11 rounded-full transition-colors duration-200', checked ? 'bg-brand-500' : 'bg-n-300')}>
        <span className={cx('absolute top-0.75 left-0 size-5 rounded-full bg-n-0 shadow-1 transition-transform duration-200', checked ? 'translate-x-5.5' : 'translate-x-0.75')} />
      </span>
    </button>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('animate-shimmer rounded-2xl bg-surface-2', className)} />;
}
export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-busy="true" aria-label="Memuat">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-16" />)}
    </div>
  );
}

/* ---------- EmptyState ---------- */
export function EmptyState({ mood = 'calm', title, text, action, compact = false }: {
  mood?: Mood; title?: string; text: string; action?: ReactNode; compact?: boolean;
}) {
  return (
    <div className={cx('flex items-center gap-3 rounded-3xl border border-dashed border-line-strong bg-surface', compact ? 'p-3' : 'flex-col p-5 text-center')}>
      <Mascot mood={mood} size={compact ? 56 : 88} />
      <div className={cx('flex flex-1 flex-col gap-1', compact ? 'items-start text-left' : 'items-center')}>
        {title && <span className="text-card font-extrabold">{title}</span>}
        <span className="text-body text-ink-2">{text}</span>
        {action && <div className="mt-2 flex flex-wrap gap-2">{action}</div>}
      </div>
    </div>
  );
}

/** Pesan galat ramah dengan tombol coba lagi. */
export function ErrorState({ text = 'Data belum bisa dimuat.', onRetry }: { text?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded-3xl border border-danger-line bg-danger-soft p-3">
      <Mascot mood="worried" size={56} />
      <div className="flex flex-1 flex-col gap-1">
        <span className="text-body font-bold text-danger-fg">{text}</span>
        {onRetry && <button type="button" onClick={onRetry} className="self-start bg-transparent text-label font-extrabold text-primary">Coba lagi</button>}
      </div>
    </div>
  );
}

/* ---------- ServiceTile ---------- */
export type ModTone = 'rencana' | 'kuliah' | 'keuangan' | 'target' | 'invest' | 'belajar' | 'rutin';
export const MOD_BG: Record<ModTone, string> = {
  rencana: 'bg-rencana-bg text-rencana-fg', kuliah: 'bg-kuliah-bg text-kuliah-fg', keuangan: 'bg-keuangan-bg text-keuangan-fg',
  target: 'bg-target-bg text-target-fg', invest: 'bg-invest-bg text-invest-fg', belajar: 'bg-belajar-bg text-belajar-fg', rutin: 'bg-rutin-bg text-rutin-fg',
};
export function ServiceTile({ label, icon, tone, to, onClick }: { label: string; icon: ReactNode; tone: ModTone; to?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className={cx('flex size-13 items-center justify-center rounded-2xl', MOD_BG[tone])}>{icon}</span>
      <span className="text-small font-semibold text-ink-muted">{label}</span>
    </>
  );
  const cls = 'flex flex-col items-center gap-1.5 bg-transparent no-underline';
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

/** Lingkaran dekoratif di area berwarna (header/hero). Posisi via className. */
export function DecoCircle({ className }: { className: string }) {
  return <div aria-hidden="true" className={cx('pointer-events-none absolute rounded-full', className)} />;
}
