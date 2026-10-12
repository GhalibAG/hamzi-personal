# FRONTEND-GUIDE — Cara membangun layar Hamzi di kode ini

Pendamping `AGENTS.md`, `UI-SPEC.md`, `DESIGN-SYSTEM.md`. Dokumen ini menjelaskan **fondasi yang sudah ada** (data, komponen, hook) supaya setiap layar dibangun dengan cara yang sama.

## 0. Menjalankan
```bash
npm install
npm run dev            # http://localhost:5173 — tanpa .env = MODE DEMO (data contoh di localStorage)
npm run typecheck && npm run lint && npm test
node tests/visual/shoot.mjs /keuangan tests/visual/out/k.png            # screenshot HP 390×844 (jam dibekukan Senin 12 Okt 2026 16:08 WIB)
node tests/visual/shoot.mjs /keuangan tests/visual/out/k-d.png --desktop # 1440×900
```
MODE DEMO: `VITE_SUPABASE_URL` kosong → `src/data/local.ts` (localStorage `hamzi-demo-v1`, diisi `src/data/seed.ts` = data prototipe relatif ke hari ini). Isi `.env` → `src/data/supabase.ts` (RLS). **Komponen tidak pernah tahu bedanya.** Reset data demo: Pengaturan › Data, atau `localStorage.removeItem('hamzi-demo-v1')`.

## 1. Struktur
```
src/app/            router.tsx (semua rute, lazy), AppShell (BottomNav HP / Sidebar+ChatPanel desktop), QuickHost (sheet tambah cepat), PwaPrompt, TimerChip
src/components/     icons/ (Icon.*), mascot/ (Mascot, moods), tree/ (Tree, GardenDay, GardenIcon), ui/ (lihat §4)
src/data/           types.ts, repo.ts, local.ts, supabase.ts, seed.ts, rpc-logic.ts (RPC demo), local-functions.ts (Edge demo), hooks.ts
src/features/<f>/   derive.ts (turunan murni), hooks.ts, components/, pages/ (default export)
src/stores/         ui.ts (toast, sheet cepat, panel chat, reaksi maskot), timer.ts (timer fokus berbasis timestamp)
src/lib/            hooks.ts (useIsDesktop, useToday, useNow, useOnline, useHotkeys), amounts.ts (useMoney), cx.ts, storage.ts
supabase/functions/_shared/common/   @common: calc/* (SEMUA rumus), format.ts, schemas.ts (zod), lines.id.ts, proposal-format.ts, sensitive.ts
```

## 2. Data (TanStack Query) — `@/data/hooks`
| Hook | Pakai |
|---|---|
| `useRows('tasks')` | `{ rows, isLoading, isError, refetch }` — baris aktif (tanpa soft-deleted) |
| `useUpsert('tasks').save(row \| rows)` | insert/ubah; **id dibuat klien** bila tidak ada; optimistic + rollback; mengembalikan baris |
| `useUpdate('scheduled_notifications').patch(id, patch)` | ubah sebagian kolom |
| `useRemove('transactions').remove(id)` lalu `.undo(id)` | soft delete (tabel di `SOFT_DELETE`) + Urungkan |
| `useRoutineSet().mutate({ p_routine_id, p_date, p_value })` | RPC atomik rutinitas (nilai absolut: centang=target, batal=0) |
| `useTaskSetDone().mutate({ p_task_id, p_done })` | centang tugas (+XP, tugas berulang berikutnya) |
| `useStudyFinish().mutateAsync({ p_id, p_started_at, p_duration_min, p_module_id, p_unit_id })` | akhir sesi timer → `{ water_awarded, water_total, stage }` |
| `useUnitSetStatus()`, `useAttendanceMark()` | `{ p_unit_id, p_status }`, `{ p_course_id, p_date, p_status, p_note? }` |
| `useSettings()` / `useUpdateSettings().mutate(patch)` | `user_settings` |
| `useProfile()`, `useUpdateProfile()`, `useStats()` | profil, XP |
| `repo.invoke(fn, body)` (`@/data`) | Edge Function: `ai-generate`, `ai-chat`, `push-test`, `account-delete` (demo: `local-functions.ts`) |

