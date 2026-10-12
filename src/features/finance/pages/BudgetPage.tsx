// Anggaran `/keuangan/anggaran` (FIN-05, FIN-04): total + per kategori (effective_from = awal siklus), bar per kategori,
// awal siklus (budget_cycle_day 1–28), kelola kategori (tambah/ubah nama/arsipkan).
import { useMemo, useState, type FormEvent } from 'react';
import { BULAN } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, Columns, EmptyState, ErrorState, IconButton, ListSkeleton, Page, ProgressBar, ScreenHeader, SectionTitle, Segmented, StatTile,
  budgetBarColor, inputCls,
} from '@/components/ui';
import { useRows, useSettings, useUpdate, useUpdateSettings, useUpsert } from '@/data/hooks';
import type { Budget, Category } from '@/data/types';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useToday } from '@/lib/hooks';
import { toast, toastUndo } from '@/stores/ui';
import { budgetUsedPct } from '@common/calc/index.ts';
import { activeBudget, cycleLabel } from '../derive';
import { useFinanceSummary } from '../hooks';
import { ArchiveIcon, CategoryBadge, MoneyInput, SelectField, dataTint } from '../components/bits';

const TOTAL = '__total__';

/* ---------- Ringkasan ---------- */
function Summary() {
  const money = useMoney();
  const { data: f } = useFinanceSummary();
  const month = BULAN[f.cycleMonth];
  return (
    <Card className="flex flex-col gap-2.5 rounded-4xl p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body font-extrabold">Anggaran {month}</span>
        <span className="text-label font-bold text-ink-2">{f.budgetTotal ? `${f.budgetUsedPct}% dari ${money.rp(f.budgetTotal)}` : 'Belum diatur'}</span>
      </div>
      <ProgressBar value={f.budgetUsedPct} height={10} color={budgetBarColor(f.budgetUsedPct)} label="Anggaran terpakai" />
      <div className="grid grid-cols-2 gap-2">
        <StatTile tone="soft" label="Aman per hari" value={<span className="tabular">{f.budgetTotal ? money.rp(f.safeDaily) : '–'}</span>} />
        <StatTile tone="plain" label="Keluar hari ini" value={<span className="tabular">{money.rp(f.spentToday)}</span>} />
        <StatTile tone="plain" label="Terpakai siklus ini" value={<span className="tabular">{money.rp(f.spentCycle)}</span>} />
        <StatTile tone="plain" label="Sisa anggaran" value={<span className="tabular">{f.budgetTotal ? money.rp(Math.max(0, f.budgetTotal - f.spentCycle)) : '–'}</span>} />
      </div>
    </Card>
  );
}

