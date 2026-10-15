// Data contoh MODE DEMO — sama dengan prototipe (UI-SPEC: "data di prototipe = mock"), relatif terhadap hari ini (WIB).
// Hanya dipakai saat VITE_SUPABASE_URL kosong. Akun asli (Supabase) mulai kosong (TECH-SPEC §5.2).
import {
  addDays, isoWeekday, isRoutineDue, wibDate, wibToInstant, XP, taskXp, STUDY_WATER_MIN,
} from '@common/calc/index.ts';
import type { Db } from './rpc-logic';
import { recomputeStats } from './rpc-logic';
import { DEFAULT_SETTINGS, uuid } from './repo';
import type { Category, Course, Note, Task, Transaction, Wallet } from './types';

export const DEMO_USER = '00000000-0000-0000-0000-000000000001';

export function emptyDb(): Db {
  return {
    projects: [], milestones: [], tasks: [], subtasks: [], events: [], notes: [],
    routines: [], routine_logs: [], learning_modules: [], learning_units: [], study_sessions: [],
    water_events: [], xp_events: [], wallets: [], categories: [], transactions: [], budgets: [], recurring_rules: [],
    semesters: [], courses: [], course_schedules: [], attendances: [], exams: [], grade_components: [],
    savings_goals: [], goal_contributions: [], assets: [], asset_transactions: [], asset_valuations: [],
    scheduled_notifications: [], push_subscriptions: [],
    ai_conversations: [], ai_messages: [], ai_actions: [], ai_requests: [],
    _profile: { id: DEMO_USER, display_name: 'Teman', onboarded_at: null },
    _settings: { ...DEFAULT_SETTINGS },
    _stats: { xp_total: 0, level: 1 },
  };
}

/** Kategori & dompet default (= handle_new_user, TECH-SPEC §5.2). */
export function defaultFinance(db: Db) {
  const cats: [Category['kind'], string, string, string][] = [
    ['expense', 'Makan', 'utensils', '#12B76A'], ['expense', 'Transport', 'bus', '#2E90FA'], ['expense', 'Kuota', 'wifi', '#7A5AF8'],
    ['expense', 'Belanja', 'bag', '#EE46BC'], ['expense', 'Kos & Tagihan', 'home', '#F79009'], ['expense', 'Pendidikan', 'cap', '#6938EF'],
    ['expense', 'Kesehatan', 'heart', '#F04438'], ['expense', 'Hiburan', 'play', '#06AED4'], ['expense', 'Sosial', 'hand', '#039855'],
    ['expense', 'Lainnya', 'dots', '#98A5A0'],
    ['income', 'Kiriman', 'gift', '#12B76A'], ['income', 'Gaji', 'banknote', '#039855'], ['income', 'Usaha', 'store', '#F79009'],
    ['income', 'Bonus', 'star', '#EE46BC'], ['income', 'Lainnya', 'dots', '#98A5A0'],
  ];
  let sortE = 0; let sortI = 0;
  for (const [kind, name, icon, color] of cats) {
    db.categories.push({ id: uuid(), kind, name, icon, color, sort: kind === 'expense' ? ++sortE : ++sortI, archived: false, is_default: true });
  }
  if (!db.wallets.length) {
    db.wallets.push({ id: uuid(), name: 'Tunai', kind: 'cash', icon: 'wallet', color: '#12B76A', opening_balance: 0, is_default: true, archived: false, sort: 0 });
  }
}

