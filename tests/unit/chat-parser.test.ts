// Chat Hamzi: parser perintah (mode demo), penyusun usulan, pemetaan penerapan kartu aksi, dan localChat.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wibToInstant } from '@common/calc/index.ts';
import type { ProposalItem } from '@common/schemas.ts';
import {
  parseAmount, parseDate, parseIntent, parseRepeat, parseTime, sampleFromFile, type Intent, type ParseContext, type ToolCall,
} from '@/features/chat/parser';
import { buildProposals, proposalDest, proposalTitle } from '@/features/chat/proposals';
import { appliedItems, buildApplyPlan, canUndo, type ApplyData } from '@/features/chat/apply';
import { localChat, QUOTA_TEXT } from '@/features/chat/local-chat';
import { buildSeed, emptyDb } from '@/data/seed';
import { localRepo } from '@/data/local';
import type { AiAction, Category, Course } from '@/data/types';

const TODAY = '2026-10-12'; // Senin
const ctx: ParseContext = {
  today: TODAY,
  now: '16:08',
  courses: ['Basis Data Lanjut', 'Pemrograman Web', 'Analisis Sistem', 'Interaksi Manusia Komputer'],
  categories: [
    ...['Makan', 'Transport', 'Kuota', 'Belanja', 'Kos & Tagihan', 'Pendidikan', 'Kesehatan', 'Hiburan', 'Sosial', 'Lainnya'].map((name) => ({ name, kind: 'expense' as const })),
    ...['Kiriman', 'Gaji', 'Usaha', 'Bonus', 'Lainnya'].map((name) => ({ name, kind: 'income' as const })),
  ],
  goals: ['Dana darurat', 'Laptop baru'],
  projects: ['Proposal PKM'],
};

function call(text: string): ToolCall {
  const r: Intent = parseIntent(text, ctx);
  if (r.type !== 'propose') throw new Error(`bukan usulan: ${JSON.stringify(r)}`);
  expect(r.calls).toHaveLength(1);
  return r.calls[0];
}

describe('parser: unsur', () => {
  it.each([
    ['25rb', 25_000], ['25k', 25_000], ['25.000', 25_000], ['Rp 12.500', 12_500], ['1,5jt', 1_500_000],
    ['1.5 juta', 1_500_000], ['2 jt', 2_000_000], ['15', 15_000], ['250000', 250_000], ['10 ribu', 10_000],
  ])('nominal %s → %i', (t, v) => {
    expect(parseAmount(`bayar ${t}`)?.value).toBe(v);
  });
  it('nominal berlabel diutamakan dari angka lain', () => {
    expect(parseAmount('fotokopi 3 lembar 6rb')?.value).toBe(6000);
  });
  it.each([
    ['jam 06:30', '06:30'], ['jam 6.30', '06:30'], ['jam 9 pagi', '09:00'], ['jam 7 malam', '19:00'], ['pukul 19.00', '19:00'],
    ['jam 1 siang', '13:00'], ['jam 12 siang', '12:00'], ['jam 4 sore', '16:00'], ['20.00', '20:00'], ['jam 20', '20:00'],
  ])('jam %s → %s', (t, v) => {
    expect(parseTime(`kumpul ${t} ya`)?.value).toBe(v);
  });
  it.each([
    ['hari ini', '2026-10-12'], ['besok', '2026-10-13'], ['lusa', '2026-10-14'], ['kemarin', '2026-10-11'],
    ['kamis', '2026-10-15'], ['senin', '2026-10-19'], ['senin depan', '2026-10-19'], ['jumat depan', '2026-10-23'],
    ['tanggal 20', '2026-10-20'], ['tgl 5', '2026-11-05'], ['2 nov', '2026-11-02'], ['20 oktober', '2026-10-20'],
    ['3 januari', '2027-01-03'], ['20/10', '2026-10-20'], ['2026-12-01', '2026-12-01'], ['minggu depan', '2026-10-19'],
  ])('tanggal %s → %s', (t, v) => {
    expect(parseDate(`tugas ${t}`, TODAY)?.value).toBe(v);
  });
  it.each([
    ['setiap hari', 'daily'], ['sen-jum', 'weekdays'], ['senin sampai jumat', 'weekdays'], ['weekdays', 'weekdays'],
    ['akhir pekan', 'weekend'], ['tiap sabtu dan minggu', 'weekend'],
  ])('ulangi %s → %s', (t, v) => {
    expect(parseRepeat(`olahraga ${t}`)?.value).toBe(v);
  });
  it('ulangi hari tertentu', () => {
    expect(parseRepeat('tiap senin dan kamis')?.value).toEqual([1, 4]);
    expect(parseRepeat('tiap sen, rab, jum')?.value).toEqual([1, 3, 5]);
  });
});