/* ---------- Atur nominal ---------- */
function BudgetEditor({ categories, budgets }: { categories: Category[]; budgets: Budget[] }) {
  const money = useMoney();
  const today = useToday();
  const { data: f } = useFinanceSummary();
  const upsert = useUpsert('budgets');
  const [draft, setDraft] = useState<Record<string, number>>({});
  const expenseCats = categories.filter((c) => c.kind === 'expense' && !c.archived).sort((a, b) => a.sort - b.sort);
  const spent = new Map(f.byCategory.map((r) => [r.categoryId, r.amount]));
  const current = (key: string) => activeBudget(budgets, key === TOTAL ? null : key, today) ?? 0;
  const value = (key: string) => draft[key] ?? current(key);
  const changed = Object.keys(draft).filter((k) => draft[k] !== current(k));
  const catSum = expenseCats.reduce((s, c) => s + value(c.id), 0);
  const total = value(TOTAL);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!changed.length) return;
    const rows: Partial<Budget>[] = changed.map((k) => {
      const category_id = k === TOTAL ? null : k;
      const same = budgets.find((b) => (b.category_id ?? null) === category_id && b.effective_from === f.cycleStart);
      return { ...(same ?? {}), category_id, amount: draft[k], effective_from: f.cycleStart };
    });
    upsert.save(rows).then(() => toast('Anggaran disimpan.')).catch(() => toast('Gagal menyimpan anggaran. Coba lagi.'));
    setDraft({});
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <SectionTitle title="Atur anggaran" />
      <Card className="flex flex-col gap-4 p-4">
        <MoneyInput label={`Total anggaran per siklus (${cycleLabel(f.cycleStart, f.cycleEnd)})`} value={total} onChange={(n) => setDraft((d) => ({ ...d, [TOTAL]: n }))} hint="Kosongkan (0) bila belum mau memakai anggaran." />
        <div className="flex flex-col gap-1">
          <span className="text-label font-bold text-ink-muted">Per kategori (opsional)</span>
          <span className="text-meta text-ink-3">
            Jumlah per kategori <span className="tabular font-bold text-ink-2">{money.rp(catSum)}</span>
            {total > 0 && <> dari total <span className="tabular font-bold text-ink-2">{money.rp(total)}</span></>}
            {total > 0 && catSum > total && <span className="font-semibold text-danger-fg"> · melebihi total</span>}
          </span>
        </div>
        <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
          {expenseCats.map((c) => {
            const b = value(c.id);
            const used = spent.get(c.id) ?? 0;
            const pct = b > 0 ? budgetUsedPct(used, b) : 0;
            return (
              <li key={c.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  <CategoryBadge category={c} small />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body font-bold">{c.name}</span>
                    <span className="truncate text-meta text-ink-3">
                      Terpakai <span className="tabular font-bold text-ink-2">{money.rp(used)}</span>{b > 0 ? ` · ${pct}%` : ' · tanpa batas'}
                    </span>
                  </span>
                  <div className="w-36 shrink-0">
                    <MoneyInput compact label={`Anggaran ${c.name}`} value={b} onChange={(n) => setDraft((d) => ({ ...d, [c.id]: n }))} />
                  </div>
                </div>
                {b > 0 && <ProgressBar value={pct} height={8} color={budgetBarColor(pct)} label={`${c.name} ${pct} persen dari anggaran`} />}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {changed.length > 0 && <Button variant="secondary" onClick={() => setDraft({})}>Batal</Button>}
          <Button type="submit" disabled={!changed.length}>Simpan anggaran</Button>
        </div>
      </Card>
    </form>
  );
}

/* ---------- Siklus ---------- */
function CycleSetting() {
  const s = useSettings();
  const update = useUpdateSettings();
  const options = Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `Tanggal ${i + 1}` }));
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Siklus anggaran" />
      <Card className="flex flex-col gap-2 p-4">
        <SelectField
          label="Siklus mulai"
          value={String(s.budget_cycle_day)}
          options={options}
          onChange={(v) => { update.mutate({ budget_cycle_day: Number(v) }); toast(`Siklus anggaran mulai tanggal ${v}.`); }}
        />
        <span className="text-meta text-ink-3">Mis. tanggal kiriman/gajian. "Aman per hari" dihitung sampai akhir siklus.</span>
      </Card>
    </div>
  );
}

/* ---------- Kategori ---------- */
function CategoryRow({ c, palette }: { c: Category; palette: string[] }) {
  const upd = useUpdate('categories');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(c.name);
  const save = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 24);
    if (!n) return;
    void upd.patch(c.id, { name: n });
    setEditing(false);
  };
  const archive = (v: boolean) => {
    void upd.patch(c.id, { archived: v });
    if (v) toastUndo(`Kategori "${c.name}" diarsipkan.`, () => void upd.patch(c.id, { archived: false }));
  };
  if (editing) {
    return (
      <li className="flex flex-col gap-2 border-b border-surface-2 py-2 last:border-b-0">
        <form onSubmit={save} className="flex items-center gap-2">
          <label htmlFor={`cat-${c.id}`} className="sr-only">Nama kategori</label>
          <input id={`cat-${c.id}`} autoFocus value={name} maxLength={24} onChange={(e) => setName(e.target.value)} className={cx(inputCls, 'h-11 flex-1')} />
          <Button type="submit" size="sm" disabled={!name.trim()}>Simpan</Button>
          <Button size="sm" variant="secondary" onClick={() => { setName(c.name); setEditing(false); }}>Batal</Button>
        </form>
        {palette.length > 0 && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Warna kategori">
            {palette.map((col) => (
              <button
                key={col}
                type="button"
                aria-label={`Warna ${palette.indexOf(col) + 1}`}
                aria-pressed={c.color === col}
                onClick={() => void upd.patch(c.id, { color: col })}
                className={cx('flex size-11 items-center justify-center rounded-full bg-transparent')}
              >
                <span className={cx('flex size-7 items-center justify-center rounded-full', c.color === col && 'ring-2 ring-brand-400 ring-offset-2')} style={dataTint(col)}>
                  {c.color === col && <Icon.Check size={14} />}
                </span>
              </button>
            ))}
          </div>
        )}
      </li>
    );
  }
  return (
    <li className="flex items-center gap-2 border-b border-surface-2 py-1 last:border-b-0">
      <CategoryBadge category={c} small />
      <span className={cx('min-w-0 flex-1 truncate text-body font-semibold', c.archived && 'text-ink-3')}>{c.name}</span>
      {c.archived ? (
        <Button size="xs" variant="outline-soft" onClick={() => archive(false)}>Aktifkan</Button>
      ) : (
        <>
          <IconButton variant="plain" label={`Ubah ${c.name}`} onClick={() => setEditing(true)}><Icon.Edit size={18} /></IconButton>
          <IconButton variant="plain" label={`Arsipkan ${c.name}`} onClick={() => archive(true)}><ArchiveIcon size={18} /></IconButton>
        </>
      )}
    </li>
  );
}

