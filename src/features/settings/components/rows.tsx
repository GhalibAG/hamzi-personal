// Baris pengaturan: kartu grup, baris toggle (Switch role=switch), baris tautan, baris info.
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/components/icons';
import { Switch } from '@/components/ui';
import { cx } from '@/lib/cx';

export function SettingsCard({ title, desc, children, className }: { title?: string; desc?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex flex-col gap-2', className)} aria-label={title}>
      {title && <h2 className="m-0 px-1 text-label font-extrabold text-ink-3">{title}</h2>}
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">{children}</div>
      {desc && <p className="m-0 px-1 text-meta text-ink-3">{desc}</p>}
    </section>
  );
}

/** Isi bebas di dalam SettingsCard (padding standar). */
export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex flex-col gap-3 p-4', className)}>{children}</div>;
}

export function ToggleRow({ label, desc, checked, onChange, disabled }: {
  label: string; desc?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean;
}) {
  return (
    <div className={cx('flex min-h-15 items-center gap-3 py-2 pr-2 pl-4', disabled && 'opacity-60')}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body font-bold">{label}</span>
        {desc && <span className="text-meta text-ink-3">{desc}</span>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
    </div>
  );
}

export function LinkRow({ to, onClick, icon, label, desc, danger, right }: {
  to?: string; onClick?: () => void; icon?: ReactNode; label: string; desc?: ReactNode; danger?: boolean; right?: ReactNode;
}) {
  const inner = (
    <>
      {icon}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className={cx('text-body font-bold', danger ? 'text-danger-fg' : 'text-ink')}>{label}</span>
        {desc && <span className="truncate text-meta text-ink-3">{desc}</span>}
      </span>
      {right ?? <Icon.ChevronRight size={18} className="shrink-0 text-ink-3" />}
    </>
  );
  const cls = 'flex min-h-15 w-full items-center gap-3 bg-transparent px-4 py-2.5 no-underline hover:bg-surface-2';
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{inner}</button>;
}

export function InfoRow({ label, value, tone }: { label: string; value: ReactNode; tone?: 'ok' | 'warn' | 'danger' }) {
  const t = tone === 'ok' ? 'text-brand-800' : tone === 'warn' ? 'text-warn-strong' : tone === 'danger' ? 'text-danger-fg' : 'text-ink';
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-label text-ink-2">{label}</span>
      <span className={cx('text-right text-label font-bold', t)}>{value}</span>
    </div>
  );
}
