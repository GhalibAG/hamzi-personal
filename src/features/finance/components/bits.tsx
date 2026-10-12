// Bagian kecil bersama layar Keuangan/Target/Investasi: ikon lokal, lencana kategori, input nominal, pemilih waktu.
import { useId, type CSSProperties, type ReactNode, type SVGProps } from 'react';
import { thousands } from '@common/format.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Icon } from '@/components/icons';
import { inputCls } from '@/components/ui';
import type { Category, SavingsGoal, Wallet } from '@/data/types';
import { cx } from '@/lib/cx';
import { relDayLabel } from '../derive';

/* ---------- Ikon lokal (gaya Lucide, stroke 1,9 — DESIGN-SYSTEM §8) ---------- */
type P = SVGProps<SVGSVGElement> & { size?: number };
const svg = (size = 20, rest: SVGProps<SVGSVGElement>) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9,
  strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, focusable: 'false' as const, ...rest,
});
export function LaptopIcon({ size, ...rest }: P) {
  return <svg {...svg(size, rest)} strokeWidth={2}><rect x="4" y="5" width="16" height="11" rx="2" /><path d="M2 19h20" /></svg>;
}
export function ArchiveIcon({ size, ...rest }: P) {
  return <svg {...svg(size, rest)}><rect x="2.5" y="3.5" width="19" height="5" rx="1.2" /><path d="M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5" /><path d="M10 12.5h4" /></svg>;
}
export function BankIcon({ size, ...rest }: P) {
  return <svg {...svg(size, rest)}><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8" /><path d="M3 20h18" /></svg>;
}

/** Ikon target menurut jenis (prototipe: Dana darurat = Target, Laptop = laptop). */
export function GoalGlyph({ goal, size = 18 }: { goal: Pick<SavingsGoal, 'kind' | 'icon'>; size?: number }) {
  if (goal.icon === 'laptop' || (goal.kind === 'barang' && !goal.icon)) return <LaptopIcon size={size} />;
  switch (goal.kind) {
    case 'pendidikan': return <Icon.Cap size={size} strokeWidth={2} />;
    case 'investasi': return <Icon.TrendUp size={size} strokeWidth={2} />;
    default: return <Icon.Target size={size} strokeWidth={2} />;
  }
}

export function WalletGlyph({ kind, size = 20 }: { kind: Wallet['kind']; size?: number }) {
  if (kind === 'bank') return <BankIcon size={size} />;
  if (kind === 'ewallet') return <Icon.Phone size={size} />;
  return <Icon.Wallet size={size} />;
}

/**
 * Warna pilihan pengguna yang tersimpan di data (kategori/dompet) → gaya inline.
 * Satu-satunya tempat warna non-token dipakai; latar = campuran tipis warna data dengan permukaan.
 */
export function dataTint(color: string | null | undefined): CSSProperties | undefined {
  if (!color) return undefined;
  return {
    background: `color-mix(in srgb, ${color} 14%, var(--surface))`,
    color: `color-mix(in srgb, ${color} 72%, var(--text))`,
  };
}

/** Lencana inisial kategori (40 radius 14; kecil 28 radius 9 untuk tabel desktop). */
export function CategoryBadge({ category, label, small = false, className }: { category?: Pick<Category, 'name' | 'color'> | null; label?: string; small?: boolean; className?: string }) {
  const name = label ?? category?.name ?? '?';
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex shrink-0 items-center justify-center font-extrabold',
        small ? 'size-7 rounded-[9px] text-meta' : 'size-10 rounded-lg text-card',
        !category?.color && 'bg-surface-2 text-ink-muted',
        className,
      )}
      style={dataTint(category?.color)}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/* ---------- Nominal ---------- */

/** Digit → integer rupiah (tanpa float). */
export function parseRupiah(s: string): number {
  const d = s.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
  return d ? Number.parseInt(d, 10) : 0;
}

