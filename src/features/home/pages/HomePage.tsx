// Beranda `/` — Main.dc.html (HP) & Desktop-Beranda.dc.html (≥1024). UI-SPEC §1.
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { wibMinutes } from '@common/calc/index.ts';
import { BULAN, dayLong } from '@common/format.ts';
import { partOfDay } from '@common/lines.id.ts';
import { Icon } from '@/components/icons';
import { Mascot } from '@/components/mascot/Mascot';
import {
  Button, Columns, DecoCircle, EmptyState, Fab, IconButton, Kbd, ListSkeleton, Menu, Page, PriorityPill, ProgressBar, Ring,
  SectionLink, SectionTitle, ServiceTile, SOURCE_TAG, Stack, StatTile, Tag, budgetBarColor, CheckBox,
} from '@/components/ui';
import { useAttendanceMark, useProfile, useRows, useSettings, useTaskSetDone } from '@/data/hooks';
import type { Task } from '@/data/types';
import { useMoney, useToggleHideAmounts } from '@/lib/amounts';
import { cx } from '@/lib/cx';
import { useIsDesktop, useNow, useToday } from '@/lib/hooks';
import { toastUndo, useUi } from '@/stores/ui';
import { ACTION_LABEL } from '@/features/ai/templates';
import { useDailySummary } from '@/features/ai/hooks';
import { activeSemester, classesOn, nextClass } from '@/features/courses/derive';
import { useFinanceSummary } from '@/features/finance/hooks';
import { topGoal } from '@/features/goals/derive';
import { useGrowth, useXp } from '@/features/growth/hooks';
import { useUnreadCount } from '@/features/notifications/unread';
import { homeTasks, isOverdue, rankTasks, taskMeta } from '@/features/tasks/derive';
import { tapHamzi, useMoodEngine } from '../mood';

const GREETING: Record<string, string> = { pagi: 'Selamat pagi,', siang: 'Selamat siang,', sore: 'Selamat sore,', malam: 'Selamat malam,' };

function useHomeData() {
  const now = useNow(30_000);
  const today = useToday();
  const profile = useProfile();
  const tasks = useRows('tasks');
  const subtasks = useRows('subtasks').rows;
  const exams = useRows('exams').rows;
  const projects = useRows('projects').rows;
  const schedules = useRows('course_schedules').rows;
  const courses = useRows('courses').rows;
  const semesters = useRows('semesters').rows;
  const attendances = useRows('attendances').rows;
  const goals = useRows('savings_goals').rows;
  const contributions = useRows('goal_contributions').rows;
  const fin = useFinanceSummary();
  const growth = useGrowth();
  const xp = useXp();
  const sem = activeSemester(semesters);
  const slots = useMemo(() => classesOn(today, schedules, courses, sem?.id), [today, schedules, courses, sem?.id]);
  const next = nextClass(slots, now);
  const goal = topGoal(goals, contributions, today);
  return {
    now, today, profile, tasks, subtasks, exams, projects, next, attendances, goal, fin, growth, xp,
    loading: tasks.isLoading || fin.loading,
  };
}

type HomeData = ReturnType<typeof useHomeData>;

function useTaskToggle() {
  const m = useTaskSetDone();
  const react = useUi((s) => s.react);
  return (t: Task) => {
    const done = t.status !== 'selesai';
    m.mutate({ p_task_id: t.id, p_done: done });
    if (done) {
      react('happy', 'Satu tugas sudah beres. Mantap!');
      toastUndo('Mantap, satu beres!', () => m.mutate({ p_task_id: t.id, p_done: false }));
    }
  };
}

/* ---------- Bagian bersama ---------- */

function ServicesGrid() {
  const openQuick = useUi((s) => s.openQuick);
  return (
    <div className="grid grid-cols-4 gap-x-1.5 gap-y-3.5">
      <ServiceTile label="Tugas" tone="rencana" to="/rencana" icon={<Icon.Plan size={24} />} />
      <ServiceTile label="Kalender" tone="rencana" to="/rencana/kalender" icon={<Icon.Calendar size={24} />} />
      <ServiceTile label="Kuliah" tone="kuliah" to="/kuliah" icon={<Icon.Cap size={24} />} />
      <ServiceTile label="Catat" tone="keuangan" onClick={() => openQuick('expense')} icon={<Icon.Receipt size={24} />} />
      <ServiceTile label="Tabungan" tone="target" to="/keuangan#target" icon={<Icon.Target size={24} />} />
      <ServiceTile label="Investasi" tone="invest" to="/keuangan/investasi" icon={<Icon.TrendUp size={24} />} />
      <ServiceTile label="Belajar" tone="belajar" to="/tumbuh#belajar" icon={<Icon.Book size={24} />} />
      <ServiceTile label="Rutinitas" tone="rutin" to="/tumbuh" icon={<Icon.Repeat size={24} />} />
    </div>
  );
}

