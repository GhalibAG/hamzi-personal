// Templat lokal ringkasan tanpa AI (TECH-SPEC §7.5). Hanya memakai angka dari payload → selalu lolos grounding.
import { thousands } from '@common/format.ts';
import type { DailySummary, WeeklyReview } from '@common/schemas.ts';
import type { DailyPayload, WeekPayload } from './payload';

export const ACTION_LABEL: Record<string, string> = {
  create_task_split: 'Buat tugas cicil',
  start_timer: 'Mulai fokus',
  log_expense: 'Catat pengeluaran',
  open_budget: 'Cek anggaran',
  open_routines: 'Lihat rutinitas',
};

export function templateDaily(p: DailyPayload): DailySummary {
  const highlights: string[] = [];
  const suggestions: DailySummary['suggestions'] = [];
  const numbers: { label: string; value: number }[] = [];
  let mood: DailySummary['mood'] = 'calm';

  const f = p.finance;
  if (f && f.pct_vs_avg_7d !== null && f.pct_vs_avg_7d >= 20) {
    highlights.push(`Pengeluaran hari ini ${f.pct_vs_avg_7d}% di atas rata-rata 7 hari. Coba bawa bekal besok.`);
    numbers.push({ label: 'pct_vs_avg_7d', value: f.pct_vs_avg_7d });
  }
  if (f && f.budget_used_pct >= 80) {
    highlights.push(`Anggaran siklus ini sudah terpakai ${f.budget_used_pct}%.`);
    suggestions.push({ text: 'Cek anggaran per kategori.', module: 'finance', action_key: 'open_budget' });
    numbers.push({ label: 'budget_used_pct', value: f.budget_used_pct });
    mood = 'worried';
  }
  const top = p.tasks?.top[0];
  if (top) {
    const soon = top.due.startsWith('hari ini') || top.due.startsWith('besok') || top.due.startsWith('terlambat') || top.due.startsWith('kemarin');
    if (soon) {
      highlights.push(`${top.label} tenggatnya ${top.due}, cicil ${top.est_min && top.est_min <= 60 ? top.est_min : 30} menit malam ini ya.`);
      suggestions.push({ text: `Pecah "${top.label}" jadi langkah kecil.`, module: 'tasks', action_key: 'create_task_split' });
      if (top.est_min) numbers.push({ label: 'est_min', value: top.est_min });
      if (mood === 'calm') mood = 'focus';
    }
  }
  const r = p.routines;
  if (r && r.required_due > 0 && r.required_done < r.required_due) {
    suggestions.push({ text: `Rutinitas wajib ${r.required_done}/${r.required_due}. Selesaikan sisanya biar pohon berbunga.`, module: 'routines', action_key: 'open_routines' });
  }
  if (r && r.streak_days >= 3) highlights.push(`Streak ${r.streak_days} hari, pertahankan!`);
  const l = p.learning;
  if (l && l.weekly_target_min > 0 && l.minutes_today < 10) {
    suggestions.push({ text: `Belajar minggu ini ${l.weekly_done_min} dari ${l.weekly_target_min} menit. Satu sesi 25 menit dulu?`, module: 'learning', action_key: 'start_timer' });
  }
  const ex = p.schedule?.exams_next_7d.find((e) => e.in_days <= 3);
  if (ex) highlights.push(ex.in_days === 0 ? `Hari ini ada ${ex.kind} ${ex.course}. Semangat!` : `${ex.kind[0].toUpperCase()}${ex.kind.slice(1)} ${ex.course} tinggal ${ex.in_days} hari.`);
  if (!highlights.length) highlights.push(p.tasks && p.tasks.due_today ? `Hari ini ada ${p.tasks.due_today} tugas. Mulai dari yang paling kecil ya.` : 'Hari ini santai. Pakai waktunya buat nyicil yang besar.');
  if (!suggestions.length) suggestions.push({ text: 'Catat pengeluaran hari ini biar anggaran tetap rapi.', module: 'finance', action_key: 'log_expense' });
  if (r && r.required_due > 0 && r.required_done === r.required_due && mood === 'calm') mood = 'happy';
  return {
    greeting: `Selamat ${p.part_of_day}!`,
    highlights: highlights.slice(0, 3),
    suggestions: suggestions.slice(0, 3),
    mood,
    numbers_used: numbers,
  };
}

export function templateWeekly(p: WeekPayload): WeeklyReview {
  const well: string[] = [];
  const attention: string[] = [];
  if (p.tasks.done) well.push(`${p.tasks.done} tugas selesai minggu ini.`);
  if (p.garden_trees) well.push(`${p.garden_trees} pohon tumbuh di kebunmu minggu ini.`);
  if (p.learning.target && p.learning.minutes >= p.learning.target) well.push('Target belajar mingguan tercapai.');
  if (p.tasks.overdue) attention.push(`${p.tasks.overdue} tugas terlambat, jadwalkan ulang ya.`);
  if (p.learning.target && p.learning.minutes < p.learning.target) attention.push(`Belajar ${p.learning.minutes} dari ${p.learning.target} menit.`);
  if (p.finance && p.finance.budget_used_pct >= 80) attention.push(`Anggaran terpakai ${p.finance.budget_used_pct}%${p.finance.top_category ? `, ${p.finance.top_category} paling besar` : ''}.`);
  if (!well.length) well.push('Kamu tetap membuka Hamzi minggu ini. Itu awal yang baik.');
  if (!attention.length) attention.push('Tidak ada yang mendesak. Pertahankan ritmenya.');
  const spent = p.finance?.spent !== undefined ? ` Pengeluaran minggu ini Rp ${thousands(p.finance.spent)}.` : '';
  return {
    summary: `Minggu ini: ${p.tasks.done} tugas selesai, belajar ${p.learning.minutes} menit.${spent}`.slice(0, 300),
    went_well: well.slice(0, 3),
    needs_attention: attention.slice(0, 3),
    next_week_priorities: [
      p.tasks.overdue ? 'Selesaikan tugas yang terlambat dulu.' : 'Cicil tugas terbesar sejak awal minggu.',
      p.learning.target ? `Jadwalkan ${Math.max(1, Math.ceil(p.learning.target / 25 / 7))} sesi belajar per hari.` : 'Tambah satu modul belajar mandiri.',
      'Catat pengeluaran setiap malam.',
    ],
    mood: attention.length > 1 ? 'focus' : 'happy',
    numbers_used: [],
  };
}

/** Teks review mingguan untuk pesan chat (format TECH-SPEC §6.4 langkah 8). */
export function weeklyToText(w: WeeklyReview): string {
  return [
    w.summary,
    '',
    'Yang berjalan baik:',
    ...w.went_well.map((x) => `• ${x}`),
    '',
    'Perlu perhatian:',
    ...w.needs_attention.map((x) => `• ${x}`),
    '',
    '3 prioritas minggu depan:',
    ...w.next_week_priorities.map((x, i) => `${i + 1}. ${x}`),
  ].join('\n');
}