Aturan: uang = integer rupiah; tanggal hari = string `'YYYY-MM-DD'` WIB (`useToday()`); waktu disimpan ISO UTC (`wibToInstant(date,'HH:MM').toISOString()`). Hari minggu 1=Senin…7=Minggu.

## 3. Turunan (jangan hitung ulang di komponen)
- `features/finance/derive.ts`: `financeSummary`, `walletBalance(s)`, `activeBudget`, `txEffect`; hook `useFinanceSummary()`.
- `features/tasks/derive.ts`: `isOpen`, `isDone`, `isOverdue`, `dueDay`, `dueLabel`, `relDay`, `taskMeta`, `rankTasks` (skor prioritas), `tasksOnDay`, `homeTasks`, `SOURCE_LABEL`.
- `features/growth/derive.ts`: `growthOverview` (air, tahap, rutinitas hari ini, streak), `buildGrowthIndex().dayInfo(d)`, `gardenMonth`; hook `useGrowth()`, `useXp()`.
- `features/courses/derive.ts`: `activeSemester`, `classesOn`, `nextClass`, `gpaSummary`, `courseAttendance`, `upcomingExams`, `EXAM_LABEL`.
- `features/goals/derive.ts`: `goalSaved`, `goalView`, `topGoal`, `assetView`.
- `features/ai/`: `payload.ts` (payload agregat), `templates.ts` (`templateDaily`, `templateWeekly`, `weeklyToText`, `ACTION_LABEL`), `hooks.ts` (`useDailySummary`).
- `@common/calc`: `cycleStart`, `daysLeftInCycle`, `safeDailyRounded`, `ips`, `requiredIpsThisSemester`, `treeStage`, `gardenLevel`, `streak`, `goalMonthlyNeeded`, `investmentPL`, `priorityScore`, `taskXp`, `xpProgress`, `isRoutineDue`, `REPEAT_PRESETS`, `repeatLabel`, `wibDate`, `wibTime`, `addDays`, `isoWeekday`, `weekStart` …
- `@common/format`: `rupiah`, `rupiahShort`, `thousands`, `dayLabel` ("Selasa 20 Okt"), `dayLabelComma`, `dayLong`, `monthLabel`, `decimalId` ("3,62"), `HARI`, `BULAN`, `BULAN_PENDEK`.

## 4. Komponen UI — `@/components/ui`
`Button` (variant: primary · outline-primary · soft · secondary · outline-soft · outline-kuliah · kuliah · danger-outline · danger · info · ghost; size lg=56 md=44 sm=40 xs=36; `block`, `icon`), `ButtonLink`, `IconButton` (`label` wajib; variant default/onHeader/plain/soft), `Card`, `SectionTitle`, `SectionLink`, `Chip` (`selected`), `Tag` (tone kuliah/belajar/keuangan/tugas/ujian/rutinitas/keluar/masuk/jadwal/modul/event/setoran/pribadi/proyek/skill/lomba/neutral/danger), `SOURCE_TAG`, `PriorityPill`, `PriorityDot`, `CheckBox` (`round` untuk rutinitas), `StatTile` (tone soft/plain/hero/hero-purple), `ProgressBar` (color brand/belajar/target/rencana/kuliah/invest/warn/danger/white/lm-0..4; height 6/8/10), `budgetBarColor(pct)`, `Ring`, `Amount`, `Switch`, `Skeleton`, `ListSkeleton`, `EmptyState` (Hamzi + teks + aksi), `ErrorState`, `ServiceTile`, `MOD_BG`, `DecoCircle`, `Segmented`, `Sheet` (HP = sheet bawah, desktop = dialog 440; props `open,onClose,title|label,footer,desktopWidth,full,closeButton`), `Field`, `inputCls`, `textareaCls`, `ToastHost`, `Keypad`, `WeekStrip`, `Fab` (+ `items` SpeedDial; hanya HP), `ScreenHeader` (`overline,title,right,back`), `Kbd`, `Menu`, `ConfirmRow`, `Page` (`narrow` untuk detail ≤760), `Stack`, `Columns` (dua kolom desktop).
Ikon: `Icon.Home … Icon.Backspace` (`src/components/icons`). Maskot: `<Mascot mood size mirror still decorative />`. Pohon: `<Tree stage bloom />`, `<GardenDay …/>`.