function ClassCard({ d, desktop }: { d: HomeData; desktop: boolean }) {
  const mark = useAttendanceMark();
  const n = d.next;
  if (!n) return null;
  const attended = d.attendances.some((a) => a.course_id === n.course.id && a.meeting_date === d.today && a.status === 'hadir');
  const until = n.minutesUntil > 0 && n.minutesUntil <= 120 ? `${n.minutesUntil} mnt lagi` : n.minutesUntil <= 0 ? 'Sedang berlangsung' : null;
  const detail = [desktop ? `${n.start}–${n.end}` : null, n.room, n.course.lecturer].filter(Boolean).join(' · ');
  return (
    <div className={cx('flex items-center gap-3 rounded-2xl bg-kuliah-bg', desktop ? 'gap-3.5 px-4 py-3.5' : 'px-3.5 py-3')}>
      <div className={cx('flex flex-col items-center', desktop ? 'min-w-14' : 'min-w-11')}>
        <span className={cx('font-extrabold text-kuliah-deep', desktop ? 'text-section' : 'text-card')}>{n.start}</span>
        {until && <span className={cx('font-semibold text-kuliah-hero', desktop ? 'text-micro' : 'text-2xs')}>{until}</span>}
      </div>
      <div className="w-px self-stretch bg-kuliah-line" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={cx('font-bold', desktop ? 'text-card' : 'text-body')}>{n.course.name}</span>
        <span className={cx('text-ink-2', desktop ? 'text-meta-lg' : 'text-meta')}>{detail}</span>
      </div>
      {desktop && (
        attended
          ? <Tag tone="rutinitas" className="h-8 px-3 text-label">Hadir ✓</Tag>
          : <Button variant="kuliah" size="sm" onClick={() => mark.mutate({ p_course_id: n.course.id, p_date: d.today, p_status: 'hadir' })}>Tandai hadir</Button>
      )}
    </div>
  );
}

function TaskRowHome({ t, d, withTag }: { t: Task; d: HomeData; withTag: boolean }) {
  const toggle = useTaskToggle();
  const done = t.status === 'selesai';
  const overdue = isOverdue(t, d.now);
  const tag = SOURCE_TAG[t.source_tag] ?? SOURCE_TAG.pribadi;
  return (
    <div className={cx('flex items-center gap-3', withTag ? 'border-b border-surface-2 py-1.5 pr-2 last:border-b-0' : 'rounded-2xl border border-line bg-surface py-2.5 pr-3.5 pl-2')}>
      <CheckBox checked={done} onToggle={() => toggle(t)} label={(done ? 'Batalkan selesai: ' : 'Tandai selesai: ') + t.title} />
      <Link to={`/rencana/tugas/${t.id}`} className="flex min-w-0 flex-1 flex-col gap-0.75 text-ink no-underline">
        <span className={cx('truncate text-body font-semibold', done ? 'text-ink-3 line-through' : overdue && withTag ? 'text-danger-fg' : 'text-ink')}>{t.title}</span>
        <span className="truncate text-meta text-ink-3">{taskMeta(t, { today: d.today, now: d.now, subtasks: d.subtasks, withTag })}</span>
      </Link>
      {withTag && <Tag tone={tag.tone}>{tag.label}</Tag>}
      <PriorityPill priority={t.priority} />
    </div>
  );
}

function GoalCard({ d }: { d: HomeData }) {
  const money = useMoney();
  const g = d.goal;
  if (!g) {
    return (
      <Link to="/keuangan/target" className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline">
        <Ring value={0} label="Belum ada target">0%</Ring>
        <span className="text-label font-bold">Buat target pertama</span>
      </Link>
    );
  }
  return (
    <Link to={`/keuangan/target/${g.goal.id}`} className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline">
      <Ring value={g.pct} label={`${g.goal.name} ${g.pct} persen`}>{g.pct}%</Ring>
      <div className="flex flex-col gap-0.5">
        <span className="text-label font-bold">{g.goal.name}</span>
        <span className="text-meta text-ink-3">{money.hidden ? 'Rp ••• / Rp •••' : `${money.short(g.saved)} / ${money.short(g.goal.target_amount)}`}</span>
      </div>
    </Link>
  );
}

