// `/cari?q=…` — pencarian global (SRCH-01) dengan hasil per kelompok: Tugas, Proyek, Matkul, Transaksi, Modul, Rutinitas.
// Filter tugas (TASK-12): status, prioritas, sumber, proyek, matkul. UI-SPEC §12.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { repeatLabel } from '@common/calc/index.ts';
import { dayLabel } from '@common/format.ts';
import { Icon } from '@/components/icons';
import {
  Card, Chip, EmptyState, ErrorState, Field, IconButton, ListSkeleton, MOD_BG, Page, ScreenHeader, SectionTitle, inputCls, type ModTone,
} from '@/components/ui';
import { useRows } from '@/data/hooks';
import { useMoney } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { activeSemester } from '@/features/courses/derive';
import { KIND_LABEL, projectTasks, taskStats } from '@/features/projects/derive';
import { SOURCE_LABEL, dueLabel } from '@/features/tasks/derive';
import { PRIORITIES, SOURCES } from '@/features/tasks/schema';
import {
  EMPTY_FILTER, GROUP_LABEL, activeFilterCount, highlightParts, search, type GroupKey, type TaskFilter,
} from '../derive';

const LIMIT = 5;
const GROUP_STYLE: Record<GroupKey, { tone: ModTone; icon: ReactNode }> = {
  tugas: { tone: 'rencana', icon: <Icon.Plan size={20} /> },
  proyek: { tone: 'invest', icon: <Icon.File size={20} /> },
  matkul: { tone: 'kuliah', icon: <Icon.Cap size={20} /> },
  transaksi: { tone: 'keuangan', icon: <Icon.Receipt size={20} /> },
  modul: { tone: 'belajar', icon: <Icon.Book size={20} /> },
  rutinitas: { tone: 'rutin', icon: <Icon.Repeat size={20} /> },
  catatan: { tone: 'invest', icon: <Icon.Note size={20} /> },
};

function Hl({ text, q }: { text: string; q: string }) {
  return (
    <>
      {highlightParts(text, q).map((p, i) => (p.hit ? <mark key={i} className="rounded-xs bg-brand-100 text-ink">{p.t}</mark> : <span key={i}>{p.t}</span>))}
    </>
  );
}

interface Row { id: string; to: string; title: string; meta: string; done?: boolean }

function Group({ k, rows, q }: { k: GroupKey; rows: Row[]; q: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return null;
  const st = GROUP_STYLE[k];
  const shown = all ? rows : rows.slice(0, LIMIT);
  return (
    <section aria-label={`${GROUP_LABEL[k]}, ${rows.length} hasil`} className="flex flex-col gap-2">
      <SectionTitle size="sm" title={`${GROUP_LABEL[k]} · ${rows.length}`} />
      <Card className="overflow-hidden">
        <ul className="m-0 list-none p-0">
          {shown.map((r) => (
            <li key={r.id} className="border-b border-surface-2 last:border-b-0">
              <Link to={r.to} className="flex min-h-15 items-center gap-3 px-3.5 py-2.5 text-ink no-underline hover:bg-surface-2">
                <span aria-hidden="true" className={cx('flex size-10 shrink-0 items-center justify-center rounded-lg', MOD_BG[st.tone])}>{st.icon}</span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cx('truncate text-body font-bold', r.done && 'text-ink-3 line-through')}><Hl text={r.title} q={q} /></span>
                  <span className="truncate text-meta text-ink-3">{r.meta}</span>
                </span>
                <Icon.ChevronRight size={18} className="shrink-0 text-ink-3" />
              </Link>
            </li>
          ))}
        </ul>
        {rows.length > LIMIT && (
          <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="h-11 w-full border-t border-surface-2 bg-transparent text-label font-extrabold text-primary hover:bg-surface-2">
            {all ? 'Tampilkan lebih sedikit' : `Lihat semua (${rows.length})`}
          </button>
        )}
      </Card>
    </section>
  );
}