describe('parser: niat', () => {
  it('rutinitas dengan jam & Sen–Jum (perintah e2e)', () => {
    const c = call('tambahin rutinitas siapin bekal jam 06:30 sen-jum');
    expect(c.tool).toBe('propose_routine');
    expect(c.args).toEqual({ name: 'Siapin bekal', kind: 'check', repeat: 'weekdays', is_required: true, remind_at: '06:30' });
  });
  it('rutinitas prototipe "minum air 8 gelas jam 9 pagi"', () => {
    const c = call('tambahin rutinitas minum air 8 gelas jam 9 pagi');
    expect(c.args).toMatchObject({ name: 'Minum air 8 gelas', repeat: 'daily', remind_at: '09:00' });
  });
  it('rutinitas hari tertentu, tanpa jam, jumlah, tidak wajib', () => {
    expect(call('rutinitas olahraga tiap senin dan kamis jam 6 pagi').args).toMatchObject({ name: 'Olahraga', repeat: [1, 4], remind_at: '06:00' });
    const c = call('TAMBAHIN RUTINITAS wajib baca buku akhir pekan');
    expect(c.args).toMatchObject({ name: 'Baca buku', repeat: 'weekend', is_required: true });
    expect(c.args.remind_at).toBeUndefined();
    expect(call('tambahin rutinitas minum air 8 kali tidak wajib').args).toMatchObject({ name: 'Minum air', kind: 'count', target_count: 8, is_required: false });
  });
  it('tugas: besok + jam', () => {
    expect(call('ada tugas resume jurnal besok jam 20.00').args).toEqual({ title: 'Resume jurnal', due_date: '2026-10-13', due_time: '20:00' });
  });
  it('tugas: tanggal + matkul eksplisit (dicocokkan)', () => {
    expect(call('ada tugas laporan praktikum 5 tanggal 20 matkul basis data lanjut').args)
      .toEqual({ title: 'Laporan praktikum 5', due_date: '2026-10-20', course_name: 'Basis Data Lanjut' });
  });
  it('tugas: matkul tersirat, nama hari, prioritas, bobot', () => {
    const a = call('ada tugas mockup Interaksi Manusia Komputer kamis penting bobot 20%').args;
    expect(a).toMatchObject({ due_date: '2026-10-15', course_name: 'Interaksi Manusia Komputer', priority: 3, weight_pct: 20 });
    expect(a.title).toBe('Mockup Interaksi Manusia Komputer');
  });
  it('tugas: proyek tersirat dari nama proyek', () => {
    expect(call('ada tugas cicil revisi proposal PKM hari ini jam 20:00').args)
      .toEqual({ title: 'Cicil revisi proposal PKM', due_date: TODAY, due_time: '20:00', project_name: 'Proposal PKM' });
  });
  it('tugas tanpa tenggat & tanpa judul', () => {
    expect(call('ada tugas baca jurnal').args).toEqual({ title: 'Baca jurnal' });
    expect(parseIntent('ada tugas', ctx).type).toBe('ask');
  });
  it.each([
    ['jajan bakso 15rb', 15_000, 'Makan', 'Jajan bakso'],
    ['bensin 20.000', 20_000, 'Transport', 'Bensin'],
    ['beli kuota 25k', 25_000, 'Kuota', 'Beli kuota'],
    ['bayar kos 1,5jt', 1_500_000, 'Kos & Tagihan', 'Bayar kos'],
    ['beli stiker 7', 7_000, 'Lainnya', 'Beli stiker'],
    ['nonton bioskop rp 50.000', 50_000, 'Hiburan', 'Nonton bioskop'],
  ])('pengeluaran "%s"', (t, amount, category, note) => {
    expect(call(t).args).toEqual({ kind: 'expense', amount, category_name: category, date: TODAY, time: '16:08', note });
  });
  it('pengeluaran kemarin + jam; tanpa nominal → tanya', () => {
    expect(call('makan siang kemarin jam 12 25rb').args).toMatchObject({ date: '2026-10-11', time: '12:00', amount: 25_000 });
    expect(parseIntent('jajan', ctx).type).toBe('ask');
  });
  it('pemasukan', () => {
    expect(call('dapat kiriman 500rb').args).toMatchObject({ kind: 'income', amount: 500_000, category_name: 'Kiriman' });
    expect(call('gaji 2,5jt').args).toMatchObject({ kind: 'income', amount: 2_500_000, category_name: 'Gaji' });
  });
  it('ujian', () => {
    expect(call('uts basis data lanjut 2 nov jam 8').args).toEqual({ course_name: 'Basis Data Lanjut', kind: 'uts', date: '2026-11-02', time: '08:00' });
    expect(call('kuis analisis sistem kamis jam 10 materi bab 1-3').args)
      .toEqual({ course_name: 'Analisis Sistem', kind: 'kuis', date: '2026-10-15', time: '10:00', material: 'Bab 1-3'.replace('Bab', 'bab') });
    expect(call('uas kalkulus 10 des').args).toMatchObject({ course_name: 'Kalkulus', kind: 'uas', date: '2026-12-10' });
    expect(parseIntent('uts basis data lanjut', ctx).type).toBe('ask');
  });
  it('modul belajar', () => {
    expect(call('modul belajar python dasar 12 unit').args).toEqual({ title: 'Python dasar', unit_count: 12, category: 'pemrograman' });
    expect(call('belajar sql lanjutan 8 bab jam 8 malam tiap hari').args)
      .toEqual({ title: 'Sql lanjutan', unit_count: 8, category: 'basis_data', remind_at: '20:00', remind_days: [1, 2, 3, 4, 5, 6, 7] });
  });
  it('event', () => {
    expect(call('acara seminar karier jumat jam 13-15').args).toEqual({ title: 'Seminar karier', date: '2026-10-16', start_time: '13:00', end_time: '15:00' });
    expect(call('event kumpul alumni besok').args).toEqual({ title: 'Kumpul alumni', date: '2026-10-13', all_day: true });
  });
  it('setoran target', () => {
    expect(call('setor 100rb ke dana darurat').args).toEqual({ goal_name: 'Dana darurat', amount: 100_000 });
    expect(call('setor 50rb ke liburan bali').args).toEqual({ goal_name: 'Liburan Bali', amount: 50_000 });
  });
  it('pertanyaan data, penolakan, bantuan', () => {
    expect(parseIntent('Rangkum minggu ini', ctx).type).toBe('week_summary');
    expect(parseIntent('Aku boros di mana?', ctx).type).toBe('spending');
    expect(parseIntent('hapus tugas resume jurnal', ctx).type).toBe('refuse');
    expect(parseIntent('transfer 100rb ke bank', ctx).type).not.toBe('refuse');
    expect(parseIntent('halo', ctx)).toEqual({ type: 'help', greet: true });
    expect(parseIntent('asdf qwerty', ctx).type).toBe('help');
    // "review" di judul tugas tidak memicu rangkuman
    expect(call('ada tugas review jurnal besok').tool).toBe('propose_task');
  });
});

