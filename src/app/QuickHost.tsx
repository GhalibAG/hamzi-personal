// Host global untuk sheet tambah cepat (FAB, pintasan N/E/T/R, ?quick=, kartu Kata Hamzi, manifest shortcuts).
import { lazy, Suspense } from 'react';
import { useUi, type QuickKind } from '@/stores/ui';
import type { QuickSheetProps } from './quick';

type C = React.LazyExoticComponent<(p: QuickSheetProps) => React.ReactNode>;

const SHEETS: Partial<Record<QuickKind, C>> = {
  expense: lazy(() => import('@/features/finance/components/QuickTransactionSheet').then((m) => ({ default: m.QuickTransactionSheet }))),
  income: lazy(() => import('@/features/finance/components/QuickTransactionSheet').then((m) => ({ default: m.QuickTransactionSheet }))),
  task: lazy(() => import('@/features/tasks/components/TaskFormSheet').then((m) => ({ default: m.TaskFormSheet }))),
  'course-task': lazy(() => import('@/features/tasks/components/TaskFormSheet').then((m) => ({ default: m.TaskFormSheet }))),
  event: lazy(() => import('@/features/calendar/components/EventFormSheet').then((m) => ({ default: m.EventFormSheet }))),
  routine: lazy(() => import('@/features/routines/components/RoutineFormSheet').then((m) => ({ default: m.RoutineFormSheet }))),
  module: lazy(() => import('@/features/learning/components/ModuleFormSheet').then((m) => ({ default: m.ModuleFormSheet }))),
  timer: lazy(() => import('@/features/learning/components/StartTimerSheet').then((m) => ({ default: m.StartTimerSheet }))),
  exam: lazy(() => import('@/features/courses/components/ExamFormSheet').then((m) => ({ default: m.ExamFormSheet }))),
  course: lazy(() => import('@/features/courses/components/CourseFormSheet').then((m) => ({ default: m.CourseFormSheet }))),
};

export function QuickHost() {
  const quick = useUi((s) => s.quick);
  const close = useUi((s) => s.closeQuick);
  if (!quick) return null;
  const Comp = SHEETS[quick.kind];
  if (!Comp) return null;
  const initial = quick.kind === 'income' ? { kind: 'income', ...quick.initial } : quick.kind === 'expense' ? { kind: 'expense', ...quick.initial } : quick.kind === 'course-task' ? { source_tag: 'kuliah', ...quick.initial } : quick.initial;
  return (
    <Suspense fallback={null}>
      <Comp key={`${quick.kind}-${JSON.stringify(initial ?? {})}`} open onClose={close} initial={initial} />
    </Suspense>
  );
}
