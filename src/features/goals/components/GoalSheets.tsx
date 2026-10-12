// Form target (GOAL-01, GOAL-05 saran dana darurat, GOAL-06 rencana setoran) & setor/tarik (GOAL-02, GOAL-07 perayaan).
import { useId, useMemo, useState, type FormEvent } from 'react';
import { emergencyFundTarget, goalProgressPct } from '@common/calc/index.ts';
import { Button, Chip, Field, Segmented, Sheet, inputCls } from '@/components/ui';
import { useRows, useUpsert, useRemove } from '@/data/hooks';
import { uuid } from '@/data/repo';
import type { GoalContribution, SavingsGoal } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { avgMonthlyExpense } from '@/features/finance/derive';
import { DateField, MoneyInput, SelectField, SensitiveNote, sensitiveCheck } from '@/features/finance/components/bits';
import { GOAL_KIND_LABEL, crossedMilestone, goalSaved, goalView } from '../derive';

const KINDS = Object.keys(GOAL_KIND_LABEL) as SavingsGoal['kind'][];
const KIND_ICON: Record<SavingsGoal['kind'], string> = { dana_darurat: 'shield', barang: 'laptop', pendidikan: 'cap', investasi: 'trend', lainnya: 'target' };

/** "4,5" → 4.5 (persen, bukan uang). */
function parsePct(s: string): number {
  const n = Number.parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n * 100) / 100)) : 0;
}

