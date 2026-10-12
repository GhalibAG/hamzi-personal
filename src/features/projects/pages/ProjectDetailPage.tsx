// `/rencana/proyek/:id` — header warna jenis, bar progres, milestone (tambah/ubah/status), tugas per milestone. UI-SPEC §3.5, PRD PROJ-01..03.
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Icon } from '@/components/icons';
import {
  Button, Card, EmptyState, ErrorState, IconButton, ListSkeleton, Menu, Page, ProgressBar, ScreenHeader, SectionLink, SectionTitle, Stack,
} from '@/components/ui';
import { useRemove, useRows, useUpdate } from '@/data/hooks';
import type { Milestone, Project, Subtask, Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useNow, useToday } from '@/lib/hooks';
import { toast, toastUndo, useUi } from '@/stores/ui';
import { isOpen, orderByScore, planMeta } from '@/features/tasks/derive';
import { useTaskToggle } from '@/features/tasks/hooks';
import { TaskRow } from '@/features/tasks/components/TaskRow';
import { KIND_STYLE } from '../components/ProjectCard';
import { MilestoneSheet, ProjectFormSheet } from '../components/ProjectSheets';
import {
  KIND_LABEL, MS_STATUS_LABEL, NEXT_MS_STATUS, STATUS_LABEL, projectDueText, projectMilestones, projectTasks, shortDate, taskStats,
} from '../derive';

function StatusDot({ status }: { status: Milestone['status'] }) {
  if (status === 'selesai') return <span className="flex size-6 items-center justify-center rounded-full bg-brand-500 text-on-primary"><Icon.Check size={14} strokeWidth={3.2} /></span>;
  if (status === 'berjalan') return <span className="flex size-6 items-center justify-center rounded-full border-2 border-ink"><span className="size-2.5 rounded-full bg-ink" /></span>;
  return <span className="size-6 rounded-full border-2 border-n-300" />;
}

function TaskGroup({ title, meta, tasks, subtasks, today, now, status, onStatus, onEdit, onAdd, empty }: {
  title: string; meta?: string; tasks: Task[]; subtasks: Subtask[]; today: string; now: Date;
  status?: Milestone['status']; onStatus?: () => void; onEdit?: () => void; onAdd: () => void; empty: string;
}) {
  const toggle = useTaskToggle();
  const [showDone, setShowDone] = useState(false);
  const open = orderByScore(tasks.filter(isOpen), now);
  const done = tasks.filter((t) => t.status === 'selesai');
  const shown = showDone ? [...open, ...done] : open;
  return (
    <Card className="flex flex-col gap-1 px-2 py-2">
      <div className="flex items-center gap-1">
        {status && onStatus ? (
          <button
            type="button"
            onClick={onStatus}
            aria-label={`Status ${title}: ${MS_STATUS_LABEL[status]}. Ketuk untuk ubah ke ${MS_STATUS_LABEL[NEXT_MS_STATUS[status]]}`}
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-transparent hover:bg-surface-2"
          >
            <StatusDot status={status} />
          </button>
        ) : <span className="w-3" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className={cx('text-card', status === 'selesai' ? 'font-semibold text-ink-3 line-through' : status === 'belum' ? 'font-semibold' : 'font-extrabold')}>{title}</span>
          {meta && <span className="text-meta text-ink-3">{meta}</span>}
        </div>
        {onEdit && <IconButton variant="plain" label={`Ubah milestone ${title}`} onClick={onEdit}><Icon.Edit size={18} /></IconButton>}
      </div>
      {shown.length > 0 ? (
        <div className="px-1">
          {shown.map((t) => <TaskRow key={t.id} t={t} variant="list" onToggle={toggle} meta={planMeta(t, { day: today, today, subtasks })} />)}
        </div>
      ) : (
        <p className="m-0 px-3 py-1 text-label text-ink-3">{done.length ? `Semua ${done.length} tugas selesai.` : empty}</p>
      )}
      <div className="flex flex-wrap items-center gap-1 px-1">
        <Button variant="ghost" size="xs" icon={<Icon.Plus size={16} />} onClick={onAdd}>Tugas</Button>
        {done.length > 0 && (
          <Button variant="ghost" size="xs" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone}>
            {showDone ? 'Sembunyikan selesai' : `Tampilkan ${done.length} selesai`}
          </Button>
        )}
      </div>
    </Card>
  );
}

