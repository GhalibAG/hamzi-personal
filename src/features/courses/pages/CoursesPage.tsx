// Kuliah `/kuliah?tab=jadwal|tugas|nilai` — Kuliah.dc.html (HP) & Desktop-Kuliah.dc.html (≥1024). UI-SPEC §4, KUL-01…06.
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Icon } from '@/components/icons';
import {
  Button, EmptyState, ErrorState, Fab, IconButton, ListSkeleton, Menu, MOD_BG, Page, ScreenHeader, Segmented, Sheet, type ModTone,
} from '@/components/ui';
import { cx } from '@/lib/cx';
import { useIsDesktop } from '@/lib/hooks';
import { useUi, type QuickKind } from '@/stores/ui';
import { CourseTaskList, AttendanceList } from '../components/CourseLists';
import { ExamBanners } from '../components/ExamBanner';
import { GradeSimulator } from '../components/GradeSimulator';
import { IpkHero, IpkHeroSkeleton } from '../components/IpkHero';
import { TodaySchedule } from '../components/TodaySchedule';
import { useCoursesData, type CoursesData } from '../hooks';

type Tab = 'jadwal' | 'tugas' | 'nilai';
const TABS: { value: Tab; label: string }[] = [
  { value: 'jadwal', label: 'Jadwal' },
  { value: 'tugas', label: 'Tugas kuliah' },
  { value: 'nilai', label: 'Nilai' },
];

const ADD_ITEMS: { kind: QuickKind; label: string; hint: string; tone: ModTone; icon: React.ReactNode }[] = [
  { kind: 'course-task', label: 'Tugas kuliah', hint: 'Laporan, kuis online, proyek kelompok', tone: 'rencana', icon: <Icon.Check size={20} strokeWidth={2.2} /> },
  { kind: 'exam', label: 'Ujian', hint: 'Kuis, UTS, UAS, praktikum', tone: 'target', icon: <Icon.Alert size={20} /> },
  { kind: 'course', label: 'Matkul', hint: 'Mata kuliah + jadwal mingguan', tone: 'kuliah', icon: <Icon.Cap size={20} /> },
];

function overline(d: CoursesData) {
  return d.sem ? `Semester ${d.sem.number} · ${d.sem.label}` : 'Kuliah';
}

/** Tanpa semester / tanpa matkul. */
function NoSemester({ d }: { d: CoursesData }) {
  const nav = useNavigate();
  const openQuick = useUi((s) => s.openQuick);
  if (!d.sem) {
    return (
      <EmptyState
        mood="calm"
        title="Belum ada semester"
        text="Buat semester dulu supaya jadwal, kehadiran, dan IPK bisa dihitung."
        action={<Button onClick={() => nav('/kuliah/semester?new=1')}>Buat semester</Button>}
      />
    );
  }
  return (
    <EmptyState
      mood="calm"
      title="Belum ada mata kuliah"
      text={`Tambahkan mata kuliah Semester ${d.sem.number} beserta jadwal mingguannya.`}
      action={<Button onClick={() => openQuick('course')}>+ Matkul</Button>}
    />
  );
}

/* ---------- HP ---------- */