export function GoalFormSheet({ open, onClose, editing, onSaved }: { open: boolean; onClose: () => void; editing?: SavingsGoal; onSaved?: (id: string) => void }) {
  const today = useToday();
  const money = useMoney();
  const goals = useRows('savings_goals').rows;
  const contributions = useRows('goal_contributions').rows;
  const txs = useRows('transactions').rows;
  const upsert = useUpsert('savings_goals');
  const formId = useId();
  const nameId = useId();
  const pctId = useId();
  const [name, setName] = useState(editing?.name ?? '');
  const [kind, setKind] = useState<SavingsGoal['kind']>(editing?.kind ?? 'dana_darurat');
  const [target, setTarget] = useState(editing?.target_amount ?? 0);
  const [due, setDue] = useState(editing?.due_date ?? '');
  const [ret, setRet] = useState(editing ? String(editing.assumed_return_pct).replace('.', ',') : '0');
  const [plan, setPlan] = useState(editing?.monthly_plan ?? 0);
  const [planDay, setPlanDay] = useState(editing?.plan_day ?? 5);
  const [priority, setPriority] = useState<string>(String(Math.min(3, editing?.priority ?? (goals.filter((g) => g.status === 'aktif').length ? 2 : 1))));
  const [months, setMonths] = useState<'3' | '6' | '12'>('6');
  const avg = useMemo(() => avgMonthlyExpense(txs, today), [txs, today]);
  const suggestion = emergencyFundTarget(avg, Number(months));
  const sens = sensitiveCheck(name);
  const valid = !!name.trim() && target > 0 && !sens.block;

  const draft: SavingsGoal = {
    ...(editing ?? { id: 'draft', status: 'aktif' as const }),
    name, kind, target_amount: target, due_date: due || null, assumed_return_pct: parsePct(ret),
    monthly_plan: plan || null, plan_day: plan ? planDay : null, priority: Number(priority),
  };
  const preview = target > 0 ? goalView(draft, contributions, today) : null;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const id = editing?.id ?? uuid();
    const row: Partial<SavingsGoal> = {
      ...(editing ?? { status: 'aktif' as const, color: null }),
      id, name: name.trim().slice(0, 60), kind, target_amount: target, due_date: due || null, assumed_return_pct: parsePct(ret),
      monthly_plan: plan || null, plan_day: plan ? planDay : null, priority: Number(priority),
      icon: editing?.icon && editing.kind === kind ? editing.icon : KIND_ICON[kind],
    };
    upsert.save(row).catch(() => toast('Gagal menyimpan target.'));
    onClose();
    toast(editing ? 'Target diperbarui.' : `Target "${row.name}" dibuat. Semangat nabung!`);
    onSaved?.(id);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editing ? 'Ubah target' : 'Target baru'}
      closeButton
      desktopWidth={480}
      footer={<Button type="submit" form={formId} block disabled={!valid}>Simpan</Button>}
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label="Nama target" htmlFor={nameId}>
          <input id={nameId} data-autofocus="" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="mis. Dana darurat, Laptop baru" className={inputCls} />
        </Field>
        <SensitiveNote message={sens.message} />
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Jenis</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Jenis target">
            {KINDS.map((k) => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{GOAL_KIND_LABEL[k]}</Chip>)}
          </div>
        </div>
        <MoneyInput label="Target nominal" value={target} onChange={setTarget} />
        {kind === 'dana_darurat' && (
          <div className="flex flex-col gap-2 rounded-lg bg-target-bg p-3">
            <span className="text-label font-bold text-warn-strong">Saran dana darurat</span>
            {avg > 0 ? (
              <>
                <span className="text-meta text-ink-2">
                  Rata-rata pengeluaranmu {money.rp(avg)}/bulan (3 bulan terakhir). {months} bulan × rata-rata = <span className="tabular font-bold text-ink">{money.rp(suggestion)}</span>.
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented label="Jumlah bulan" className="w-48" options={[{ value: '3', label: '3 bln' }, { value: '6', label: '6 bln' }, { value: '12', label: '12 bln' }]} value={months} onChange={setMonths} />
                  <Button size="xs" variant="outline-soft" onClick={() => setTarget(suggestion)}>Pakai saran</Button>
                </div>
              </>
            ) : <span className="text-meta text-ink-2">Catat pengeluaran beberapa waktu dulu, nanti Hamzi bisa kasih saran nominal.</span>}
          </div>
        )}
        <DateField label="Tenggat (opsional)" value={due} min={today} optional onChange={setDue} />
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <MoneyInput label="Setoran per bulan (opsional)" value={plan} onChange={setPlan} />
          <div className="w-32">
            <SelectField label="Tanggal setor" value={String(planDay)} options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Tgl ${i + 1}` }))} onChange={(v) => setPlanDay(Number(v))} />
          </div>
        </div>
        <Field label="Asumsi imbal hasil per tahun (%)" htmlFor={pctId} hint="Isi 0 untuk tabungan biasa. Ini asumsi, bukan jaminan.">
          <input id={pctId} inputMode="decimal" value={ret} onChange={(e) => setRet(e.target.value.replace(/[^\d,.]/g, '').slice(0, 6))} className={inputCls} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-label font-bold text-ink-muted">Prioritas</span>
          <Segmented label="Prioritas" options={[{ value: '1', label: 'Utama' }, { value: '2', label: 'Sedang' }, { value: '3', label: 'Rendah' }]} value={priority} onChange={setPriority} />
        </div>
        {preview && (
          <p className={cx('m-0 rounded-lg px-3 py-2.5 text-label', preview.onTrack === false ? 'bg-warn-banner text-warn-fg' : 'bg-surface-2 text-ink-2')}>
            {preview.monthly !== null
              ? <>Butuh <span className="tabular font-bold">{money.rp(preview.monthly)}</span>/bulan selama {preview.monthsLeft} bulan{preview.onTrack === false ? ' — rencana setoranmu masih kurang.' : '.'}</>
              : 'Tanpa tenggat: nabung sesuai kemampuan, progres tetap dihitung.'}
          </p>
        )}
      </form>
    </Sheet>
  );
}

/** Setor (+) / Tarik (−) ke target. */
export function ContributionSheet({ open, onClose, goal, mode: initialMode }: { open: boolean; onClose: () => void; goal: SavingsGoal; mode: 'setor' | 'tarik' }) {
  const today = useToday();
  const money = useMoney();
  const contributions = useRows('goal_contributions').rows;
  const upsert = useUpsert('goal_contributions');
  const remover = useRemove('goal_contributions');
  const react = useUi((s) => s.react);
  const formId = useId();
  const noteId = useId();
  const [mode, setMode] = useState(initialMode);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const saved = goalSaved(goal.id, contributions);
  const over = mode === 'tarik' && amount > saved;
  const sens = sensitiveCheck(note);
  const valid = amount > 0 && !over && !!date && !sens.block;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    const row: GoalContribution = { id: uuid(), goal_id: goal.id, amount: mode === 'setor' ? amount : -amount, contributed_at: date, note: note.trim() || null, deleted_at: null };
    upsert.save(row).catch(() => toast('Gagal menyimpan.'));
    onClose();
    const prevPct = goalProgressPct(saved, goal.target_amount);
    const nextPct = goalProgressPct(saved + row.amount, goal.target_amount);
    const m = crossedMilestone(prevPct, nextPct);
    if (m) react('celebrate', m === 100 ? `${goal.name} tercapai 100%! Hebat!` : `Target ${m}% tercapai!`);
    const text = m ? `Mantap! ${goal.name} sudah ${m}%.` : mode === 'setor' ? 'Setoran tersimpan.' : 'Penarikan tersimpan.';
    toastUndo(text, () => void remover.remove(row.id));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'setor' ? `Setor ke ${goal.name}` : `Tarik dari ${goal.name}`}
      closeButton
      footer={<Button type="submit" form={formId} block disabled={!valid}>{mode === 'setor' ? 'Setor' : 'Tarik'}</Button>}
    >
      <form id={formId} onSubmit={submit} className="flex flex-col gap-3.5">
        <Segmented label="Jenis" options={[{ value: 'setor', label: 'Setor' }, { value: 'tarik', label: 'Tarik' }]} value={mode} onChange={setMode} />
        <MoneyInput autoFocus label="Nominal" value={amount} onChange={setAmount} error={over ? `Maksimal ${money.rp(saved)} (yang sudah terkumpul).` : undefined} />
        {mode === 'setor' && goal.monthly_plan ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip aria-pressed={undefined} onClick={() => setAmount(goal.monthly_plan ?? 0)}>Sesuai rencana {money.short(goal.monthly_plan)}</Chip>
          </div>
        ) : null}
        <DateField label="Tanggal" value={date} max={today} onChange={setDate} />
        <Field label="Catatan (opsional)" htmlFor={noteId}>
          <input id={noteId} value={note} maxLength={140} onChange={(e) => setNote(e.target.value)} className={inputCls} placeholder={mode === 'setor' ? 'mis. sisa uang jajan' : 'mis. bayar servis motor'} />
        </Field>
        <SensitiveNote message={sens.message} />
      </form>
    </Sheet>
  );
}
