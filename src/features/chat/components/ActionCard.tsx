// Kartu aksi usulan Hamzi (DESIGN-SYSTEM §5 ActionCard, CHAT-03, TECH-SPEC §7.8.6).
// Checkbox per item → "Tambahkan N terpilih"/"Simpan" + "Batal"; sesudah: "✓ N item ditambahkan ke {dest}" + Urungkan (24 jam).
import { useState } from 'react';
import type { ProposalItem } from '@common/schemas.ts';
import { Icon } from '@/components/icons';
import { Tag, type TagTone } from '@/components/ui';
import type { AiAction, AiMessage } from '@/data/types';
import { cx } from '@/lib/cx';
import { toast } from '@/stores/ui';
import { appliedItems, canUndo, useProposalActions } from '../apply';
import { proposalDest } from '../proposals';
import type { ChatVariant } from './ChatParts';

const KIND_TONE: Record<string, TagTone> = {
  Tugas: 'tugas', Ujian: 'ujian', Modul: 'modul', Rutinitas: 'rutinitas', Keluar: 'keluar', Masuk: 'masuk',
  Jadwal: 'jadwal', Event: 'event', Setoran: 'setoran',
};

export function applyLabel(total: number, selected: number): string {
  if (selected === 0) return 'Pilih minimal 1';
  return total === 1 ? 'Simpan' : `Tambahkan ${selected} terpilih`;
}