function StreakCard({ d }: { d: HomeData }) {
  return (
    <Link to="/tumbuh" className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface p-3.5 text-ink no-underline">
      <div className="flex h-14 items-center gap-2">
        <span className="flex size-10 items-center justify-center rounded-lg bg-rutin-bg text-rutin-fg"><Icon.Flame size={22} /></span>
        <span className="text-stat font-extrabold">{d.growth.data.streak}<span className="text-label font-semibold text-ink-3"> hari</span></span>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-label font-bold">Streak harian · Lv {d.xp.level}</span>
        <ProgressBar value={d.xp.pct} color="belajar" height={6} label="Progres XP ke level berikutnya" />
      </div>
    </Link>
  );
}

function KataHamzi({ d, desktop }: { d: HomeData; desktop: boolean }) {
  const s = useSettings();
  const sum = useDailySummary(s.ai_enabled || true);
  const openQuick = useUi((x) => x.openQuick);
  const setChat = useUi((x) => x.setChatOpen);
  const nav = useNavigate();
  const top = rankTasks(d.tasks.rows, d.now)[0];
  const sugg = sum.data?.data.suggestions[0];
  const run = (key?: string) => {
    switch (key) {
      case 'create_task_split': openQuick('task', { title: top ? `Cicil: ${top.title}` : '', due_date: d.today, due_time: '20:00', priority: 2, estimate_min: 30, project_id: top?.project_id ?? null, course_id: top?.course_id ?? null, source_tag: top?.source_tag ?? 'pribadi' }); break;
      case 'start_timer': openQuick('timer'); break;
      case 'log_expense': openQuick('expense'); break;
      case 'open_budget': nav('/keuangan/anggaran'); break;
      default: nav('/tumbuh');
    }
  };
  const ask = () => (desktop ? setChat(true) : nav('/chat'));
  const src = sum.data?.source === 'template' || !s.ai_enabled ? 'templat' : 'AI';
  return (
    <div className={cx('flex flex-col gap-2.5 rounded-4xl bg-primary-soft', desktop ? 'px-4.5 py-4' : 'p-4')}>
      <div className="flex items-center gap-2">
        <Icon.Sparkle size={18} className="text-primary" />
        <span className="text-label font-extrabold text-brand-800">Kata Hamzi</span>
        <span className="ml-auto text-micro text-brand-800">ringkasan hari ini · {src}</span>
      </div>
      {sum.isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true"><div className="h-4 animate-shimmer rounded bg-brand-100" /><div className="h-4 w-2/3 animate-shimmer rounded bg-brand-100" /></div>
      ) : (
        <p className={cx('m-0 text-body text-ink', desktop ? 'leading-[1.6]' : 'leading-[1.55]')}>{sum.data?.data.highlights.join(' ')}</p>
      )}
      <div className="flex flex-wrap gap-2">
        {sugg && <Button size="sm" onClick={() => run(sugg.action_key)}>{ACTION_LABEL[sugg.action_key ?? 'open_routines']}</Button>}
        <Button size="sm" variant="outline-soft" onClick={ask}>Tanya Hamzi</Button>
      </div>
    </div>
  );
}

/* ---------- HP ---------- */

