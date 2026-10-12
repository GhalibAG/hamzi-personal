// Templat ringkasan tanpa AI (TECH-SPEC §7.5) — port aturan src/features/ai/templates.ts untuk Deno.
// Hanya memakai angka dari payload → selalu lolos grounding.
import { thousands } from './common/format.ts';
import type { DailySummary, WeeklyReview } from './common/schemas.ts';
import type { DailyPayload, WeekPayload } from './payload.ts';

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
    const soon = ['hari ini', 'besok', 'terlambat', 'kemarin'].some((x) => top.due.startsWith(x));
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
  if (ex) {
    highlights.push(ex.in_days === 0
      ? `Hari ini ada ${ex.kind} ${ex.course}. Semangat!`
      : `${ex.kind.charAt(0).toUpperCase()}${ex.kind.slice(1)} ${ex.course} tinggal ${ex.in_days} hari.`);
  }
  if (!highlights.length) {
    highlights.push(p.tasks && p.tasks.due_today
      ? `Hari ini ada ${p.tasks.due_today} tugas. Mulai dari yang paling kecil ya.`
      : 'Hari ini santai. Pakai waktunya buat nyicil yang besar.');
  }
  if (!suggestions.length) suggestions.push({ text: 'Catat pengeluaran hari ini biar anggaran tetap rapi.', module: 'finance', action_key: 'log_expense' });
  if (r && r.required_due > 0 && r.required_done === r.required_due && mood === 'calm') mood = 'happy';
  return {
    greeting: `Selamat ${p.part_of_day}!`,
    highlights: highlights.slice(0, 3).map((h) => h.slice(0, 140)),
    suggestions: suggestions.slice(0, 3).map((x) => ({ ...x, text: x.text.slice(0, 160) })),
    mood,
    numbers_used: numbers,
  };
}

export function templateWeekly(p: WeekPayload): WeeklyReview {
  const well: string[] = [];
  const attention: string[] = [];
  const done = p.tasks?.done ?? 0;
  const overdue = p.tasks?.overdue ?? 0;
  const minutes = p.learning?.minutes ?? 0;
  const target = p.learning?.target ?? 0;
  if (done) well.push(`${done} tugas selesai minggu ini.`);
  if (p.garden_trees) well.push(`${p.garden_trees} pohon tumbuh di kebunmu minggu ini.`);
  if (target && minutes >= target) well.push('Target belajar mingguan tercapai.');
  if (overdue) attention.push(`${overdue} tugas terlambat, jadwalkan ulang ya.`);
  if (p.learning && target && minutes < target) attention.push(`Belajar ${minutes} dari ${target} menit.`);
  if (p.finance && p.finance.budget_used_pct >= 80) {
    attention.push(`Anggaran terpakai ${p.finance.budget_used_pct}%${p.finance.top_category ? `, ${p.finance.top_category} paling besar` : ''}.`);
  }
  if (!well.length) well.push('Kamu tetap membuka Hamzi minggu ini. Itu awal yang baik.');
  if (!attention.length) attention.push('Tidak ada yang mendesak. Pertahankan ritmenya.');
  const spent = p.finance?.spent !== undefined ? ` Pengeluaran minggu ini Rp ${thousands(p.finance.spent)}.` : '';
  const head = [p.tasks ? `${done} tugas selesai` : null, p.learning ? `belajar ${minutes} menit` : null].filter(Boolean).join(', ');
  return {
    summary: `Minggu ini${head ? `: ${head}.` : '.'}${spent}`.slice(0, 300),
    went_well: well.slice(0, 3),
    needs_attention: attention.slice(0, 3),
    next_week_priorities: [
      overdue ? 'Selesaikan tugas yang terlambat dulu.' : 'Cicil tugas terbesar sejak awal minggu.',
      target ? 'Jadwalkan sesi belajar singkat setiap hari.' : 'Tambah satu modul belajar mandiri.',
      'Catat pengeluaran setiap malam.',
    ],
    mood: attention.length > 1 ? 'focus' : 'happy',
    numbers_used: [],
  };
}