function AddChooser({ open, onClose }: { open: boolean; onClose: () => void }) {
  const openQuick = useUi((s) => s.openQuick);
  return (
    <Sheet open={open} onClose={onClose} title="Tambah ke Kuliah" closeButton>
      <div className="flex flex-col gap-2 pb-1">
        {ADD_ITEMS.map((it) => (
          <button
            key={it.kind}
            type="button"
            onClick={() => { onClose(); openQuick(it.kind); }}
            className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-surface px-3 text-left hover:bg-surface-2"
          >
            <span className={cx('flex size-11 shrink-0 items-center justify-center rounded-lg', MOD_BG[it.tone])}>{it.icon}</span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-body font-bold">{it.label}</span>
              <span className="text-meta text-ink-3">{it.hint}</span>
            </span>
            <Icon.ChevronRight size={18} className="ml-auto text-ink-3" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function MobileCourses({ d, tab, setTab }: { d: CoursesData; tab: Tab; setTab: (t: Tab) => void }) {
  const nav = useNavigate();
  const [chooser, setChooser] = useState(false);
  const ready = !d.loading && !d.error;
  return (
    <div>
      <ScreenHeader
        overline={overline(d)}
        title="Kuliah"
        right={<IconButton label="Kelola semester & matkul" onClick={() => nav('/kuliah/semester')}><Icon.Sliders size={20} /></IconButton>}
      />
      {d.loading ? <IpkHeroSkeleton /> : d.sem && <IpkHero s={d.summary} attendance={d.attendanceAvg} />}
      {d.error && <div className="px-4 pt-4"><ErrorState onRetry={d.refetch} /></div>}
      {d.loading && <div className="px-4 pt-4"><ListSkeleton rows={4} /></div>}
      {ready && (!d.sem || !d.current.length) && <div className="px-4 pt-4 pb-6"><NoSemester d={d} /></div>}
      {ready && d.sem && d.current.length > 0 && (
        <>
          <Segmented className="mx-4 mt-4" label="Bagian Kuliah" options={TABS} value={tab} onChange={setTab} />
          {tab === 'jadwal' && (
            <div className="flex flex-col gap-4 px-4 pt-4.5 pb-6">
              <ExamBanners items={d.examsSoon} courses={d.courses} tasks={d.tasks} today={d.today} />
              <TodaySchedule
                slots={d.slots} next={d.next} now={d.now} today={d.today} attendances={d.attendances}
                schedules={d.schedules} courses={d.courses} semesterId={d.sem.id}
              />
              <h2 className="m-0 text-body font-extrabold">Kehadiran per mata kuliah</h2>
              <AttendanceList courses={d.current} attendances={d.attendances} />
            </div>
          )}
          {tab === 'tugas' && (
            <div className="flex flex-col gap-2.5 px-4 pt-4.5 pb-6">
              <CourseTaskList tasks={d.cTasks} courses={d.courses} today={d.today} now={d.now} />
            </div>
          )}
          {tab === 'nilai' && (
            <div className="flex flex-col gap-3 px-4 pt-4.5 pb-6">
              <GradeSimulator courses={d.current} summary={d.summary} semIps={d.semIps.ips} scale={d.settings.grade_scale} />
            </div>
          )}
        </>
      )}
      <Fab label="Tambah ke Kuliah" onClick={() => setChooser(true)} />
      {chooser && <AddChooser open onClose={() => setChooser(false)} />}
    </div>
  );
}

/* ---------- Desktop ---------- */

function DesktopCourses({ d }: { d: CoursesData }) {
  const nav = useNavigate();
  const openQuick = useUi((s) => s.openQuick);
  const dot = (cls: string) => <span className={cx('size-2.5 rounded-full', cls)} />;
  const ready = !d.loading && !d.error;
  return (
    <Page>
      <ScreenHeader
        overline={overline(d)}
        title="Kuliah"
        right={
          <>
            <button
              type="button"
              onClick={() => nav('/kuliah/semester')}
              className="h-11 rounded-full border border-line bg-surface px-4 text-label-lg font-bold text-ink-muted hover:bg-surface-2"
            >
              Kelola semester &amp; matkul
            </button>
            <Menu
              trigger={({ open, toggle }) => (
                <Button onClick={toggle} aria-expanded={open} aria-haspopup="menu" className="px-4.5 shadow-day-sel">+ Tugas / Ujian</Button>
              )}
              items={[
                { label: 'Tugas kuliah', icon: dot('bg-rencana-bar'), onSelect: () => openQuick('course-task') },
                { label: 'Ujian', icon: dot('bg-target-bar'), onSelect: () => openQuick('exam') },
                { label: 'Mata kuliah', icon: dot('bg-kuliah-bar'), onSelect: () => openQuick('course') },
              ]}
            />
          </>
        }
      />
      {d.loading ? <IpkHeroSkeleton desktop /> : d.sem && <IpkHero s={d.summary} attendance={d.attendanceAvg} desktop />}
      {d.error && <ErrorState onRetry={d.refetch} />}
      {d.loading && <ListSkeleton rows={4} />}
      {ready && (!d.sem || !d.current.length) && <NoSemester d={d} />}
      {ready && d.sem && d.current.length > 0 && (
        <div className="flex flex-wrap items-start gap-5">
          <section aria-label="Jadwal, tugas, dan kehadiran" className="flex min-w-0 flex-[1_1_380px] flex-col gap-3">
            <ExamBanners items={d.examsSoon} courses={d.courses} tasks={d.tasks} today={d.today} />
            <TodaySchedule
              desktop slots={d.slots} next={d.next} now={d.now} today={d.today} attendances={d.attendances}
              schedules={d.schedules} courses={d.courses} semesterId={d.sem.id}
            />
            <h2 className="m-0 mt-1.5 text-body font-extrabold">Tugas kuliah</h2>
            <CourseTaskList desktop tasks={d.cTasks} courses={d.courses} today={d.today} now={d.now} />
            <h2 className="m-0 mt-1.5 text-body font-extrabold">Kehadiran per mata kuliah</h2>
            <AttendanceList desktop courses={d.current} attendances={d.attendances} />
          </section>
          <section aria-label="Simulasi IPS" className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 rounded-4xl border border-line bg-surface p-4">
            <GradeSimulator desktop courses={d.current} summary={d.summary} semIps={d.semIps.ips} scale={d.settings.grade_scale} />
          </section>
        </div>
      )}
    </Page>
  );
}

export default function CoursesPage() {
  const d = useCoursesData();
  const desktop = useIsDesktop();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'tugas' || raw === 'nilai' ? raw : 'jadwal';
  const setTab = (t: Tab) => {
    const p = new URLSearchParams(params);
    if (t === 'jadwal') p.delete('tab'); else p.set('tab', t);
    setParams(p, { replace: true });
  };
  return desktop ? <DesktopCourses d={d} /> : <MobileCourses d={d} tab={tab} setTab={setTab} />;
}