describe('usulan (proposal-format)', () => {
  it('rutinitas → kartu "Rutinitas wajib baru"', () => {
    const { proposals } = buildProposals([call('tambahin rutinitas siapin bekal jam 06:30 sen-jum')], { today: TODAY });
    expect(proposals).toMatchObject({ title: 'Rutinitas wajib baru', dest: 'Tumbuh' });
    expect(proposals?.items[0]).toMatchObject({ tool: 'propose_routine', kind: 'Rutinitas', label: 'Siapin bekal', detail: 'Sen–Jum · pengingat 06:30', selected: true });
  });
  it('pengeluaran → "Catat pengeluaran"', () => {
    const { proposals } = buildProposals([call('jajan bakso 15rb')], { today: TODAY, defaultWallet: 'Tunai' });
    expect(proposals?.title).toBe('Catat pengeluaran');
    expect(proposals?.items[0]).toMatchObject({ kind: 'Keluar', label: 'Rp 15.000 · Makan', detail: 'Dompet Tunai · hari ini 16:08' });
  });
  it('pemasukan → "Catat pemasukan" + chip Masuk', () => {
    const { proposals } = buildProposals([call('dapat kiriman 500rb')], { today: TODAY });
    expect(proposals?.title).toBe('Catat pemasukan');
    expect(proposals?.items[0].kind).toBe('Masuk');
  });
  it('argumen tidak valid dibuang', () => {
    const r = buildProposals([{ tool: 'propose_task', args: { title: '' } }, { tool: 'propose_exam', args: { course_name: 'X', kind: 'uts' } }], { today: TODAY });
    expect(r).toEqual({ proposals: null, invalid: 2 });
  });
  it('contoh RPS (mode demo) → "Usulan dari RPS Basis Data Lanjut (4)"', () => {
    const calls = sampleFromFile('RPS Basis Data Lanjut.pdf', ctx)!;
    expect(calls).toHaveLength(4);
    const { proposals } = buildProposals(calls, { today: TODAY, fileName: 'RPS Basis Data Lanjut.pdf' });
    expect(proposals?.title).toBe('Usulan dari RPS Basis Data Lanjut (4)');
    expect(proposals?.items.map((i) => [i.kind, i.label, i.detail, i.selected])).toEqual([
      ['Tugas', 'Laporan praktikum 5', 'Selasa 20 Okt · Kuliah · Basis Data Lanjut', true],
      ['Tugas', 'Rancangan ERD kelompok', 'Selasa 27 Okt · Kuliah · Basis Data Lanjut · bobot 10%', true],
      ['Ujian', 'UTS Basis Data Lanjut', 'Senin 2 Nov · 08:00 · pengingat H-3', true],
      ['Modul', 'Basis Data Lanjut', 'Belajar mandiri · 14 unit', false],
    ]);
    expect(proposals?.dest).toBe('Rencana, Kuliah & Tumbuh');
    expect(sampleFromFile('Kontrak Kuliah IMK.pdf', { ...ctx, courses: ['Interaksi Manusia Komputer'] })?.[0].args.course_name).toBe('Interaksi Manusia Komputer');
    expect(sampleFromFile('foto liburan.jpg', ctx)).toBeNull();
  });
  it('judul & tujuan gabungan', () => {
    const items = [
      { tool: 'propose_task' as const, args: { title: 'A' } },
      { tool: 'propose_transaction' as const, args: { kind: 'expense' } },
    ];
    expect(proposalTitle(items)).toBe('Usulan (2)');
    expect(proposalDest(items)).toBe('Rencana & Keuangan');
  });
});