/** Input nominal "Rp 25.000" dengan format otomatis. */
export function MoneyInput({ value, onChange, label, id, big = false, compact = false, autoFocus, onEnter, placeholder = '0', hint, error }: {
  value: number; onChange: (n: number) => void; label: string; id?: string; big?: boolean; compact?: boolean; autoFocus?: boolean;
  onEnter?: () => void; placeholder?: string; hint?: ReactNode; error?: string;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  const shown = value > 0 ? thousands(value) : '';
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className={cx(compact ? 'sr-only' : big ? 'text-meta font-semibold text-ink-3' : 'text-label font-bold text-ink-muted')}>{label}</label>
      <div
        className={cx(
          'flex items-center gap-1.5 bg-surface',
          big ? 'rounded-xl border-2 border-brand-200 px-3.5 py-1.5 focus-within:border-brand-400'
            : cx(compact ? 'h-11 px-3' : 'h-12 px-3.5', 'rounded-lg border border-line-strong focus-within:border-brand-400'),
          error && 'border-danger-line',
        )}
      >
        <span className={cx('font-extrabold text-ink', big ? 'text-title' : 'text-body')}>Rp</span>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          value={shown}
          placeholder={placeholder}
          data-autofocus={autoFocus ? '' : undefined}
          onChange={(e) => onChange(parseRupiah(e.target.value))}
          onKeyDown={(e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
          className={cx('min-w-0 flex-1 border-0 bg-transparent text-ink tabular outline-none placeholder:text-ink-3', big ? 'h-12 text-timer-sm font-extrabold' : 'h-11 text-body font-semibold')}
        />
      </div>
      {hint && !error && <span className="text-meta text-ink-3">{hint}</span>}
      {error && <span role="alert" className="text-meta font-semibold text-danger-fg">{error}</span>}
    </div>
  );
}

/** Chip cepat +5rb … +50rb (menambah). */
export const QUICK_ADD = [5000, 10000, 20000, 50000] as const;

/* ---------- Data sensitif ---------- */

/** Pesan peringatan data sensitif (FIN-11). `block` = nomor panjang (rekening/kartu/NIK) → simpan diblokir. */
export function sensitiveCheck(text: string | null | undefined): { message: string | null; block: boolean } {
  const kinds = detectSensitive(text ?? '');
  if (!kinds.length) return { message: null, block: false };
  return { message: SENSITIVE_MESSAGE[kinds[0]], block: kinds.includes('nomor_panjang') };
}

export function SensitiveNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="m-0 flex items-start gap-1.5 rounded-md bg-warn-banner px-3 py-2 text-meta font-semibold text-warn-fg">
      <Icon.Alert size={16} className="mt-px shrink-0" />{message}
    </p>
  );
}

/* ---------- Tanggal & jam ---------- */

/** Tombol "Hari ini, 16:08 ▾" (membuka/menutup `DateTimeInputs`). */
export function DateTimeButton({ date, time, today, open, onToggle, controls, variant = 'inline' }: {
  date: string; time: string; today: string; open: boolean; onToggle: () => void; controls: string; variant?: 'inline' | 'box';
}) {
  const label = `${relDayLabel(date, today)}, ${time}`;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`Waktu: ${label}. Ubah waktu`}
      onClick={onToggle}
      className={cx(
        variant === 'box'
          ? 'flex h-11 w-full items-center rounded-md border border-line-strong bg-surface px-3 text-left text-label-lg font-bold text-ink'
          : 'flex h-11 items-center bg-transparent px-0.5 text-meta font-semibold text-ink-2',
      )}
    >
      {label} ▾
    </button>
  );
}

/** Input tanggal + jam (WIB). */
export function DateTimeInputs({ id, date, time, today, onChange, allowFuture = false }: {
  id: string; date: string; time: string; today: string; onChange: (date: string, time: string) => void; allowFuture?: boolean;
}) {
  return (
    <div id={id} className="grid grid-cols-[1fr_auto] gap-2">
      <label className="flex flex-col gap-1 text-micro font-semibold text-ink-3">
        Tanggal
        <input type="date" value={date} max={allowFuture ? undefined : today} onChange={(e) => e.target.value && onChange(e.target.value, time)} className={cx(inputCls, 'h-11')} />
      </label>
      <label className="flex flex-col gap-1 text-micro font-semibold text-ink-3">
        Jam
        <input type="time" value={time} onChange={(e) => e.target.value && onChange(date, e.target.value)} className={cx(inputCls, 'h-11')} />
      </label>
    </div>
  );
}

/** Input tanggal sederhana dengan label. */
export function DateField({ label, value, onChange, min, max, optional = false }: {
  label: string; value: string; onChange: (v: string) => void; min?: string; max?: string; optional?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-label font-bold text-ink-muted">{label}</label>
      <input id={id} type="date" value={value} min={min} max={max} required={!optional} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </div>
  );
}

/** Pilihan native bergaya teks ("Dompet: Tunai ▾"). */
export function InlineSelect<T extends string>({ label, prefix, value, options, onChange, variant = 'inline' }: {
  label: string; prefix?: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; variant?: 'inline' | 'box';
}) {
  const current = options.find((o) => o.value === value)?.label ?? '–';
  return (
    <label
      className={cx(
        'relative flex items-center',
        variant === 'box'
          ? 'h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-label-lg font-bold text-ink focus-within:border-brand-400'
          : 'h-11 gap-1 px-0.5 text-meta font-semibold text-ink-2',
      )}
    >
      <span aria-hidden="true" className="truncate">{prefix}{current} ▾</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 cursor-pointer appearance-none opacity-0"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

/** Pilihan native dengan label di atas (form biasa). */
export function SelectField<T extends string>({ label, value, options, onChange, id }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; id?: string;
}) {
  const auto = useId();
  const sid = id ?? auto;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={sid} className="text-label font-bold text-ink-muted">{label}</label>
      <div className="relative">
        <select id={sid} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputCls, 'appearance-none pr-10')}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon.ChevronDown size={18} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-3" />
      </div>
    </div>
  );
}