function CategoryManager({ categories }: { categories: Category[] }) {
  const upsert = useUpsert('categories');
  const [kind, setKind] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const palette = useMemo(() => [...new Set(categories.map((c) => c.color).filter((x): x is string => !!x))].slice(0, 10), [categories]);
  const list = categories.filter((c) => c.kind === kind).sort((a, b) => a.sort - b.sort);
  const active = list.filter((c) => !c.archived);
  const archived = list.filter((c) => c.archived);
  const dup = active.some((c) => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().slice(0, 24);
    if (!n || dup) return;
    const color = palette[list.length % Math.max(1, palette.length)] ?? null;
    upsert.save({ kind, name: n, color, icon: null, sort: Math.max(0, ...list.map((c) => c.sort)) + 1, archived: false, is_default: false })
      .then(() => toast(`Kategori "${n}" ditambahkan.`))
      .catch(() => toast('Gagal menambah kategori.'));
    setName('');
  };
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle title="Kategori" />
      <Card className="flex flex-col gap-3 p-4">
        <Segmented label="Jenis kategori" options={[{ value: 'expense', label: 'Pengeluaran' }, { value: 'income', label: 'Pemasukan' }]} value={kind} onChange={(v) => { setKind(v); setShowArchived(false); }} />
        {active.length ? (
          <ul className="m-0 flex list-none flex-col p-0">{active.map((c) => <CategoryRow key={c.id} c={c} palette={palette} />)}</ul>
        ) : <EmptyState compact text="Belum ada kategori aktif." />}
        <form onSubmit={add} className="flex items-start gap-2">
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="new-cat" className="sr-only">Nama kategori baru</label>
            <input id="new-cat" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder={kind === 'expense' ? 'Kategori baru, mis. Laundry' : 'Kategori baru, mis. Beasiswa'} className={cx(inputCls, 'h-11')} />
            {dup && name.trim() && <span role="alert" className="text-meta font-semibold text-danger-fg">Nama kategori sudah ada.</span>}
          </div>
          <Button type="submit" disabled={!name.trim() || dup}>+ Tambah</Button>
        </form>
        {archived.length > 0 && (
          <div className="flex flex-col gap-1">
            <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)} className="flex h-11 items-center gap-1 bg-transparent text-label font-bold text-ink-2">
              Diarsipkan ({archived.length}) {showArchived ? <Icon.ChevronUp size={16} /> : <Icon.ChevronDown size={16} />}
            </button>
            {showArchived && <ul className="m-0 flex list-none flex-col p-0">{archived.map((c) => <CategoryRow key={c.id} c={c} palette={palette} />)}</ul>}
          </div>
        )}
      </Card>
    </div>
  );
}

export default function BudgetPage() {
  const desktop = useIsDesktop();
  const { data: f, loading, error, refetch } = useFinanceSummary();
  const categories = useRows('categories').rows;
  const budgets = useRows('budgets').rows;
  const header = <ScreenHeader back="/keuangan" overline={`Siklus ${cycleLabel(f.cycleStart, f.cycleEnd)} · sisa ${f.daysLeft} hari`} title="Anggaran" />;
  if (loading) return <Page narrow>{header}<div className="px-4 pt-4 lg:px-0"><ListSkeleton rows={4} /></div></Page>;
  const left = <><Summary /><BudgetEditor categories={categories} budgets={budgets} /></>;
  const right = <><CycleSetting /><CategoryManager categories={categories} /></>;
  return (
    <Page>
      {header}
      {error && <div className="px-4 pt-4 lg:px-0 lg:pt-0"><ErrorState onRetry={refetch} /></div>}
      {desktop ? <Columns left={left} right={right} /> : <div className="flex flex-col gap-5 px-4 pt-4">{left}{right}</div>}
    </Page>
  );
}
