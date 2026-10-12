// `/rencana/tugas/baru` & `/rencana/tugas/:id` — form tugas + subtugas (TASK-03) + hapus dengan Urungkan (TASK-01). UI-SPEC §3.5.
// HP: halaman penuh dengan header kembali; desktop: area utama maks 760 px.
import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { taskXp, wibDate, wibTime } from '@common/calc/index.ts';
import { detectSensitive, SENSITIVE_MESSAGE } from '@common/sensitive.ts';
import { Icon } from '@/components/icons';
import {
  Button, Card, CheckBox, EmptyState, ErrorState, IconButton, ListSkeleton, Page, ProgressBar, ScreenHeader, SectionTitle, Stack, inputCls,
} from '@/components/ui';
import { useRemove, useRows, useUpsert } from '@/data/hooks';
import type { Subtask, Task } from '@/data/types';
import { cx } from '@/lib/cx';
import { useToday } from '@/lib/hooks';
import { toastUndo } from '@/stores/ui';
import { SOURCE_LABEL, relDay, taskContext } from '../derive';
import { useTaskToggle } from '../hooks';
import { TaskForm } from '../components/TaskForm';

function StatusCard({ t }: { t: Task }) {
  const toggle = useTaskToggle();
  const today = useToday();
  const done = t.status === 'selesai';
  const at = t.completed_at ? new Date(t.completed_at) : null;
  return (
    <Card className={cx('flex items-center gap-2 py-1.5 pr-4 pl-1.5', done && 'border-brand-200 bg-primary-soft')}>
      <CheckBox checked={done} onToggle={() => toggle(t)} label={(done ? 'Batalkan selesai: ' : 'Tandai selesai: ') + t.title} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cx('text-body font-bold', done ? 'text-brand-800' : 'text-ink')}>{done ? 'Selesai' : t.status === 'dikerjakan' ? 'Sedang dikerjakan' : 'Belum selesai'}</span>
        <span className="text-meta text-ink-3">
          {done && at ? `${relDay(wibDate(at), today)} ${wibTime(at)}` : `Centang untuk +${taskXp(t.priority)} XP`}
        </span>
      </div>
    </Card>
  );
}