/* ---------------- penerapan ---------------- */

const SEM = 'sem-1';
const data: ApplyData = {
  today: TODAY,
  now: '16:08',
  semesters: [{ id: SEM, number: 6, label: 'Ganjil', start_date: '2026-08-28', end_date: '2027-01-20', is_active: true }],
  courses: [{ id: 'c-bdl', semester_id: SEM, name: 'Basis Data Lanjut', credits: 3, min_attendance_pct: 75 } as Course],
  categories: [
    { id: 'cat-makan', kind: 'expense', name: 'Makan', sort: 1, archived: false, is_default: true },
    { id: 'cat-lain', kind: 'expense', name: 'Lainnya', sort: 2, archived: false, is_default: true },
    { id: 'cat-in-lain', kind: 'income', name: 'Lainnya', sort: 1, archived: false, is_default: true },
  ] as Category[],
  wallets: [
    { id: 'w-bank', name: 'Bank', kind: 'bank', opening_balance: 0, is_default: false, archived: false, sort: 1 },
    { id: 'w-tunai', name: 'Tunai', kind: 'cash', opening_balance: 0, is_default: true, archived: false, sort: 0 },
  ],
  goals: [{ id: 'g-dd', name: 'Dana darurat', kind: 'dana_darurat', target_amount: 5_000_000, priority: 1, assumed_return_pct: 0, status: 'aktif' }],
  projects: [],
  routines: [{ id: 'r1', name: 'Olahraga', kind: 'check', target_count: 1, is_required: true, repeat_days: [1], remind_enabled: true, sort: 3, archived: false }],
  modules: [],
};