function MobileHome({ d }: { d: HomeData }) {
  const money = useMoney();
  const toggleHide = useToggleHideAmounts();
  const unread = useUnreadCount();
  const mood = useMoodEngine();
  const openQuick = useUi((s) => s.openQuick);
  const nav = useNavigate();
  const f = d.fin.data;
  const name = d.profile.data?.display_name ?? 'Teman';
  const list = homeTasks(d.tasks.rows, d.now, 3, { exams: d.exams, projects: d.projects });
  return (
    <div>
      <div className="relative overflow-hidden bg-header px-5 pt-5 pb-23">
        <DecoCircle className="-top-27.5 -right-22.5 size-65 bg-header-c1 opacity-55" />
        <DecoCircle className="-bottom-15 -left-17.5 size-45 bg-header-c2 opacity-45" />
        <DecoCircle className="right-17.5 bottom-7.5 size-22.5 bg-header-c3 opacity-18" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-label font-medium text-on-header-sub">{GREETING[partOfDay(wibMinutes(d.now))]}</span>
            <span className="text-name font-extrabold tracking-[-0.3px] text-on-primary">{name}</span>
          </div>
          <div className="flex gap-2">
            <IconButton variant="onHeader" label={money.hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'} onClick={toggleHide}>
              {money.hidden ? <Icon.EyeOff size={20} /> : <Icon.Eye size={20} />}
            </IconButton>
            <IconButton variant="onHeader" label={unread ? `Notifikasi, ${unread} belum dibaca` : 'Notifikasi'} onClick={() => nav('/notifikasi')}>
              <Icon.Bell size={20} />
              {unread > 0 && <span className="absolute top-2.5 right-2.75 size-2 rounded-full border-2 border-header bg-badge-dot" />}
            </IconButton>
          </div>
        </div>
        <div className="relative mt-3.5 flex items-end gap-2.5">
          <button type="button" aria-label="Ketuk Hamzi" onClick={tapHamzi} className="size-19 shrink-0 bg-transparent p-0">
            <Mascot mood={mood.mood} size={76} />
          </button>
          <Link to="/chat" className="mb-3.5 flex flex-col gap-1 rounded-[18px_18px_18px_6px] bg-surface px-3.5 py-2.5 text-label leading-[1.45] font-medium text-ink no-underline shadow-bubble">
            {mood.line}
            <span className="text-meta font-extrabold text-primary">Ngobrol sama Hamzi →</span>
          </Link>
        </div>
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-7 rounded-t-sheet bg-bg" />
      </div>

      <Link to="/keuangan" className="relative z-[2] mx-4 -mt-19 block rounded-4xl bg-surface p-4 text-ink no-underline shadow-float">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-meta font-semibold text-ink-2">Pengeluaran hari ini</span>
            <span className="tabular text-title font-extrabold tracking-[-0.5px]">{money.rp(f.spentToday)}</span>
          </div>
          {f.pctVsAvg !== null && f.pctVsAvg !== 0 && (
            <span className={cx('rounded-full px-2.25 py-1.25 text-micro font-bold', f.pctVsAvg > 0 ? 'bg-warn-bg text-warn-fg' : 'bg-primary-soft text-brand-800')}>
              {f.pctVsAvg > 0 ? '▲' : '▼'} {Math.abs(f.pctVsAvg)}% dari rata-rata
            </span>
          )}
        </div>
        {f.budgetTotal ? (
          <>
            <div className="mt-3.5 flex justify-between text-meta font-medium text-ink-2">
              <span>Anggaran {BULAN[f.cycleMonth]}</span><span className="font-bold text-ink">{f.budgetUsedPct}%</span>
            </div>
            <ProgressBar className="mt-1.5" value={f.budgetUsedPct} color={budgetBarColor(f.budgetUsedPct)} label="Anggaran terpakai" />
          </>
        ) : (
          <div className="mt-3.5 text-meta font-semibold text-primary">Atur anggaran →</div>
        )}
        <div className="mt-3 flex gap-2">
          <StatTile label="Aman per hari" value={f.budgetTotal ? money.rp(f.safeDaily) : '–'} tone="soft" />
          <StatTile label="Saldo semua dompet" value={money.rp(f.balanceTotal)} tone="plain" />
        </div>
      </Link>

      <Stack className="px-4 pt-5.5 pb-6">
        <ServicesGrid />
        <div className="flex flex-col gap-2.5">
          <SectionTitle size="lg" title="Hari ini" right={<SectionLink to="/rencana">Lihat semua</SectionLink>} />
          <ClassCard d={d} desktop={false} />
          {d.loading ? <ListSkeleton rows={3} /> : list.length ? list.map((t) => <TaskRowHome key={t.id} t={t} d={d} withTag={false} />) : (
            <EmptyState compact text="Belum ada tugas hari ini. Mau tambah satu?" action={<Button size="xs" onClick={() => openQuick('task')}>+ Tugas</Button>} />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <GoalCard d={d} />
          <StreakCard d={d} />
        </div>
        <KataHamzi d={d} desktop={false} />
      </Stack>
      <Fab
        items={[
          { label: 'Catat pengeluaran', tone: 'keuangan', icon: <Icon.Receipt size={18} strokeWidth={2} />, onSelect: () => openQuick('expense') },
          { label: 'Tugas baru', tone: 'rencana', icon: <Icon.Check size={18} strokeWidth={2} />, onSelect: () => openQuick('task') },
          { label: 'Mulai timer belajar', tone: 'belajar', icon: <Icon.Timer size={18} />, onSelect: () => openQuick('timer') },
        ]}
      />
    </div>
  );
}

/* ---------- Desktop ---------- */

function DesktopHome({ d }: { d: HomeData }) {
  const money = useMoney();
  const toggleHide = useToggleHideAmounts();
  const mood = useMoodEngine();
  const openQuick = useUi((s) => s.openQuick);
  const setChat = useUi((s) => s.setChatOpen);
  const chatOpen = useUi((s) => s.chatOpen);
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const f = d.fin.data;
  const g = d.growth.data;
  const name = d.profile.data?.display_name ?? 'Teman';
  const list = homeTasks(d.tasks.rows, d.now, 4, { exams: d.exams, projects: d.projects });
  const nextRoutine = g.requiredToday.find((r) => !g.logToday(r.id)?.done);
  const dot = (cls: string) => <span className={cx('size-2.5 rounded-full', cls)} />;
  return (
    <Page>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-50 flex-1 flex-col">
          <span className="text-meta font-semibold text-ink-3">{dayLong(d.today, true)}</span>
          <h1 className="m-0 text-title font-extrabold tracking-[-0.5px]">Beranda</h1>
        </div>
        {chatOpen ? (
          <IconButton label="Cari" onClick={() => nav('/cari')} className="xl:hidden"><Icon.Search size={20} /></IconButton>
        ) : null}
        <form
          role="search"
          onSubmit={(e) => { e.preventDefault(); nav(`/cari?q=${encodeURIComponent(q)}`); }}
          className={cx('h-11 w-70 max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-ink-3', chatOpen ? 'hidden xl:flex' : 'flex')}
        >
          <Icon.Search size={18} />
          <label htmlFor="global-search" className="sr-only">Cari</label>
          <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari tugas, matkul, transaksi…" className="min-w-0 flex-1 border-0 bg-transparent text-label-lg text-ink outline-none" />
          <Kbd>/</Kbd>
        </form>
        <IconButton label={money.hidden ? 'Tampilkan nominal' : 'Sembunyikan nominal'} onClick={toggleHide}>
          {money.hidden ? <Icon.EyeOff size={20} /> : <Icon.Eye size={20} />}
        </IconButton>
        <Menu
          trigger={({ open, toggle }) => (
            <Button onClick={toggle} aria-expanded={open} className="shadow-day-sel" icon={<Icon.Plus size={18} />}>Tambah</Button>
          )}
          items={[
            { label: 'Tugas baru', hint: 'N', icon: dot('bg-rencana-bar'), onSelect: () => openQuick('task') },
            { label: 'Catat pengeluaran', hint: 'E', icon: dot('bg-brand-500'), onSelect: () => openQuick('expense') },
            { label: 'Mulai timer belajar', hint: 'T', icon: dot('bg-belajar-bar'), onSelect: () => openQuick('timer') },
            { label: 'Rutinitas baru', hint: 'R', icon: dot('bg-danger'), onSelect: () => openQuick('routine') },
          ]}
        />
      </div>

      <div className="relative flex flex-wrap items-center gap-4.5 overflow-hidden rounded-5xl bg-header px-6.5 py-5.5 shadow-float">
        <DecoCircle className="-top-37.5 -right-20 size-75 bg-header-c1 opacity-55" />
        <DecoCircle className="-bottom-32.5 left-45 size-50 bg-header-c2 opacity-45" />
        <button type="button" aria-label="Ketuk Hamzi" onClick={tapHamzi} className="relative size-24 shrink-0 bg-transparent p-0">
          <Mascot mood={mood.mood} size={96} />
        </button>
        <div className="relative flex min-w-0 flex-[1_1_300px] flex-col gap-1.5">
          <span className="text-body font-medium text-on-header-sub">{GREETING[partOfDay(wibMinutes(d.now))]}</span>
          <span className="text-h1 font-extrabold tracking-[-0.4px] text-on-primary">{name}</span>
          <span className="text-body font-medium text-on-primary">
            {mood.line}{' '}
            <button type="button" onClick={() => setChat(true)} className="bg-transparent p-0 text-label font-extrabold text-on-header-sub underline">Ngobrol sama Hamzi →</button>
          </span>
        </div>
        <div className="relative grid flex-[1_1_420px] grid-cols-3 gap-2.5">
          <Link to="/keuangan" className="flex flex-col gap-0.5 rounded-xl bg-white-14 px-3.5 py-3 no-underline">
            <span className="text-meta font-semibold text-on-header-sub">Pengeluaran hari ini</span>
            <span className="tabular text-h2 font-extrabold text-on-primary">{money.rp(f.spentToday)}</span>
            {f.pctVsAvg !== null && f.pctVsAvg !== 0 && <span className="text-small font-bold text-warn-bg">{f.pctVsAvg > 0 ? '▲' : '▼'} {Math.abs(f.pctVsAvg)}% dari rata-rata</span>}
          </Link>
          <Link to="/keuangan/anggaran" className="flex flex-col gap-0.5 rounded-xl bg-white-14 px-3.5 py-3 no-underline">
            <span className="text-meta font-semibold text-on-header-sub">Aman per hari</span>
            <span className="tabular text-h2 font-extrabold text-on-primary">{f.budgetTotal ? money.rp(f.safeDaily) : '–'}</span>
            <span className="text-small font-semibold text-on-header-sub">{f.budgetTotal ? `Anggaran ${f.budgetUsedPct}% · sisa ${f.daysLeft} hari` : 'Atur anggaran'}</span>
          </Link>
          <Link to="/keuangan/dompet" className="flex flex-col gap-0.5 rounded-xl bg-white-14 px-3.5 py-3 no-underline">
            <span className="text-meta font-semibold text-on-header-sub">Saldo semua dompet</span>
            <span className="tabular text-h2 font-extrabold text-on-primary">{money.rp(f.balanceTotal)}</span>
            <span className="text-small font-semibold text-on-header-sub">{f.balances.size} dompet</span>
          </Link>
        </div>
      </div>

      <Columns
        left={
          <>
            <SectionTitle size="lg" title="Hari ini" right={<SectionLink to="/rencana">Buka Rencana</SectionLink>} />
            <ClassCard d={d} desktop />
            <div className="rounded-3xl border border-line bg-surface px-2 py-1">
              {d.loading ? <div className="p-2"><ListSkeleton rows={3} /></div> : list.length ? list.map((t) => <TaskRowHome key={t.id} t={t} d={d} withTag />) : (
                <div className="p-2"><EmptyState compact text="Belum ada tugas hari ini. Mau tambah satu?" /></div>
              )}
              <button type="button" onClick={() => openQuick('task')} className="h-11 w-full bg-transparent px-3 text-left text-label-lg font-extrabold text-primary">+ Tambah tugas (N)</button>
            </div>
            <KataHamzi d={d} desktop />
          </>
        }
        right={
          <>
            <div className="rounded-3xl border border-line bg-surface p-3.5"><ServicesGrid /></div>
            <div className="grid grid-cols-2 gap-3">
              <GoalCard d={d} />
              <StreakCard d={d} />
            </div>
            <Link to="/tumbuh" className="flex flex-col gap-2.5 rounded-3xl border border-line bg-surface px-4 py-3.5 text-ink no-underline">
              <div className="flex items-baseline justify-between">
                <span className="text-body font-extrabold">Rutinitas wajib · {g.today.done}/{g.today.due}</span>
                <span className="text-meta font-bold text-primary">{g.stage.name}</span>
              </div>
              <ProgressBar value={g.today.due ? (g.today.done / g.today.due) * 100 : 0} label="Rutinitas wajib selesai" />
              <span className="text-meta text-ink-3">
                {nextRoutine ? `Berikutnya: ${nextRoutine.name}${nextRoutine.remind_at ? ' · ' + nextRoutine.remind_at.slice(0, 5) : ''}` : g.today.due ? 'Semua rutinitas wajib beres. Pohonmu berbunga!' : 'Belum ada rutinitas wajib hari ini.'}
              </span>
            </Link>
          </>
        }
      />
    </Page>
  );
}

export default function HomePage() {
  const d = useHomeData();
  const desktop = useIsDesktop();
  return desktop ? <DesktopHome d={d} /> : <MobileHome d={d} />;
}
