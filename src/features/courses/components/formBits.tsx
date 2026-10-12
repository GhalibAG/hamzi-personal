// Potongan form Kuliah: palet warna matkul (dari token, tanpa hex di kode), baris chip pilihan, select.
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { Chip, inputCls } from '@/components/ui';
import { cx } from '@/lib/cx';

/** Palet warna matkul = token aksen modul. Nilai yang disimpan = warna hasil resolusi token (agar tetap terbaca di luar app). */
export const COURSE_COLORS: { token: string; label: string }[] = [
  { token: '--mod-kuliah-bar', label: 'Ungu' },
  { token: '--mod-rencana-bar', label: 'Biru' },
  { token: '--mod-target-bar', label: 'Oranye' },
  { token: '--mod-invest-bar', label: 'Merah muda' },
  { token: '--mod-belajar-bar', label: 'Sian' },
  { token: '--brand-500', label: 'Hijau' },
  { token: '--danger', label: 'Merah' },
  { token: '--mod-kuliah-hero', label: 'Ungu tua' },
];

export function resolveToken(token: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim();
}

const same = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** Gaya latar dari warna matkul (data pengguna). Tanpa warna → kelas cadangan dipakai pemanggil. */
export function courseColorStyle(color?: string | null): React.CSSProperties | undefined {
  return color ? { backgroundColor: color } : undefined;
}

export function ColorPicker({ value, onChange }: { value: string | null; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Warna matkul" className="grid grid-cols-8 justify-items-center">
      {COURSE_COLORS.map((c) => {
        const resolved = resolveToken(c.token);
        const sel = same(value, resolved);
        return (
          <button
            key={c.token}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={c.label}
            onClick={() => onChange(resolved)}
            className="flex size-11 items-center justify-center rounded-full bg-transparent"
          >
            <span
              className={cx('size-7.5 rounded-full', sel && 'ring-2 ring-ink ring-offset-2 ring-offset-surface')}
              style={{ backgroundColor: `var(${c.token})` }}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ChipRow<T extends string | number>({ label, options, value, onChange, allowNone, noneLabel = '–' }: {
  label: string; options: { value: T; label: string }[]; value: T | null; onChange: (v: T | null) => void; allowNone?: boolean; noneLabel?: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {allowNone && <Chip selected={value === null} onClick={() => onChange(null)}>{noneLabel}</Chip>}
      {options.map((o) => (
        <Chip key={String(o.value)} selected={value === o.value} onClick={() => onChange(o.value)} className="min-w-11">{o.label}</Chip>
      ))}
    </div>
  );
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <select className={cx(inputCls, 'appearance-auto pr-2', className)} {...rest}>{children}</select>;
}

export function FormLabel({ children, id }: { children: ReactNode; id?: string }) {
  return <span id={id} className="text-label font-bold text-ink-muted">{children}</span>;
}

/** Alias Switch bersama. */
export { Switch as ToggleSwitch } from '@/components/ui';
