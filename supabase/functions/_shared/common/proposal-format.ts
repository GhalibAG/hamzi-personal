// Label & detail kartu aksi dibuat dari argumen tervalidasi, bukan dari teks model (TECH-SPEC §7.8.5).
import { dayLabel, thousands, HARI } from './format.ts';
import { repeatLabel, REPEAT_PRESETS } from './calc/growth.ts';
import type { ProposeTool } from './schemas.ts';

type Args = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : '');
const n = (v: unknown) => (typeof v === 'number' ? v : 0);

export const KIND_LABEL: Record<ProposeTool, string> = {
  propose_task: 'Tugas',
  propose_exam: 'Ujian',
  propose_learning_module: 'Modul',
  propose_routine: 'Rutinitas',
  propose_transaction: 'Keluar',
  propose_class_schedule: 'Jadwal',
  propose_event: 'Event',
  propose_goal_contribution: 'Setoran',
};

export function repeatDaysFromArg(repeat: unknown): number[] {
  if (Array.isArray(repeat)) return repeat as number[];
  if (repeat === 'weekdays') return REPEAT_PRESETS['Sen–Jum'];
  if (repeat === 'weekend') return REPEAT_PRESETS['Akhir pekan'];
  return REPEAT_PRESETS['Setiap hari'];
}

export function proposalKind(tool: ProposeTool, args: Args): string {
  if (tool === 'propose_transaction') return args.kind === 'income' ? 'Masuk' : 'Keluar';
  return KIND_LABEL[tool];
}

export function proposalLabel(tool: ProposeTool, args: Args): string {
  switch (tool) {
    case 'propose_exam': {
      const k = { kuis: 'Kuis', uts: 'UTS', uas: 'UAS', praktikum: 'Praktikum' }[s(args.kind)] ?? 'Ujian';
      return `${k} ${s(args.course_name)}`;
    }
    case 'propose_transaction':
      return `Rp ${thousands(n(args.amount))} · ${s(args.category_name)}`;
    case 'propose_class_schedule':
      return s(args.course_name);
    case 'propose_goal_contribution':
      return `Setor Rp ${thousands(n(args.amount))}`;
    case 'propose_routine':
      return s(args.name);
    default:
      return s(args.title);
  }
}

export function proposalDetail(tool: ProposeTool, args: Args, ctx: { today?: string; defaultWallet?: string } = {}): string {
  switch (tool) {
    case 'propose_task': {
      const parts: string[] = [];
      if (args.due_date) parts.push(dayLabel(s(args.due_date)) + (args.due_time ? ' · ' + s(args.due_time) : ''));
      else parts.push('Tanpa tenggat');
      parts.push(args.course_name ? 'Kuliah' : args.project_name ? 'Proyek' : 'Pribadi');
      if (args.course_name) parts.push(s(args.course_name));
      else if (args.project_name) parts.push(s(args.project_name));
      if (typeof args.weight_pct === 'number') parts.push(`bobot ${args.weight_pct}%`);
      return parts.join(' · ');
    }
    case 'propose_exam':
      return `${dayLabel(s(args.date))}${args.time ? ' · ' + s(args.time) : ''} · pengingat H-3`;
    case 'propose_learning_module': {
      const count = Array.isArray(args.unit_titles) ? (args.unit_titles as unknown[]).length : n(args.unit_count) || 10;
      return `Belajar mandiri · ${count} unit`;
    }
    case 'propose_routine': {
      const days = repeatDaysFromArg(args.repeat);
      let d = `${repeatLabel(days)} · pengingat ${s(args.remind_at) || '07:00'}`;
      if (args.kind === 'count' && args.target_count) d += ` · target ${n(args.target_count)}`;
      return d;
    }
    case 'propose_transaction': {
      const when = !args.date || args.date === ctx.today ? 'hari ini' : dayLabel(s(args.date));
      return `Dompet ${ctx.defaultWallet ?? 'Tunai'} · ${when}${args.time ? ' ' + s(args.time) : ''}`;
    }
    case 'propose_class_schedule':
      return `${HARI[n(args.weekday)]} ${s(args.start)}–${s(args.end)}${args.room ? ' · ' + s(args.room) : ''}`;
    case 'propose_event':
      return `${dayLabel(s(args.date))}${args.start_time ? ' · ' + s(args.start_time) + (args.end_time ? '–' + s(args.end_time) : '') : ''}`;
    case 'propose_goal_contribution':
      return `${s(args.goal_name)} · ${args.date ? dayLabel(s(args.date)) : 'hari ini'}`;
  }
}