## 5. Store & interaksi global
- `useUi`: `showToast`, `toastUndo(text, onUndo)`, `toast(text)`, `openQuick(kind, initial?)`, `closeQuick`, `chatOpen/setChatOpen/toggleChat`, `react(mood, line, ms)` (reaksi Hamzi), `markWatered()` (chip "+1 tetes air").
- Sheet tambah cepat (kontrak `QuickSheetProps { open, onClose, initial? }` di `src/app/quick.ts`), dibuka dari mana saja via `openQuick`:
  `expense|income` → `features/finance/components/QuickTransactionSheet` · `task|course-task` → `features/tasks/components/TaskFormSheet` · `event` → `features/calendar/components/EventFormSheet` · `routine` → `features/routines/components/RoutineFormSheet` · `module` → `features/learning/components/ModuleFormSheet` · `timer` → `features/learning/components/StartTimerSheet` · `exam` → `features/courses/components/ExamFormSheet` · `course` → `features/courses/components/CourseFormSheet`. Juga `?quick=<kind>` di URL.
- Timer: `useTimer` (`start, pause, resume, finish, clear, setMinimized`, `timerElapsed`). Overlay global `features/learning/components/TimerOverlay` tampil bila timer aktif & tidak dikecilkan.
- Pintasan desktop (sudah di AppShell): N tugas, E pengeluaran, T timer, R rutinitas, / cari (`#global-search`), C chat.

## 6. Pola halaman
```tsx
export default function XPage() {
  const desktop = useIsDesktop();
  return desktop ? <DesktopX /> : <MobileX />;   // komponen isi dipakai bersama; hanya susunan berbeda
}
```
- HP: `ScreenHeader` (padding 20/16), konten `px-4`, jarak seksi `gap-4.5…5.5`, FAB `<Fab/>` bila prototipe punya.
- Desktop: `<Page>` (maks 1120, padding 24/32) + header (overline + judul + kontrol kanan) + `<Columns left right/>` sesuai DESIGN-SYSTEM §11.4. Tanpa FAB; form = Sheet (otomatis dialog).
- Setiap layar: loading (`ListSkeleton`), kosong (`EmptyState` dengan Hamzi), galat (`ErrorState`), offline (banner global sudah ada).
- Kelas Tailwind memakai token: warna `bg-surface`, `text-ink(-2/-3/-muted)`, `border-line(-strong)`, `bg-primary(-soft)`, modul `bg-kuliah-bg text-kuliah-fg` …; ukuran teks `text-micro(11) small(11.5) meta(12) label(13) body(14) card(15) section(16) section-lg(17) h3(18) stage(19) h2(20) name(22) stat(24) title(26) h1(28) display(32) display-lg(38) display-xl(40) display-2xl(44)`; radius `rounded-xs(6) sm(8) md(12) lg(14) xl(16) 2xl(18) 3xl(20) 4xl(22) 5xl(24) 6xl(26) sheet(28) full`; bayangan `shadow-float/fab/pop/toast/sheet/day-sel/1/bubble/hero-green/hero-purple`. Jarak pakai skala Tailwind (1 = 4 px; `h-11` 44, `size-13` 52, `px-3.5` 14). **Tanpa hex di komponen.**