function Filters({ f, setF, projects, courses }: {
  f: TaskFilter; setF: (f: TaskFilter) => void; projects: { id: string; name: string }[]; courses: { id: string; name: string }[];
}) {
  const row = (label: string, children: ReactNode) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-label font-bold text-ink-muted">{label}</span>
      <div role="group" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0">{children}</div>
    </div>
  );
  return (
    <Card id="task-filter" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-body font-extrabold">Filter tugas</span>
        {activeFilterCount(f) > 0 && <button type="button" onClick={() => setF(EMPTY_FILTER)} className="h-9 bg-transparent px-1 text-label font-extrabold text-primary">Reset</button>}
      </div>
      {row('Status', ([['semua', 'Semua'], ['terbuka', 'Belum selesai'], ['selesai', 'Selesai']] as const).map(([v, l]) => (
        <Chip key={v} selected={f.status === v} onClick={() => setF({ ...f, status: v })}>{l}</Chip>
      )))}
      {row('Prioritas', [{ value: 0 as const, label: 'Semua' }, ...PRIORITIES].map((p) => (
        <Chip key={p.value} selected={f.priority === p.value} onClick={() => setF({ ...f, priority: p.value })}>{p.label}</Chip>
      )))}
      {row('Sumber', [{ value: '' as const, label: 'Semua' }, ...SOURCES].map((s) => (
        <Chip key={s.value || 'all'} selected={f.source === s.value} onClick={() => setF({ ...f, source: s.value })}>{s.label}</Chip>
      )))}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Proyek" htmlFor="flt-project">
          <select id="flt-project" className={inputCls} value={f.project} onChange={(e) => setF({ ...f, project: e.target.value })}>
            <option value="">Semua proyek</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Mata kuliah" htmlFor="flt-course">
          <select id="flt-course" className={inputCls} value={f.course} onChange={(e) => setF({ ...f, course: e.target.value })}>
            <option value="">Semua matkul</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>
    </Card>
  );
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const back = useLocation().key === 'default' ? '/rencana' : true;
  const [q, setQ] = useState(params.get('q') ?? '');
  const [f, setF] = useState<TaskFilter>(EMPTY_FILTER);
  const [showFilter, setShowFilter] = useState(false);
  const today = useToday();
  const money = useMoney();
  const tasks = useRows('tasks');
  const projects = useRows('projects');
  const courses = useRows('courses');
  const semesters = useRows('semesters').rows;
  const transactions = useRows('transactions');
  const categories = useRows('categories').rows;
  const wallets = useRows('wallets').rows;
  const modules = useRows('learning_modules');
  const routines = useRows('routines');
  const notes = useRows('notes');
  const queries = [tasks, projects, courses, transactions, modules, routines, notes];
  const loading = queries.some((x) => x.isLoading);
  const isError = queries.some((x) => x.isError);

  const updateQ = (v: string) => {
    setQ(v);
    const p = new URLSearchParams(params);
    if (v) p.set('q', v); else p.delete('q');
    setParams(p, { replace: true });
  };

  const res = useMemo(() => search(q, {
    tasks: tasks.rows, projects: projects.rows, courses: courses.rows, transactions: transactions.rows, categories, wallets,
    modules: modules.rows, routines: routines.rows, notes: notes.rows,
  }, f), [q, f, tasks.rows, projects.rows, courses.rows, transactions.rows, categories, wallets, modules.rows, routines.rows, notes.rows]);

  const prjName = new Map(projects.rows.map((p) => [p.id, p.name]));
  const crsName = new Map(courses.rows.map((c) => [c.id, c.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const groups: [GroupKey, Row[]][] = [
    ['tugas', res.tasks.map((t) => ({
      id: t.id, to: `/rencana/tugas/${t.id}`, title: t.title, done: t.status === 'selesai',
      meta: [t.status === 'selesai' ? 'Selesai' : dueLabel(t, today), SOURCE_LABEL[t.source_tag], (t.project_id && prjName.get(t.project_id)) || (t.course_id && crsName.get(t.course_id))].filter(Boolean).join(' · '),
    }))],
    ['proyek', res.projects.map((p) => {
      const s = taskStats(projectTasks(p.id, tasks.rows), new Date());
      return { id: p.id, to: `/rencana/proyek/${p.id}`, title: p.name, meta: `${KIND_LABEL[p.kind]} · ${s.done} dari ${s.total} tugas` };
    })],
    ['matkul', res.courses.map((c) => ({
      id: c.id, to: `/kuliah/matkul/${c.id}`, title: c.name,
      meta: [c.code, `${c.credits} SKS`, c.semester_id === activeSemester(semesters)?.id ? 'Semester ini' : c.final_grade ? `Nilai ${c.final_grade}` : null].filter(Boolean).join(' · '),
    }))],
    ['transaksi', res.transactions.map((t) => ({
      id: t.id, to: `/keuangan/transaksi?q=${encodeURIComponent(q)}`,
      title: t.note || (t.category_id && catName.get(t.category_id)) || (t.kind === 'income' ? 'Pemasukan' : 'Pengeluaran'),
      meta: [(t.category_id && catName.get(t.category_id)) || null, dayLabel(t.occurred_on), `${t.kind === 'income' ? '+' : '−'}${money.rp(t.amount)}`].filter(Boolean).join(' · '),
    }))],
    ['modul', res.modules.map((m) => ({ id: m.id, to: `/tumbuh/modul/${m.id}`, title: m.title, meta: `Belajar mandiri · target ${m.weekly_target_min} mnt/minggu` }))],
    ['rutinitas', res.routines.map((r) => ({
      id: r.id, to: `/tumbuh/rutinitas/${r.id}`, title: r.name,
      meta: [repeatLabel(r.repeat_days), r.is_required ? 'wajib' : 'kebiasaan', r.archived ? 'diarsip' : null].filter(Boolean).join(' · '),
    }))],
    ['catatan', res.notes.map((n) => ({
      id: n.id, to: `/catatan/${n.id}`,
      title: n.title || n.body.split('\n')[0]?.slice(0, 60) || 'Catatan tanpa judul',
      meta: [dayLabel(n.note_date), n.pinned ? 'Disematkan' : null].filter(Boolean).join(' · '),
    }))],
  ];
  const total = groups.reduce((s, [, r]) => s + r.length, 0);
  const nFilter = activeFilterCount(f);
  const sem = activeSemester(semesters);
  const courseOpts = courses.rows.filter((c) => !c.deleted_at && c.semester_id === sem?.id);
  const projectOpts = projects.rows.filter((p) => !p.deleted_at);

  return (
    <Page narrow>
      <ScreenHeader back={back} overline="Pencarian" title="Cari" />
      <div className="flex flex-col gap-4 px-4 pt-4 pb-6 lg:px-0">
        <form role="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement | null)?.blur(); }} className="flex items-center gap-2">
          <div className="flex h-14 min-w-0 flex-1 items-center gap-2.5 rounded-full border border-line-strong bg-surface pr-1.5 pl-4.5 text-ink-3 focus-within:border-brand-400">
            <Icon.Search size={22} />
            <label htmlFor="global-search" className="sr-only">Cari tugas, proyek, matkul, transaksi, modul, rutinitas</label>
            <input
              id="global-search" type="search" enterKeyHint="search" autoFocus autoComplete="off" value={q} onChange={(e) => updateQ(e.target.value)}
              placeholder="Cari tugas, matkul, transaksi…"
              className="h-full min-w-0 flex-1 border-0 bg-transparent text-section text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
            />
            {q && <IconButton variant="plain" label="Hapus kata kunci" onClick={() => { updateQ(''); document.getElementById('global-search')?.focus(); }}><Icon.X size={18} /></IconButton>}
          </div>
          <button
            type="button" aria-label={nFilter ? `Filter tugas, ${nFilter} aktif` : 'Filter tugas'} aria-expanded={showFilter} aria-controls="task-filter"
            onClick={() => setShowFilter((v) => !v)}
            className={cx(
              'relative flex size-14 shrink-0 items-center justify-center rounded-full border',
              showFilter || nFilter > 0 ? 'border-brand-300 bg-primary-soft text-primary' : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-2',
            )}
          >
            <Icon.Filter size={20} />
            {nFilter > 0 && <span className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-micro font-bold text-on-primary">{nFilter}</span>}
          </button>
        </form>

        {showFilter && <Filters f={f} setF={setF} projects={projectOpts} courses={courseOpts} />}

        <div aria-live="polite" className="sr-only">{q || nFilter ? `${total} hasil` : ''}</div>
        {isError ? (
          <ErrorState text="Data untuk pencarian belum bisa dimuat." onRetry={() => queries.forEach((x) => void x.refetch())} />
        ) : loading ? (
          <ListSkeleton rows={4} />
        ) : !q.trim() && !nFilter ? (
          <EmptyState text="Cari tugas, proyek, matkul, transaksi, modul belajar, atau rutinitas. Ketik minimal satu kata." />
        ) : total === 0 ? (
          <EmptyState mood="worried" text={q.trim() ? `Tidak ada hasil untuk “${q.trim()}”. Coba kata lain atau ubah filter.` : 'Tidak ada tugas yang cocok dengan filter.'} />
        ) : (
          groups.map(([k, rows]) => <Group key={k} k={k} rows={rows} q={q} />)
        )}
      </div>
    </Page>
  );
}