export function buildSeed(now: Date = new Date()): Db {
  const db = emptyDb();
  const T = wibDate(now);
  const day = (off: number) => addDays(T, off);
  const at = (off: number, hhmm: string) => wibToInstant(day(off), hhmm).toISOString();
  const nowIso = now.toISOString();
  const wd = (off: number) => isoWeekday(day(off));

  db._profile = { id: DEMO_USER, display_name: 'Iqbal', onboarded_at: at(-60, '09:00') };
  db._settings = { ...DEFAULT_SETTINGS, target_gpa: 3.65, chat_privacy_ack: false, last_backup_at: at(-9, '20:00') };

  // ---------- Keuangan ----------
  defaultFinance(db);
  const tunai = db.wallets[0];
  const ewallet: Wallet = { id: uuid(), name: 'E-wallet', kind: 'ewallet', icon: 'phone', color: '#2E90FA', opening_balance: 0, is_default: false, archived: false, sort: 1 };
  const bank: Wallet = { id: uuid(), name: 'Bank', kind: 'bank', icon: 'bank', color: '#7A5AF8', opening_balance: 0, is_default: false, archived: false, sort: 2 };
  db.wallets.push(ewallet, bank);
  const cat = (kind: 'expense' | 'income', name: string) => db.categories.find((c) => c.kind === kind && c.name === name)!.id;
  const tx = (off: number, hhmm: string, kind: 'expense' | 'income', category: string, amount: number, w: Wallet, note: string | null = null) => {
    const occurred_at = at(off, hhmm);
    const t: Transaction = {
      id: uuid(), kind, amount, direction: 1, wallet_id: w.id, category_id: cat(kind, category), occurred_at,
      occurred_on: day(off), note, created_at: occurred_at, updated_at: occurred_at, deleted_at: null,
    };
    db.transactions.push(t);
  };
  // Hari ini: 85.000 (Makan 25rb, Transport 18rb, Kuota 42rb)
  tx(0, '06:40', 'expense', 'Kuota', 42_000, ewallet);
  tx(0, '07:15', 'expense', 'Transport', 18_000, ewallet, 'ojek ke kampus');
  tx(0, '12:30', 'expense', 'Makan', 25_000, tunai, 'nasi padang');
  // 7 hari terakhir: 434.000 → rata-rata 62.000 (▲ 37%)
  const makan7 = [32_000, 38_000, 30_000, 41_000, 35_000, 33_000, 36_000];
  makan7.forEach((a, i) => tx(-(i + 1), '12:10', 'expense', 'Makan', a, tunai, i % 2 ? 'warteg' : null));
  [-1, -2, -4, -6].forEach((o, i) => tx(o, '07:20', 'expense', 'Transport', [18_000, 18_000, 15_000, 18_000][i], ewallet, 'ojek'));
  tx(-3, '19:00', 'expense', 'Belanja', 55_000, ewallet, 'alat tulis');
  tx(-5, '20:00', 'expense', 'Hiburan', 30_000, ewallet, null);
  tx(-7, '16:00', 'expense', 'Lainnya', 35_000, tunai, 'fotokopi');
  // 8–11 hari lalu: 641.000 (awal siklus)
  [-8, -8, -9, -9, -10, -10, -11, -11].forEach((o, i) => tx(o, i % 2 ? '19:00' : '12:00', 'expense', 'Makan', 33_000, tunai));
  [-8, -9, -10, -11].forEach((o) => tx(o, '07:20', 'expense', 'Transport', 18_000, ewallet, 'ojek'));
  tx(-10, '17:30', 'expense', 'Transport', 85_000, ewallet, 'isi bensin');
  tx(-11, '09:00', 'expense', 'Kuota', 120_000, ewallet, 'paket bulanan');
  tx(-9, '10:00', 'expense', 'Kesehatan', 25_000, tunai, 'obat flu');
  tx(-8, '13:00', 'expense', 'Sosial', 75_000, bank, 'iuran kelas');
  // Pemasukan siklus ini: 2.500.000
  tx(-11, '08:00', 'income', 'Kiriman', 2_000_000, bank, 'kiriman bulanan');
  tx(-6, '15:00', 'income', 'Usaha', 500_000, bank, 'desain poster');
  // Bulan lalu (riwayat)
  for (let o = -12; o >= -40; o--) {
    tx(o, '12:15', 'expense', 'Makan', 30_000 + ((o * 7919) % 5) * 2000, tunai);
    if (o % 2 === 0) tx(o, '07:20', 'expense', 'Transport', 18_000, ewallet, 'ojek');
  }
  tx(-41, '08:00', 'income', 'Kiriman', 2_000_000, bank, 'kiriman bulanan');
  tx(-38, '10:00', 'expense', 'Kos & Tagihan', 650_000, bank, 'kos September');
  tx(-35, '09:00', 'expense', 'Kuota', 120_000, ewallet, 'paket bulanan');
  // Saldo akhir: Tunai 350rb, E-wallet 150rb, Bank 750rb = 1.250.000
  const finalBal: Record<string, number> = { [tunai.id]: 350_000, [ewallet.id]: 150_000, [bank.id]: 750_000 };
  for (const w of db.wallets) {
    const net = db.transactions.filter((t) => t.wallet_id === w.id).reduce((s, t) => s + (t.kind === 'income' ? t.amount : -t.amount), 0);
    w.opening_balance = (finalBal[w.id] ?? 0) - net;
  }
  db.budgets.push({ id: uuid(), category_id: null, amount: 2_000_000, effective_from: day(-90) });
  db.budgets.push({ id: uuid(), category_id: cat('expense', 'Makan'), amount: 900_000, effective_from: day(-90) });
  db.budgets.push({ id: uuid(), category_id: cat('expense', 'Transport'), amount: 400_000, effective_from: day(-90) });

  // Target & investasi
  const dd = { id: uuid(), name: 'Dana darurat', kind: 'dana_darurat' as const, target_amount: 5_000_000, due_date: day(300), icon: 'shield', color: '#F79009', priority: 1, assumed_return_pct: 0, status: 'aktif' as const, monthly_plan: 300_000, plan_day: 5, created_at: at(-120, '09:00'), deleted_at: null };
  const laptop = { id: uuid(), name: 'Laptop baru', kind: 'barang' as const, target_amount: 12_000_000, due_date: day(304), icon: 'laptop', color: '#2E90FA', priority: 2, assumed_return_pct: 0, status: 'aktif' as const, monthly_plan: null, plan_day: null, created_at: at(-200, '09:00'), deleted_at: null };
  db.savings_goals.push(dd, laptop);
  [[-110, 500_000], [-80, 400_000], [-50, 400_000], [-20, 400_000]].forEach(([o, a]) =>
    db.goal_contributions.push({ id: uuid(), goal_id: dd.id, amount: a, contributed_at: day(o), note: null, deleted_at: null }));
  [[-190, 3_000_000], [-120, 2_000_000], [-45, 2_200_000]].forEach(([o, a]) =>
    db.goal_contributions.push({ id: uuid(), goal_id: laptop.id, amount: a, contributed_at: day(o), note: null, deleted_at: null }));
  const rd = { id: uuid(), name: 'Reksa dana pasar uang', asset_class: 'rd_pasar_uang', platform_label: 'Aplikasi investasi', archived: false };
  db.assets.push(rd);
  db.asset_transactions.push({ id: uuid(), asset_id: rd.id, kind: 'beli', amount: 1_000_000, occurred_on: day(-95) });
  db.asset_valuations.push({ id: uuid(), asset_id: rd.id, valued_on: day(-34), value: 1_012_000 });
  db.asset_valuations.push({ id: uuid(), asset_id: rd.id, valued_on: day(-3), value: 1_021_000 });

  // ---------- Kuliah ----------
  const semNames = ['Ganjil 2024/2025', 'Genap 2024/2025', 'Ganjil 2025/2026', 'Genap 2025/2026', 'Antara 2026'];
  const prior: [string, number][][] = [
    [['Pengantar Sistem Informasi', 3], ['Algoritma & Pemrograman', 3], ['Matematika Diskrit', 3], ['Bahasa Inggris', 3], ['Pengantar Bisnis', 3], ['Pendidikan Pancasila', 2], ['Agama', 2]],
    [['Struktur Data', 3], ['Basis Data', 3], ['Sistem Operasi', 3], ['Statistika Dasar', 3], ['Akuntansi Dasar', 3], ['Kewarganegaraan', 2], ['Bahasa Indonesia', 2]],
    [['Pemrograman Berorientasi Objek', 3], ['Jaringan Komputer', 3], ['Sistem Informasi Manajemen', 3], ['Rekayasa Perangkat Lunak', 3], ['Manajemen Bisnis', 3], ['Etika Profesi', 2], ['Kewirausahaan', 2]],
    [['Analisis Proses Bisnis', 3], ['Pemrograman Mobile', 3], ['Data Mining', 3], ['E-Business', 3], ['Riset Operasi', 3], ['Metodologi Penelitian', 2], ['Komunikasi Bisnis', 2]],
    [['Arsitektur Enterprise', 3], ['Keamanan Sistem Informasi', 3], ['Audit Sistem Informasi', 3], ['Sistem Pendukung Keputusan', 3], ['Manajemen Layanan TI', 3], ['Tata Kelola TI', 2], ['Technopreneurship', 2]],
  ];
  // 95 SKS, poin 344 → IPK 3,62. 3 SKS: 10 A, 10 B+, 5 B; 2 SKS: 7 A, 3 B.
  const g3 = ['A', 'B+', 'A', 'B', 'B+', 'A', 'B+', 'B', 'A', 'B+', 'A', 'B+', 'B', 'A', 'B+', 'A', 'B+', 'B', 'A', 'B+', 'A', 'B+', 'B', 'A', 'B+'];
  const g2 = ['A', 'B', 'A', 'A', 'B', 'A', 'A', 'B', 'A', 'A'];
  let i3 = 0; let i2 = 0;
  prior.forEach((courses, si) => {
    const sem = { id: uuid(), number: si + 1, label: semNames[si], start_date: day(-160 * (5 - si) - 200), end_date: day(-160 * (5 - si) - 60), is_active: false, deleted_at: null };
    db.semesters.push(sem);
    for (const [name, credits] of courses) {
      const grade = credits === 3 ? g3[i3++] : g2[i2++];
      db.courses.push({ id: uuid(), semester_id: sem.id, code: null, name, credits, lecturer: null, room: null, color: null, target_grade: null, min_attendance_pct: 75, final_grade: grade, sim_grade: null, deleted_at: null });
    }
  });
  const cur = { id: uuid(), number: 6, label: 'Ganjil 2026/2027', start_date: day(-45), end_date: day(100), is_active: true, deleted_at: null };
  db.semesters.push(cur);
  const C = (name: string, code: string, credits: number, lecturer: string, room: string, color: string, sim: string): Course => {
    const c: Course = { id: uuid(), semester_id: cur.id, code, name, credits, lecturer, room, color, target_grade: 'A', min_attendance_pct: 75, final_grade: null, sim_grade: sim, deleted_at: null };
    db.courses.push(c);
    return c;
  };
  const bdl = C('Basis Data Lanjut', 'SI601', 3, 'Pak Hendra', 'R. 2.3', '#7A5AF8', 'A');
  const pw = C('Pemrograman Web', 'SI602', 3, 'Bu Rina', 'Lab Komputer 2', '#2E90FA', 'A');
  const as = C('Analisis Sistem', 'SI603', 3, 'Pak Dimas', 'R. 3.1', '#F79009', 'B+');
  const mp = C('Manajemen Proyek SI', 'SI604', 3, 'Bu Sari', 'R. 2.1', '#EE46BC', 'B+');
  const imk = C('Interaksi Manusia Komputer', 'SI605', 3, 'Pak Arif', 'Lab Multimedia', '#06AED4', 'A');
  const sb = C('Statistika Bisnis', 'SI606', 2, 'Bu Wulan', 'R. 1.4', '#12B76A', 'B');
  const sched = (c: Course, off: number, start: string, end: string) =>
    db.course_schedules.push({ id: uuid(), course_id: c.id, weekday: wd(off), start_time: start, end_time: end, room: c.room ?? null });
  sched(bdl, 0, '08:00', '10:30');
  sched(pw, 0, '16:30', '18:10');
  sched(as, 3, '10:00', '12:30');
  sched(mp, 1, '13:00', '15:30');
  sched(imk, 2, '08:00', '10:30');
  sched(sb, 4, '10:00', '11:40');
  const attend = (c: Course, weeksOffsets: number[], baseOff: number, statuses: ('hadir' | 'izin' | 'sakit' | 'alpa')[]) =>
    weeksOffsets.forEach((w, i) => db.attendances.push({ id: uuid(), course_id: c.id, meeting_date: day(baseOff - 7 * w), status: statuses[i] ?? 'hadir', note: null }));
  attend(bdl, [0, 1, 2, 3, 4, 5], 0, []);
  attend(pw, [1, 2, 3, 4, 5, 6], 0, ['hadir', 'hadir', 'alpa', 'hadir', 'hadir', 'hadir']);
  attend(as, [1, 2, 3, 4, 5, 6], 3, []);
  attend(mp, [1, 2, 3, 4, 5, 6], 1, ['hadir', 'alpa', 'hadir', 'sakit', 'hadir', 'hadir']);
  attend(imk, [1, 2, 3, 4, 5, 6], 2, []);
  attend(sb, [1, 2, 3, 4, 5, 6], 4, ['hadir', 'hadir', 'hadir', 'izin', 'hadir', 'hadir']);
  db.exams.push({ id: uuid(), course_id: as.id, kind: 'kuis', starts_at: at(3, '10:00'), material: 'bab 1–3', room: 'R. 3.1', prep_status: 'berjalan', deleted_at: null });
  db.exams.push({ id: uuid(), course_id: bdl.id, kind: 'uts', starts_at: at(21, '08:00'), material: 'normalisasi, indeks, transaksi', room: 'R. 2.3', prep_status: 'belum', deleted_at: null });
  db.grade_components.push(
    { id: uuid(), course_id: bdl.id, name: 'Tugas', weight_pct: 30, score: 90 },
    { id: uuid(), course_id: bdl.id, name: 'UTS', weight_pct: 30, score: null },
    { id: uuid(), course_id: bdl.id, name: 'UAS', weight_pct: 40, score: null },
  );

  // ---------- Rencana ----------
  const P = (name: string, kind: 'kuliah' | 'pribadi' | 'skill' | 'lomba', due: string | null) => {
    const p = { id: uuid(), name, description: null, kind, status: 'aktif' as const, color: null, due_date: due, created_at: at(-50, '09:00'), deleted_at: null };
    db.projects.push(p);
    return p;
  };
  const rpl = P('Tugas Besar RPL', 'kuliah', day(49));
  const pkm = P('Proposal PKM', 'pribadi', day(20));
  const porto = P('Portofolio web pribadi', 'skill', null);
  const ms = (p: { id: string }, title: string, status: 'belum' | 'berjalan' | 'selesai', sort: number, due: string | null = null) => {
    const m = { id: uuid(), project_id: p.id, title, due_date: due, status, sort, deleted_at: null };
    db.milestones.push(m);
    return m;
  };
  const m1 = ms(rpl, 'Analisis kebutuhan', 'selesai', 0, day(-14));
  const m2 = ms(rpl, 'Desain basis data & ERD', 'berjalan', 1, day(10));
  const m3 = ms(rpl, 'Implementasi & testing', 'belum', 2, day(45));
  const pm1 = ms(pkm, 'Draf proposal', 'selesai', 0);
  const pm2 = ms(pkm, 'Revisi & pengumpulan', 'berjalan', 1, day(20));
  const om1 = ms(porto, 'Desain halaman', 'berjalan', 0);

  const T_ = (o: Partial<Task> & { title: string }): Task => {
    const t: Task = {
      id: uuid(), notes: null, status: 'belum', priority: 2, source_tag: 'pribadi', due_at: null, all_day: false,
      project_id: null, milestone_id: null, course_id: null, course_task_kind: null, weight_pct: null, estimate_min: null,
      recurrence: null, recurrence_parent_id: null, remind_offsets: [60], completed_at: null,
      created_at: at(-10, '09:00'), updated_at: at(-10, '09:00'), deleted_at: null, ...o,
    };
    db.tasks.push(t);
    return t;
  };
  T_({ title: 'Kirim revisi proposal PKM', priority: 3, source_tag: 'proyek', due_at: at(-1, '23:59'), project_id: pkm.id, milestone_id: pm2.id });
  T_({ title: 'Absen & catat materi Pemrograman Web', priority: 2, source_tag: 'kuliah', due_at: at(0, '16:30'), course_id: pw.id, status: 'selesai', completed_at: at(0, '08:05') });
  const lap = T_({ title: 'Laporan praktikum Basis Data', priority: 3, source_tag: 'kuliah', due_at: at(1, '19:00'), course_id: bdl.id, course_task_kind: 'laporan', weight_pct: 10, estimate_min: 90, remind_offsets: [60, 1440] });
  ['Kerjakan query soal 1–5', 'Screenshot hasil & analisis', 'Rapikan format laporan'].forEach((title, i) =>
    db.subtasks.push({ id: uuid(), task_id: lap.id, title, done: i === 0, sort: i }));
  T_({ title: 'Baca bab 3 Analisis Sistem', priority: 2, source_tag: 'belajar', due_at: at(0, '23:59'), all_day: true, course_id: as.id, estimate_min: 30 });
  T_({ title: 'Bayar kos Oktober', priority: 1, source_tag: 'keuangan', due_at: at(0, '23:59'), all_day: true });
  T_({ title: 'Rapat tim Tugas Besar RPL', priority: 2, source_tag: 'proyek', due_at: at(1, '15:00'), project_id: rpl.id, milestone_id: m2.id });
  const satOff = ((6 - wd(0) + 7) % 7) || 7;
  T_({ title: 'Review keuangan mingguan', priority: 1, source_tag: 'keuangan', due_at: at(satOff, '19:00'), recurrence: { freq: 'weekly', interval: 1, by_day: [6] } });
  T_({ title: 'Mockup sistem informasi akademik', priority: 2, source_tag: 'kuliah', due_at: at(7, '23:59'), all_day: true, course_id: imk.id, course_task_kind: 'kelompok', weight_pct: 20 });
  T_({ title: 'Gantt chart proyek', priority: 2, source_tag: 'kuliah', due_at: at(11, '23:59'), all_day: true, course_id: mp.id, course_task_kind: 'individu', weight_pct: 15 });
  // Tugas proyek (progres): RPL 9/20, PKM 7/10, Portofolio 2/10
  const fill = (p: { id: string }, done: number, total: number, titles: string[], msFor: (i: number) => string | null, srcTag: Task['source_tag']) => {
    const existing = db.tasks.filter((t) => t.project_id === p.id);
    const existingDone = existing.filter((t) => t.status === 'selesai').length;
    for (let i = 0; existing.length + i < total; i++) {
      const isDone = existingDone + i < done;
      T_({
        title: titles[i % titles.length] + (i >= titles.length ? ` (${Math.floor(i / titles.length) + 1})` : ''),
        source_tag: srcTag, project_id: p.id, milestone_id: msFor(i),
        status: isDone ? 'selesai' : 'belum', completed_at: isDone ? at(-(20 - i), '20:00') : null,
        due_at: isDone ? at(-(20 - i), '23:59') : at(5 + i * 2, '23:59'), all_day: true, priority: 2,
      });
    }
  };
  fill(rpl, 9, 20, ['Wawancara pengguna', 'Daftar kebutuhan fungsional', 'Use case diagram', 'Activity diagram', 'Rancang ERD', 'Normalisasi tabel', 'Kamus data', 'Wireframe halaman', 'Setup repository', 'Modul login', 'Modul jadwal', 'Modul nilai', 'Uji black box', 'Perbaikan bug', 'Dokumentasi', 'Presentasi akhir', 'Laporan akhir', 'Video demo', 'Deploy'],
    (i) => (i < 4 ? m1.id : i < 11 ? m2.id : m3.id), 'proyek');
  fill(pkm, 7, 10, ['Cari ide', 'Studi literatur', 'Tulis latar belakang', 'Tulis metode', 'Susun anggaran', 'Minta tanda tangan', 'Konsultasi dosen', 'Cek format', 'Unggah ke SIMBELMAWA'], (i) => (i < 6 ? pm1.id : pm2.id), 'proyek');
  fill(porto, 2, 10, ['Pilih desain', 'Tulis bio singkat', 'Halaman proyek', 'Halaman kontak', 'Optimasi gambar', 'SEO dasar', 'Mode gelap', 'Uji di HP', 'Deploy ke hosting', 'Pasang domain'], () => om1.id, 'proyek');
  db.events.push({ id: uuid(), title: 'Seminar karier fakultas', starts_at: at(4, '13:00'), ends_at: at(4, '15:00'), all_day: false, notes: 'Aula lantai 3', deleted_at: null });

  // ---------- Catatan ("catatan hidup") ----------
  const sampleNotes: Note[] = [
    {
      id: uuid(),
      title: 'Prinsip & target semester ini',
      body: 'Fokus jaga IPK di atas 3,65, konsisten olahraga pagi 20 menit, dan batasi jajan kopi maksimal 2 kali seminggu. Jangan lupa review mingguan tiap Minggu malam.',
      note_date: day(-10),
      pinned: true,
      created_at: at(-10, '08:30'),
      updated_at: at(-2, '14:00'),
      deleted_at: null,
    },
    {
      id: uuid(),
      title: 'Ide topik tugas akhir & riset',
      body: 'Rencana topik AI agent untuk personal planner dengan model ringan lokal atau edge worker. Cari referensi paper SIGMOD / CHI terbaru di perpus kampus.',
      note_date: day(0),
      pinned: false,
      created_at: at(0, '10:15'),
      updated_at: at(0, '10:15'),
      deleted_at: null,
    },
    {
      id: uuid(),
      title: 'Rekomendasi buku dari dosen',
      body: 'Designing Data-Intensive Applications (Kleppmann) bab 5-7 tentang replikasi & konsistensi data. Target baca pas akhir pekan di kos.',
      note_date: day(-3),
      pinned: false,
      created_at: at(-3, '16:45'),
      updated_at: at(-3, '16:45'),
      deleted_at: null,
    },
  ];
  db.notes.push(...sampleNotes);

  // ---------- Tumbuh: rutinitas ----------
  const R = (name: string, kind: 'check' | 'count', target: number, required: boolean, days: number[], remind: string | null, sort: number, enabled = true) => {
    const r = { id: uuid(), name, kind, target_count: target, is_required: required, repeat_days: days, remind_at: remind, remind_enabled: enabled, icon: null, color: null, sort, archived: false, created_at: at(-60, '09:00'), deleted_at: null };
    db.routines.push(r);
    return r;
  };
  const ALL = [1, 2, 3, 4, 5, 6, 7];
  const r1 = R('Bangun sebelum 05:30', 'check', 1, true, ALL, '05:00', 0);
  const r2 = R('Olahraga 20 menit', 'check', 1, true, [1, 2, 3, 4, 5], '06:00', 1);
  const r3 = R('Catat pengeluaran hari ini', 'check', 1, true, ALL, '21:00', 2);
  const r4 = R('Tidur sebelum 23:00', 'check', 1, true, ALL, '22:30', 3);
  const h1 = R('Minum air', 'count', 8, false, ALL, '09:00', 4, false);
  const h2 = R('Baca 10 hlm', 'check', 1, false, ALL, '20:30', 5, false);
  const required = [r1, r2, r3, r4];

  // ---------- Tumbuh: modul belajar ----------
  const M = (title: string, category: string, color: number, weekly: number, remind: string, enabled: boolean, units: string[], done: number, sort: number) => {
    const m = { id: uuid(), title, category, color_index: color, weekly_target_min: weekly, remind_at: remind, remind_days: ALL, remind_enabled: enabled, status: 'aktif' as const, template_key: null, sort, created_at: at(-40, '09:00'), deleted_at: null };
    db.learning_modules.push(m);
    units.forEach((u, i) => db.learning_units.push({
      id: uuid(), module_id: m.id, title: u, kind: i % 4 === 3 ? 'latihan' : 'bacaan', url: null, est_min: 30,
      status: i < done ? 'selesai' : i === done ? 'sedang' : 'belum', notes: null, completed_at: i < done ? at(-(done - i) * 3, '21:00') : null, sort: i,
    }));
    return m;
  };
  const sql = M('SQL & Basis Data', 'basis_data', 0, 120, '20:00', true,
    ['SELECT dasar', 'Filter & urut', 'Agregasi', 'JOIN', 'Subquery', 'Indeks', 'Normalisasi', 'Transaksi', 'View & fungsi', 'Studi kasus'], 6, 0);
  const react = M('React dasar', 'pemrograman', 1, 120, '19:30', true,
    ['JSX', 'Komponen', 'Props', 'State & props', 'Event', 'List & key', 'Form', 'Effect', 'Context', 'Router', 'Fetch data', 'Proyek mini'], 3, 1);
  M('Bahasa Inggris (TOEFL)', 'bahasa', 2, 60, '07:00', false,
    Array.from({ length: 20 }, (_, i) => (i === 8 ? 'Reading' : ['Listening', 'Structure', 'Reading', 'Vocabulary'][i % 4] + ' ' + (Math.floor(i / 4) + 1))), 8, 2);

  // ---------- Riwayat kebun 11 hari + lama ----------
  // level hari T-11..T-1 dan apakah ada sesi belajar ≥10 mnt (streak 4 hari, bunga di beberapa hari).
  const L = [3, 2, 3, 1, 0, 3, 2, 3, 3, 2, 3];
  const S = [true, false, true, false, false, false, false, true, false, true, true];
  const logDay = (d: string, doneIds: string[]) => {
    for (const r of db.routines) {
      if (!isRoutineDue(r.repeat_days, d)) continue;
      const done = doneIds.includes(r.id);
      const value = r.kind === 'count' ? (done ? r.target_count : Math.floor(r.target_count / 2)) : done ? 1 : 0;
      if (value === 0 && !done) continue;
      db.routine_logs.push({ id: uuid(), routine_id: r.id, log_date: d, value, done, updated_at: d + 'T14:00:00.000Z' });
      if (done) {
        db.water_events.push({ id: uuid(), source: 'routine', ref_id: r.id, day: d });
        db.xp_events.push({ id: uuid(), kind: 'routine', ref_id: r.id, day: d, xp: XP.routine });
      }
    }
    const due = required.filter((r) => isRoutineDue(r.repeat_days, d));
    if (due.length && due.every((r) => doneIds.includes(r.id))) db.xp_events.push({ id: uuid(), kind: 'all_required', ref_id: DEMO_USER, day: d, xp: XP.allRequired });
  };
  const study = (d: string, mod: { id: string }, hhmm: string, min: number) => {
    const id = uuid();
    const started_at = wibToInstant(d, hhmm).toISOString();
    db.study_sessions.push({ id, started_at, duration_min: min, started_on: d, module_id: mod.id, unit_id: null, source: 'timer' });
    if (min >= STUDY_WATER_MIN) db.water_events.push({ id: uuid(), source: 'study', ref_id: id, day: d });
    db.xp_events.push({ id: uuid(), kind: 'study', ref_id: id, day: d, xp: Math.floor(min / 5) });
  };
  const pickDone = (d: string, level: number): string[] => {
    const due = required.filter((r) => isRoutineDue(r.repeat_days, d));
    const n = level === 3 ? due.length : level === 2 ? Math.ceil(due.length / 2) : level === 1 ? 1 : 0;
    return due.slice(0, n).map((r) => r.id);
  };
  // hari lama (T-40..T-12): sebagian besar lengkap, untuk mengisi total tetes air
  const TARGET_WATER = 46;
  const recent: { d: string; done: string[]; studied: boolean }[] = L.map((lv, i) => ({ d: day(i - 11), done: pickDone(day(i - 11), lv), studied: S[i] }));
  const todayDone = [r1.id, ...(isRoutineDue(r2.repeat_days, T) ? [r2.id] : [])];
  const recentWater = recent.reduce((s, x) => s + x.done.length + (x.studied ? 1 : 0), 0) + todayDone.length;
  let olderWater = Math.max(0, TARGET_WATER - recentWater);
  for (let o = -12; o >= -60 && olderWater > 0; o--) {
    const d = day(o);
    const due = required.filter((r) => isRoutineDue(r.repeat_days, d));
    const take = Math.min(olderWater, o % 5 === 0 ? 1 : due.length);
    logDay(d, due.slice(0, take).map((r) => r.id));
    olderWater -= take;
  }
  for (const x of recent) {
    logDay(x.d, [...x.done, ...(isRoutineDue(h2.repeat_days, x.d) && x.studied ? [h2.id] : [])]);
    if (x.studied) study(x.d, x.d < day(-5) ? react : sql, '20:00', 25);
  }
  // hari ini: Bangun & Olahraga selesai, Minum air 5/8, Baca 10 hlm selesai
  logDay(T, [...todayDone, h2.id]);
  const h1Today = db.routine_logs.find((l) => l.routine_id === h1.id && l.log_date === T);
  if (h1Today) { h1Today.value = 5; h1Today.updated_at = nowIso; }
  else db.routine_logs.push({ id: uuid(), routine_id: h1.id, log_date: T, value: 5, done: false, updated_at: nowIso });
  // koreksi: log harian kebiasaan "Baca" tidak menambah total di luar target 46 → hapus tetesnya bila lebih
  let extra = db.water_events.length - TARGET_WATER;
  if (extra > 0) {
    db.water_events = db.water_events.filter((w) => {
      if (extra > 0 && w.source === 'routine' && w.ref_id === h2.id) { extra--; return false; }
      return true;
    });
  }

  // XP: tugas & transaksi 14 hari terakhir
  for (const t of db.tasks) {
    if (t.status === 'selesai' && t.completed_at && t.completed_at >= at(-14, '00:00')) {
      db.xp_events.push({ id: uuid(), kind: 'task', ref_id: t.id, day: wibDate(new Date(t.completed_at)), xp: taskXp(t.priority) });
    }
  }
  const txPerDay = new Map<string, number>();
  for (const t of [...db.transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))) {
    if (t.occurred_on < day(-14)) continue;
    const n = txPerDay.get(t.occurred_on) ?? 0;
    if (n >= XP.transactionMaxPerDay) continue;
    txPerDay.set(t.occurred_on, n + 1);
    db.xp_events.push({ id: uuid(), kind: 'tx', ref_id: t.id, day: t.occurred_on, xp: XP.transaction });
  }
  recomputeStats(db);

  // ---------- Notifikasi (kotak masuk) — dedupe_key sama dengan ReminderEngine/penjadwal ----------
  const N = (o: { kind: string; key: string; title: string; body: string; url: string; off: number; hhmm: string; read: boolean; category?: 'user' | 'system'; ref_type?: string; ref_id?: string }) => {
    const fire = at(o.off, o.hhmm);
    db.scheduled_notifications.push({
      id: uuid(), category: o.category ?? 'user', kind: o.kind, ref_type: o.ref_type ?? null, ref_id: o.ref_id ?? null, dedupe_key: o.key, fire_at: fire,
      title: o.title, body: o.body, url: o.url, actions: [], status: 'sent', sent_at: fire, read_at: o.read ? fire : null, created_at: fire,
    });
  };
  const pkmTask = db.tasks.find((t) => t.title === 'Kirim revisi proposal PKM')!;
  const bdlSlot = db.course_schedules.find((x) => x.course_id === bdl.id)!;
  N({ kind: 'routine', key: `routine:${r1.id}:${T}`, title: r1.name, body: 'Pohonmu nunggu disiram. Cuma butuh sebentar.', url: '/tumbuh', off: 0, hhmm: '05:00', read: true, ref_type: 'routine', ref_id: r1.id });
  if (isRoutineDue(r2.repeat_days, T)) N({ kind: 'routine', key: `routine:${r2.id}:${T}`, title: r2.name, body: 'Satu centang lagi buat pohonmu.', url: '/tumbuh', off: 0, hhmm: '06:00', read: true, ref_type: 'routine', ref_id: r2.id });
  N({ kind: 'class', key: `class:${bdlSlot.id}:${T}`, title: bdl.name, body: 'Kelas mulai 30 menit lagi.', url: '/kuliah', off: 0, hhmm: '07:30', read: true, category: 'system', ref_type: 'course_schedule', ref_id: bdlSlot.id });
  N({ kind: 'module', key: `module:${sql.id}:${day(-1)}`, title: sql.title, body: 'Waktunya belajar 25 menit. Aku jagain timernya.', url: `/tumbuh/sesi?modul=${sql.id}`, off: -1, hhmm: '20:00', read: false, ref_type: 'module', ref_id: sql.id });
  N({ kind: 'task', key: `task:${pkmTask.id}:60:${pkmTask.due_at}`, title: pkmTask.title, body: 'Tenggatnya sebentar lagi. Yuk dicicil.', url: '/rencana', off: -1, hhmm: '22:59', read: false, ref_type: 'task', ref_id: pkmTask.id });

  return db;
}