function Subtasks({ task, subtasks }: { task: Task; subtasks: Subtask[] }) {
  const upsert = useUpsert('subtasks');
  const rm = useRemove('subtasks');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const list = subtasks.filter((s) => s.task_id === task.id).sort((a, b) => a.sort - b.sort);
  const done = list.filter((s) => s.done).length;
  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const v = title.trim();
    if (!v) { setError('Tulis subtugas dulu'); return; }
    const k = detectSensitive(v)[0];
    if (k) { setError(SENSITIVE_MESSAGE[k]); return; }
    void upsert.save({ task_id: task.id, title: v.slice(0, 200), done: false, sort: (list.at(-1)?.sort ?? -1) + 1 });
    setTitle('');
    setError(null);
  };
  const del = (s: Subtask) => {
    void rm.remove(s.id);
    toastUndo('Subtugas dihapus', () => void upsert.save({ ...s }));
  };
  return (
    <Card className="flex flex-col gap-3 p-4">
      <SectionTitle size="sm" title="Subtugas" right={list.length ? <span className="text-meta font-bold text-ink-3">{done}/{list.length}</span> : undefined} />
      {list.length > 0 && <ProgressBar value={(done / list.length) * 100} height={6} label="Progres subtugas" />}
      {list.length > 0 && (
        <ul className="m-0 flex list-none flex-col p-0">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-1 border-b border-surface-2 last:border-b-0">
              <CheckBox checked={s.done} onToggle={() => void upsert.save({ id: s.id, done: !s.done })} label={(s.done ? 'Batalkan: ' : 'Tandai selesai: ') + s.title} />
              <span className={cx('min-w-0 flex-1 text-body', s.done ? 'text-ink-3 line-through' : 'text-ink')}>{s.title}</span>
              <IconButton variant="plain" label={`Hapus subtugas: ${s.title}`} onClick={() => del(s)}><Icon.X size={18} /></IconButton>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="flex flex-col gap-1.5" noValidate>
        <label htmlFor="sub-new" className="sr-only">Subtugas baru</label>
        <div className="flex gap-2">
          <input id="sub-new" className={inputCls} value={title} onChange={(e) => { setTitle(e.target.value); setError(null); }} placeholder="Tambah subtugas…" maxLength={200} autoComplete="off" aria-invalid={!!error} />
          <Button type="submit" variant="soft" className="shrink-0" icon={<Icon.Plus size={18} />}>Tambah</Button>
        </div>
        {error && <span role="alert" className="text-meta font-semibold text-danger-fg">{error}</span>}
      </form>
    </Card>
  );
}

/** Kembali ke riwayat sebelumnya; bila dibuka langsung (tanpa riwayat) ke /rencana. */
function useBack(): string | true {
  return useLocation().key === 'default' ? '/rencana' : true;
}

function NewTask() {
  const nav = useNavigate();
  const back = useBack();
  return (
    <Page narrow>
      <ScreenHeader back={back} title="Tugas baru" overline="Rencana" />
      <Stack gap="md" className="px-4 pt-4 lg:px-0">
        <Card className="p-4">
          <TaskForm
            formId="task-page-form"
            variant="page"
            onSaved={(row) => nav(`/rencana/tugas/${row.id}`, { replace: true })}
            footer={<Button size="lg" block type="submit">Simpan</Button>}
          />
        </Card>
      </Stack>
    </Page>
  );
}

function ExistingTask({ id }: { id: string }) {
  const nav = useNavigate();
  const back = useBack();
  const tasks = useRows('tasks');
  const subtasks = useRows('subtasks').rows;
  const projects = useRows('projects').rows;
  const courses = useRows('courses').rows;
  const rm = useRemove('tasks');
  const t = tasks.rows.find((x) => x.id === id);

  if (tasks.isError) return <Page narrow><ScreenHeader back="/rencana" title="Detail tugas" /><div className="px-4 pt-4 lg:px-0"><ErrorState onRetry={() => void tasks.refetch()} /></div></Page>;
  if (tasks.isLoading) return <Page narrow><ScreenHeader back="/rencana" title="Detail tugas" /><div className="px-4 pt-4 lg:px-0"><ListSkeleton rows={4} /></div></Page>;
  if (!t) {
    return (
      <Page narrow>
        <ScreenHeader back="/rencana" title="Detail tugas" />
        <div className="px-4 pt-4 lg:px-0">
          <EmptyState mood="worried" title="Tugas tidak ditemukan" text="Mungkin sudah dihapus." action={<Button size="sm" onClick={() => nav('/rencana')}>Kembali ke Rencana</Button>} />
        </div>
      </Page>
    );
  }

  const del = async () => {
    await rm.remove(t.id);
    nav('/rencana', { replace: true });
    toastUndo('Tugas dihapus', () => void rm.undo(t.id));
  };
  const context = taskContext(t, projects, courses);
  const overline = context === SOURCE_LABEL[t.source_tag] ? context : `${SOURCE_LABEL[t.source_tag] ?? 'Pribadi'} · ${context}`;

  return (
    <Page narrow>
      <ScreenHeader
        back={back}
        overline={overline}
        title="Detail tugas"
        right={<IconButton label="Hapus tugas" onClick={() => void del()}><Icon.Trash size={20} /></IconButton>}
      />
      <Stack gap="md" className="px-4 pt-4 lg:px-0">
        <StatusCard t={t} />
        <Card className="p-4">
          <TaskForm
            key={t.id}
            formId="task-page-form"
            task={t}
            variant="page"
            footer={<Button size="lg" block type="submit">Simpan perubahan</Button>}
          />
        </Card>
        <Subtasks task={t} subtasks={subtasks} />
        <Button variant="danger-outline" block icon={<Icon.Trash size={18} />} onClick={() => void del()}>Hapus tugas</Button>
      </Stack>
    </Page>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  return id ? <ExistingTask id={id} /> : <NewTask />;
}
