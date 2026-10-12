// Rute (DESIGN-SYSTEM §9). Setiap halaman di-lazy-load (code splitting per rute, TECH-SPEC §14).
import { lazy, Suspense, type ComponentType } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router';
import { useProfile } from '@/data/hooks';
import { useSession } from '@/features/auth/session';
import { AppShell } from './AppShell';
import { RouteFallback } from './RouteFallback';
import { NotFound } from './NotFound';

const page = (load: () => Promise<{ default: ComponentType }>) => {
  const C = lazy(load);
  return <Suspense fallback={<RouteFallback />}><C /></Suspense>;
};

function RequireAuth() {
  const s = useSession();
  const profile = useProfile();
  const { pathname } = useLocation();
  if (s.status === 'loading' || (s.status === 'in' && profile.isLoading)) return <RouteFallback />;
  if (s.status === 'out') return <Navigate to="/masuk" replace />;
  if (profile.data && !profile.data.onboarded_at && pathname !== '/onboarding') return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/masuk', element: page(() => import('@/features/auth/pages/LoginPage')) },
  {
    element: <RequireAuth />,
    children: [
      { path: '/onboarding', element: page(() => import('@/features/auth/pages/OnboardingPage')) },
      {
        element: <AppShell />,
        children: [
          { index: true, element: page(() => import('@/features/home/pages/HomePage')) },
          { path: 'notifikasi', element: page(() => import('@/features/notifications/pages/NotificationsPage')) },
          { path: 'chat', element: page(() => import('@/features/chat/pages/ChatPage')) },
          { path: 'chat/riwayat', element: page(() => import('@/features/chat/pages/AiHistoryPage')) },
          { path: 'cari', element: page(() => import('@/features/search/pages/SearchPage')) },
          { path: 'rencana', element: page(() => import('@/features/tasks/pages/PlanPage')) },
          { path: 'rencana/tugas/baru', element: page(() => import('@/features/tasks/pages/TaskDetailPage')) },
          { path: 'rencana/tugas/:id', element: page(() => import('@/features/tasks/pages/TaskDetailPage')) },
          { path: 'rencana/proyek/:id', element: page(() => import('@/features/projects/pages/ProjectDetailPage')) },
          { path: 'rencana/kalender', element: page(() => import('@/features/calendar/pages/CalendarPage')) },
          { path: 'kuliah', element: page(() => import('@/features/courses/pages/CoursesPage')) },
          { path: 'kuliah/semester', element: page(() => import('@/features/courses/pages/SemesterPage')) },
          { path: 'kuliah/matkul/:id', element: page(() => import('@/features/courses/pages/CourseDetailPage')) },
          { path: 'keuangan', element: page(() => import('@/features/finance/pages/FinancePage')) },
          { path: 'keuangan/transaksi', element: page(() => import('@/features/finance/pages/TransactionsPage')) },
          { path: 'keuangan/anggaran', element: page(() => import('@/features/finance/pages/BudgetPage')) },
          { path: 'keuangan/dompet', element: page(() => import('@/features/finance/pages/WalletsPage')) },
          { path: 'keuangan/target', element: page(() => import('@/features/goals/pages/GoalsPage')) },
          { path: 'keuangan/target/:id', element: page(() => import('@/features/goals/pages/GoalDetailPage')) },
          { path: 'keuangan/investasi', element: page(() => import('@/features/investments/pages/InvestmentsPage')) },
          { path: 'keuangan/investasi/:id', element: page(() => import('@/features/investments/pages/AssetDetailPage')) },
          { path: 'tumbuh', element: page(() => import('@/features/growth/pages/GrowthPage')) },
          { path: 'tumbuh/sesi', element: page(() => import('@/features/learning/pages/TimerPage')) },
          { path: 'tumbuh/modul/:id', element: page(() => import('@/features/learning/pages/ModuleDetailPage')) },
          { path: 'tumbuh/rutinitas/:id', element: page(() => import('@/features/routines/pages/RoutineDetailPage')) },
          { path: 'pengaturan/*', element: page(() => import('@/features/settings/pages/SettingsPage')) },
          ...(import.meta.env.DEV
            ? [
                { path: 'dev/maskot', element: page(() => import('@/features/dev/MascotBoard')) },
                { path: 'dev/pohon', element: page(() => import('@/features/dev/TreeBoard')) },
              ]
            : []),
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
]);