export function ActionCard({ message, action, variant = 'page' }: { message: AiMessage; action?: AiAction; variant?: ChatVariant }) {
  const proposals = message.proposals;
  const items: ProposalItem[] = proposals?.items ?? [];
  const ops = useProposalActions();
  const [sel, setSel] = useState<boolean[]>(() => items.map((i) => i.selected));
  const [busy, setBusy] = useState<'apply' | 'undo' | 'cancel' | null>(null);
  const [skipped, setSkipped] = useState<Map<number, string>>(new Map());
  const state = action?.state ?? 'pending';
  const open = state === 'pending' || state === 'undone';
  const applied = state === 'applied' ? appliedItems(action) : [];
  const isOn = (i: number) => (state === 'applied' && applied.length ? applied.includes(i) : sel[i]);
  const nOn = sel.filter(Boolean).length;
  const panel = variant === 'panel';

  if (!proposals || !items.length) return null;

  const run = async (kind: 'apply' | 'undo' | 'cancel') => {
    if (busy) return;
    setBusy(kind);
    try {
      if (kind === 'apply') {
        const picked = sel.flatMap((on, i) => (on ? [i] : []));
        const r = await ops.apply(message, action, picked);
        const sk = new Map(r.skipped.map((s) => [s.item, s.reason]));
        setSkipped(sk);
        if (r.skipped.length) {
          toast(r.count
            ? `${r.skipped.length} item belum ditambahkan (${r.skipped[0].reason}). Tambahkan manual dari menunya ya.`
            : `Belum ada yang ditambahkan: ${r.skipped[0].reason}. Tambahkan manual dari menunya ya.`);
        }
      } else if (kind === 'undo' && action) {
        await ops.undo(message, action);
        setSkipped(new Map());
      } else if (kind === 'cancel') {
        await ops.cancel(message, action);
      }
    } catch {
      toast(kind === 'undo' ? 'Belum bisa diurungkan. Coba lagi ya.' : 'Belum bisa disimpan. Coba lagi ya.');
    } finally {
      setBusy(null);
    }
  };

  const dest = applied.length ? proposalDest(applied.map((i) => items[i]).filter(Boolean)) : proposals.dest;
  const count = applied.length || (action?.applied_refs?.length ?? 0);

  return (
    <div className={cx('shrink-0 self-start overflow-hidden border border-brand-200 bg-surface', panel ? 'w-full rounded-2xl' : 'w-[92%] rounded-3xl')}>
      <div className={cx('flex items-center gap-2 bg-primary-soft', panel ? 'px-3 py-2.25' : 'px-3.5 py-2.5')}>
        {!panel && <Icon.Sparkle size={16} className="shrink-0 text-primary" />}
        <span className={cx('font-extrabold text-brand-800', panel ? 'text-meta-lg' : 'text-label')}>{proposals.title}</span>
      </div>
      <ul className={cx('m-0 list-none', panel ? 'p-0' : 'px-1.5 py-1')} aria-label={proposals.title}>
        {items.map((it, i) => {
          const on = isOn(i);
          const skip = skipped.get(i);
          return (
            <li key={i}>
              <button
                type="button"
                aria-pressed={on}
                disabled={!open || !!busy}
                onClick={() => setSel((s) => s.map((v, j) => (j === i ? !v : v)))}
                className={cx(
                  'flex w-full items-center bg-transparent text-left disabled:cursor-default',
                  panel ? 'min-h-11 gap-2.25 px-3 py-2' : 'min-h-11 gap-2.5 rounded-md p-2',
                  open && 'hover:bg-surface-2',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cx(
                    'flex shrink-0 items-center justify-center rounded-sm',
                    panel ? 'size-5' : 'size-5.5',
                    on ? 'bg-brand-500' : 'border-2 border-n-300 bg-surface',
                  )}
                >
                  {on && <Icon.Check size={panel ? 11 : 12} strokeWidth={3.4} className="text-on-primary" />}
                </span>
                <Tag tone={KIND_TONE[it.kind] ?? 'neutral'} className="px-1.75 py-0.75 text-2xs font-extrabold">{it.kind}</Tag>
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className={cx('font-bold text-ink', panel ? 'text-label' : 'text-label-lg')}>{it.label}</span>
                  <span className={cx('text-ink-3', panel ? 'text-small' : 'text-meta')}>
                    {it.detail}
                    {skip && <span className="font-bold text-warn-fg"> · {skip === 'perlu dipilih' ? 'perlu dipilih' : `dilewati: ${skip}`}</span>}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && (
        <div className={cx('flex flex-col gap-1.5', panel ? 'px-3 pt-1 pb-3' : 'px-3 pt-1.5 pb-3')}>
          {state === 'undone' && <span className="text-meta font-semibold text-ink-3">Diurungkan. Data tadi sudah dihapus.</span>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={nOn === 0 || !!busy}
              onClick={() => void run('apply')}
              className={cx(
                'flex-1 rounded-full font-extrabold transition-colors',
                panel ? 'h-10 text-label' : 'h-11 text-label-lg',
                nOn === 0 ? 'bg-line-strong text-ink-3' : 'bg-primary text-on-primary hover:bg-primary-hover',
              )}
            >
              {busy === 'apply' ? 'Menyimpan…' : applyLabel(items.length, nOn)}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void run('cancel')}
              className={cx('rounded-full border border-line-strong bg-surface font-bold text-ink-muted hover:bg-surface-2', panel ? 'h-10 px-3.5 text-label' : 'h-11 px-4 text-label-lg')}
            >
              Batal
            </button>
          </div>
        </div>
      )}
      {state === 'applied' && (
        <div className={cx('flex items-center justify-between gap-2', panel ? 'px-3 pt-1.5 pb-2' : 'px-3.5 pt-2 pb-1.5')}>
          <span role="status" className={cx('flex items-center gap-1 font-bold text-brand-800', panel ? 'text-meta' : 'text-meta-lg')}>
            <Icon.Check size={13} strokeWidth={2.8} className="shrink-0" />
            {count} item ditambahkan ke {dest}
          </span>
          {canUndo(action) && (
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void run('undo')}
              className={cx('h-11 shrink-0 bg-transparent px-1 font-extrabold text-primary', panel ? 'text-meta' : 'text-meta-lg')}
            >
              {busy === 'undo' ? 'Mengurungkan…' : 'Urungkan'}
            </button>
          )}
        </div>
      )}
      {state === 'cancelled' && (
        <div className={cx(panel ? 'px-3 pt-1.5 pb-3' : 'px-3.5 pt-2 pb-3')}>
          <span role="status" className={cx('font-bold text-ink-3', panel ? 'text-meta' : 'text-meta-lg')}>Dibatalkan, tidak ada yang diubah</span>
        </div>
      )}
    </div>
  );
}