function items(...texts: string[]): ProposalItem[] {
  const { proposals } = buildProposals(texts.map(call), { today: TODAY });
  return proposals!.items;
}

let n = 0;
const gen = () => `id-${++n}`;

describe('penerapan kartu aksi (bentuk = input manual)', () => {
  beforeEach(() => { n = 0; });

  it('rutinitas', () => {
    const p = buildApplyPlan(items('tambahin rutinitas siapin bekal jam 06:30 sen-jum'), [0], data, gen);
    expect(p.skipped).toEqual([]);
    expect(p.steps).toEqual([{ item: 0, writes: [{ table: 'routines', row: {
      id: 'id-1', name: 'Siapin bekal', kind: 'check', target_count: 1, is_required: true, repeat_days: [1, 2, 3, 4, 5],
      remind_at: '06:30', remind_enabled: true, icon: null, color: null, sort: 4, archived: false,
    } }] }]);
  });

  it('tugas: kuliah bila matkul cocok, tenggat WIB, pengingat 60 mnt', () => {
    const p = buildApplyPlan(items('ada tugas laporan praktikum 5 tanggal 20 matkul basis data lanjut', 'ada tugas resume jurnal besok jam 20.00'), [0, 1], data, gen);
    const [a, b] = p.steps.map((s) => s.writes[0].row as Record<string, unknown>);
    expect(a).toMatchObject({ title: 'Laporan praktikum 5', source_tag: 'kuliah', course_id: 'c-bdl', due_at: '2026-10-20T16:59:00.000Z', all_day: true, priority: 2, status: 'belum', remind_offsets: [60] });
    expect(b).toMatchObject({ title: 'Resume jurnal', source_tag: 'pribadi', course_id: null, due_at: '2026-10-13T13:00:00.000Z', all_day: false });
  });

  it('transaksi: dompet default, kategori cocok atau "Lainnya", waktu sekarang', () => {
    const p = buildApplyPlan(items('jajan bakso 15rb', 'nonton bioskop 50rb'), [0, 1], data, gen);
    const [a, b] = p.steps.map((s) => s.writes[0]);
    expect(a).toEqual({ table: 'transactions', row: {
      id: 'id-1', kind: 'expense', amount: 15_000, direction: 1, wallet_id: 'w-tunai', to_wallet_id: null, category_id: 'cat-makan',
      occurred_at: wibToInstant(TODAY, '16:08').toISOString(), occurred_on: TODAY, note: 'Jajan bakso', recurring_rule_id: null,
    } });
    expect((b.row as Record<string, unknown>).category_id).toBe('cat-lain');
  });

  it('ujian: matkul baru dibuat sekali di semester aktif', () => {
    const it2 = items('uas kalkulus 10 des', 'kuis kalkulus 1 des jam 10');
    const p = buildApplyPlan(it2, [0, 1], data, gen);
    expect(p.steps[0].writes.map((w) => w.table)).toEqual(['courses', 'exams']);
    expect(p.steps[1].writes.map((w) => w.table)).toEqual(['exams']);
    const course = p.steps[0].writes[0].row as Record<string, unknown>;
    expect(course).toMatchObject({ semester_id: SEM, name: 'Kalkulus', credits: 3, min_attendance_pct: 75 });
    expect(p.steps[1].writes[0].row).toMatchObject({ course_id: course.id, kind: 'kuis', starts_at: '2026-12-01T03:00:00.000Z', prep_status: 'belum' });
  });

  it('modul + unit', () => {
    const p = buildApplyPlan(items('modul belajar figma 3 unit'), [0], data, gen);
    const [m, ...units] = p.steps[0].writes;
    expect(m).toMatchObject({ table: 'learning_modules', row: { title: 'Figma', weekly_target_min: 120, status: 'aktif', color_index: 0 } });
    expect(units.map((u) => [u.table, (u.row as Record<string, unknown>).title, (u.row as Record<string, unknown>).module_id])).toEqual([
      ['learning_units', 'Unit 1', m.row.id], ['learning_units', 'Unit 2', m.row.id], ['learning_units', 'Unit 3', m.row.id],
    ]);
  });

  it('jadwal kelas, event, setoran (cocok / perlu dipilih), hanya item terpilih', () => {
    const its: ProposalItem[] = [
      ...buildProposals([
        { tool: 'propose_class_schedule', args: { course_name: 'basis data lanjut', weekday: 2, start: '08:00', end: '10:30', room: 'R. 2.3' } },
        { tool: 'propose_event', args: { title: 'Seminar', date: '2026-10-16', start_time: '13:00', end_time: '15:00' } },
        { tool: 'propose_goal_contribution', args: { goal_name: 'dana darurat', amount: 100_000 } },
        { tool: 'propose_goal_contribution', args: { goal_name: 'Liburan', amount: 50_000 } },
      ], { today: TODAY }).proposals!.items,
    ];
    const p = buildApplyPlan(its, [0, 1, 2, 3], data, gen);
    expect(p.steps[0].writes).toEqual([{ table: 'course_schedules', row: { id: 'id-1', course_id: 'c-bdl', weekday: 2, start_time: '08:00', end_time: '10:30', room: 'R. 2.3' } }]);
    expect(p.steps[1].writes[0].row).toMatchObject({ starts_at: '2026-10-16T06:00:00.000Z', ends_at: '2026-10-16T08:00:00.000Z', all_day: false });
    expect(p.steps[2].writes[0]).toEqual({ table: 'goal_contributions', row: { id: 'id-3', goal_id: 'g-dd', amount: 100_000, contributed_at: TODAY, note: null } });
    expect(p.skipped).toEqual([{ item: 3, reason: 'perlu dipilih' }]);
    expect(buildApplyPlan(its, [1], data, gen).steps.map((s) => s.item)).toEqual([1]);
  });

  it('Urungkan hanya ≤ 24 jam setelah diterapkan', () => {
    const now = Date.parse('2026-10-12T09:08:00Z');
    const a = (h: number, state: AiAction['state'] = 'applied') => ({ state, created_at: undefined, updated_at: new Date(now - h * 3600_000).toISOString() });
    expect(canUndo(a(23), now)).toBe(true);
    expect(canUndo(a(25), now)).toBe(false);
    expect(canUndo(a(1, 'pending'), now)).toBe(false);
    const refs = [{ table: 'tasks', id: 'a', item: 2 }, { table: 'courses', id: 'b', item: 0 }, { table: 'exams', id: 'c', item: 0 }];
    expect(appliedItems({ id: 'x', message_id: 'm', state: 'applied', applied_refs: refs })).toEqual([0, 2]);
  });
});