function Hero({ p, tasks, today, now, onEdit, onAdd }: { p: Project; tasks: Task[]; today: string; now: Date; onEdit: () => void; onAdd: () => void }) {
  const stats = taskStats(tasks, now);
  const due = projectDueText(p, stats, today);
  const k = KIND_STYLE[p.kind];
  return (
    <div className={cx('flex flex-col gap-3 rounded-5xl p-4.5', k.hero)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cx('rounded-full bg-surface px-2.5 py-1 text-meta leading-none font-bold', k.fg)}>{KIND_LABEL[p.kind]}</span>
        {p.status !== 'aktif' && <span className="rounded-full bg-surface px-2.5 py-1 text-meta leading-none font-bold text-ink-2">{STATUS_LABEL[p.status]}</span>}
      </div>
      {p.description && <p className="m-0 text-body leading-[1.5] text-ink-2">{p.description}</p>}
      <ProgressBar value={stats.pct} color={k.bar} track="white" label={`Progres ${p.name}`} />
      <div className="flex justify-between gap-2 text-meta text-ink-2">
        <span className="font-semibold">{stats.done} dari {stats.total} tugas · {stats.pct}%</span>
        <span className={cx(due.danger ? 'font-bold text-danger-fg' : 'font-semibold')}>{due.text}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Icon.Plus size={16} />} onClick={onAdd}>Tugas</Button>
        <Button size="sm" variant="secondary" icon={<Icon.Edit size={16} />} onClick={onEdit}>Ubah proyek</Button>
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const now = useNow(30_000);
  const today = useToday();
  const projects = useRows('projects');
  const milestones = useRows('milestones').rows;
  const tasksQ = useRows('tasks');
  const subtasks = useRows('subtasks').rows;
  const updP = useUpdate('projects');
  const updM = useUpdate('milestones');
  const rmP = useRemove('projects');
  const openQuick = useUi((s) => s.openQuick);
  const [editing, setEditing] = useState(false);
  const [msSheet, setMsSheet] = useState<{ m?: Milestone } | null>(null);
  const p = projects.rows.find((x) => x.id === id);

  const shell = (body: React.ReactNode, title = 'Proyek') => (
    <Page narrow>
      <ScreenHeader back="/rencana?tab=proyek" title={title} />
      <div className="px-4 pt-4 lg:px-0">{body}</div>
    </Page>
  );
  if (projects.isError || tasksQ.isError) return shell(<ErrorState onRetry={() => { void projects.refetch(); void tasksQ.refetch(); }} />);
  if (projects.isLoading || tasksQ.isLoading) return shell(<ListSkeleton rows={4} />);
  if (!p) {
    return shell(<EmptyState mood="worried" title="Proyek tidak ditemukan" text="Mungkin sudah dihapus." action={<Button size="sm" onClick={() => nav('/rencana?tab=proyek')}>Lihat semua proyek</Button>} />);
  }

  const tasks = projectTasks(p.id, tasksQ.rows);
  const ms = projectMilestones(p.id, milestones);
  const msIds = new Set(ms.map((m) => m.id));
  const loose = tasks.filter((t) => !t.milestone_id || !msIds.has(t.milestone_id));
  const addTask = (milestoneId?: string) => openQuick('task', { source_tag: 'proyek', project_id: p.id, milestone_id: milestoneId ?? '', due_date: null });
  const setStatus = (status: Project['status'], msg: string) => {
    const prev = p.status;
    void updP.patch(p.id, { status });
    toastUndo(msg, () => void updP.patch(p.id, { status: prev }));
  };
  const del = async () => {
    await rmP.remove(p.id);
    nav('/rencana?tab=proyek', { replace: true });
    toastUndo('Proyek dihapus', () => void rmP.undo(p.id));
  };
  const cycle = (m: Milestone) => {
    const next = NEXT_MS_STATUS[m.status];
    void updM.patch(m.id, { status: next });
    toast(`${m.title}: ${MS_STATUS_LABEL[next].toLowerCase()}`);
  };

  return (
    <Page narrow>
      <ScreenHeader
        back="/rencana?tab=proyek"
        overline="Proyek"
        title={p.name}
        right={(
          <Menu
            width={220}
            trigger={({ open, toggle }) => (
              <IconButton label="Menu proyek" aria-haspopup="menu" aria-expanded={open} onClick={toggle}><Icon.More size={20} /></IconButton>
            )}
            items={[
              { label: 'Ubah proyek', onSelect: () => setEditing(true) },
              ...(p.status === 'aktif'
                ? [
                    { label: 'Tandai selesai', onSelect: () => setStatus('selesai', 'Proyek ditandai selesai') },
                    { label: 'Tunda proyek', onSelect: () => setStatus('ditunda', 'Proyek ditunda') },
                  ]
                : [{ label: 'Aktifkan lagi', onSelect: () => setStatus('aktif', 'Proyek aktif lagi') }]),
              { label: 'Hapus proyek', danger: true, onSelect: () => void del() },
            ]}
          />
        )}
      />
      <Stack gap="md" className="px-4 pt-4 pb-4 lg:px-0">
        <Hero p={p} tasks={tasks} today={today} now={now} onEdit={() => setEditing(true)} onAdd={() => addTask()} />
        <section className="flex flex-col gap-2.5">
          <SectionTitle title={`Milestone · ${ms.length}`} right={<SectionLink onClick={() => setMsSheet({})}>+ Milestone</SectionLink>} />
          {ms.length === 0 && (
            <EmptyState compact text="Belum ada milestone. Pecah proyek jadi beberapa tahap biar lebih ringan." action={<Button size="xs" onClick={() => setMsSheet({})}>+ Milestone</Button>} />
          )}
          {ms.map((m) => {
            const list = tasks.filter((t) => t.milestone_id === m.id);
            const st = taskStats(list, now);
            const meta = [`${st.done}/${st.total} tugas`, m.due_date ? `Tenggat ${shortDate(m.due_date, today)}` : null].filter(Boolean).join(' · ');
            return (
              <TaskGroup
                key={m.id} title={m.title} meta={meta} tasks={list} subtasks={subtasks} today={today} now={now}
                status={m.status} onStatus={() => cycle(m)} onEdit={() => setMsSheet({ m })} onAdd={() => addTask(m.id)}
                empty="Belum ada tugas di milestone ini."
              />
            );
          })}
        </section>
        {(loose.length > 0 || ms.length === 0) && (
          <section className="flex flex-col gap-2.5">
            <SectionTitle title={ms.length ? 'Tanpa milestone' : 'Tugas'} />
            <TaskGroup title={ms.length ? 'Tugas lain' : 'Semua tugas'} tasks={loose} subtasks={subtasks} today={today} now={now} onAdd={() => addTask()} empty="Belum ada tugas. Tambah satu yuk." />
          </section>
        )}
      </Stack>
      {editing && <ProjectFormSheet open project={p} onClose={() => setEditing(false)} />}
      {msSheet && (
        <MilestoneSheet open projectId={p.id} milestone={msSheet.m} nextSort={(ms.at(-1)?.sort ?? -1) + 1} onClose={() => setMsSheet(null)} />
      )}
    </Page>
  );
}
