// Sheet global "Tugas baru" (UI-SPEC §3.4) — dibuka lewat openQuick('task' | 'course-task', initial).
// HP = sheet bawah; desktop = dialog 440. `initial.id` = ubah tugas yang ada.
import { Button, EmptyState, ListSkeleton, Sheet } from '@/components/ui';
import type { QuickSheetProps } from '@/app/quick';
import { useRows } from '@/data/hooks';
import { TaskForm } from './TaskForm';

export function TaskFormSheet({ open, onClose, initial }: QuickSheetProps) {
  const tasks = useRows('tasks');
  const id = typeof initial?.id === 'string' ? initial.id : undefined;
  const task = id ? tasks.rows.find((t) => t.id === id) : undefined;
  const loading = !!id && !task && tasks.isLoading;
  const missing = !!id && !task && !tasks.isLoading;
  const title = task ? 'Ubah tugas' : initial?.source_tag === 'kuliah' ? 'Tugas kuliah baru' : 'Tugas baru';
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      closeButton
      footer={!loading && !missing ? <Button size="lg" block type="submit" form="task-sheet-form">Simpan</Button> : undefined}
    >
      {loading ? (
        <ListSkeleton rows={4} />
      ) : missing ? (
        <EmptyState compact mood="worried" text="Tugas ini tidak ditemukan. Mungkin sudah dihapus." />
      ) : (
        <TaskForm key={task?.id ?? 'new'} formId="task-sheet-form" task={task} initial={initial} onSaved={() => onClose()} />
      )}
    </Sheet>
  );
}