/* ---------------- localChat (mode demo) ---------------- */

describe('localChat', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-12T09:08:00Z')); });
  afterEach(() => { vi.useRealTimers(); });

  it('menyimpan pesan pengguna + asisten + ai_actions(pending) tanpa menulis data domain', async () => {
    const db = buildSeed(new Date());
    const routines = db.routines.length;
    const r = await localChat({ text: 'tambahin rutinitas siapin bekal jam 06:30 sen-jum' }, db, localRepo);
    expect(r.source).toBe('demo');
    expect(r.message.proposals?.items[0].label).toBe('Siapin bekal');
    expect(db.routines).toHaveLength(routines);
    expect(db.ai_conversations).toHaveLength(1);
    expect(db.ai_messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    const asst = db.ai_messages[1];
    expect(asst.tools_used).toEqual([{ name: 'propose_routine', args: expect.objectContaining({ name: 'Siapin bekal' }), result_summary: 'shown_to_user_for_confirmation' }]);
    expect(asst.sent_payload).toMatchObject({ mode: 'demo', text: 'tambahin rutinitas siapin bekal jam 06:30 sen-jum' });
    expect(db.ai_actions).toEqual([expect.objectContaining({ id: r.message.action_id, message_id: asst.id, state: 'pending', applied_refs: [] })]);
    // pesan berikut memakai percakapan yang sama
    await localChat({ conversation_id: r.conversation_id, text: 'Rangkum minggu ini' }, db, localRepo);
    expect(db.ai_conversations).toHaveLength(1);
    expect(db.ai_messages[3].content).toMatch(/^Minggu ini sejauh ini:/);
    expect(db.ai_messages[3].tools_used).toEqual([expect.objectContaining({ name: 'get_week_summary' })]);
  });

  it('meredaksi data sensitif, menghormati kuota & pengaturan', async () => {
    const db = buildSeed(new Date());
    await localChat({ text: 'catat ini email aku budi@contoh.id ya' }, db, localRepo);
    expect(db.ai_messages[0].content).toContain('[email]');
    const conv = db.ai_conversations[0].id;
    for (let i = 0; i < 30; i++) db.ai_messages.push({ id: `u${i}`, conversation_id: conv, role: 'user', content: 'x', attachments: [], status: 'ok', created_at: new Date().toISOString() });
    const lim = await localChat({ conversation_id: conv, text: 'jajan 10rb' }, db, localRepo);
    expect(lim.source).toBe('limited');
    expect(lim.message.text).toBe(QUOTA_TEXT);
    expect(db.ai_messages[db.ai_messages.length - 1].status).toBe('limited');

    const off = emptyDb();
    off._settings.ai_chat_enabled = false;
    expect((await localChat({ text: 'halo' }, off, localRepo)).source).toBe('error');
    expect(off.ai_messages).toHaveLength(0);
    await expect(localChat({ text: 'x', attachments: [{ path: 'orang-lain/a.pdf', mime: 'application/pdf', name: 'a.pdf', size: 1 }] }, emptyDb(), localRepo)).rejects.toThrow();
    await expect(localChat({}, emptyDb(), localRepo)).rejects.toThrow();
  });

  it('lampiran RPS → contoh usulan; lampiran lain → penjelasan', async () => {
    const db = buildSeed(new Date());
    const path = `${db._profile.id}/2026-10-12/x-RPS.pdf`;
    const r = await localChat({ text: 'ini RPS dari dosen, rangkum dong', attachments: [{ path, mime: 'application/pdf', name: 'RPS Basis Data Lanjut.pdf', size: 1000, pages: 6 }] }, db, localRepo);
    expect(r.message.proposals?.title).toBe('Usulan dari RPS Basis Data Lanjut (4)');
    expect(db.ai_messages[0].attachments[0]).toMatchObject({ name: 'RPS Basis Data Lanjut.pdf', pages: 6 });
    const r2 = await localChat({ attachments: [{ path, mime: 'image/png', name: 'papan tulis.png', size: 1000 }] }, db, localRepo);
    expect(r2.message.proposals ?? null).toBeNull();
    expect(r2.message.text).toMatch(/Mode demo/);
  });
});
