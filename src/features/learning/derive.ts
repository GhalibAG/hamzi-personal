// Turunan tampilan Belajar mandiri (BEL-04): inisial, palet, unit berikutnya, meta kartu modul. Murni, tanpa efek.
import type { LearningModule, LearningUnit, StudySession } from '@/data/types';
import { studiedOn } from '@/features/growth/derive';

/** Palet modul lm-0..4 (DESIGN-SYSTEM §2.1) — kelas statis agar terbaca Tailwind. */
export const LM_TILE = [
  'bg-lm-0-bg text-lm-0-fg', 'bg-lm-1-bg text-lm-1-fg', 'bg-lm-2-bg text-lm-2-fg', 'bg-lm-3-bg text-lm-3-fg', 'bg-lm-4-bg text-lm-4-fg',
] as const;
export const LM_BG = ['bg-lm-0-bg', 'bg-lm-1-bg', 'bg-lm-2-bg', 'bg-lm-3-bg', 'bg-lm-4-bg'] as const;
export const LM_FG = ['text-lm-0-fg', 'text-lm-1-fg', 'text-lm-2-fg', 'text-lm-3-fg', 'text-lm-4-fg'] as const;

export function lmIndex(i: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  const n = Number.isFinite(i) ? Number(i) : 0;
  return (((n % 5) + 5) % 5) as 0 | 1 | 2 | 3 | 4;
}

/** Inisial 2 huruf dari judul (logika prototipe; kata tanpa huruf/angka seperti "&" dilewati). */
export function moduleInitials(title: string): string {
  const words = title.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w));
  const a = words[0] ?? '?';
  const b = words[1] ? words[1].charAt(0) : a.charAt(1);
  return (a.charAt(0) + (b ?? '')).toUpperCase();
}

export const CATEGORY_LABEL: Record<string, string> = {
  pemrograman: 'Pemrograman', basis_data: 'Basis Data', statistik: 'Statistik', bahasa: 'Bahasa',
  sertifikasi: 'Sertifikasi', kuliah: 'Kuliah', lainnya: 'Lainnya',
};
export const CATEGORIES = Object.keys(CATEGORY_LABEL);

export const UNIT_KIND_LABEL: Record<LearningUnit['kind'], string> = {
  video: 'Video', bacaan: 'Bacaan', latihan: 'Latihan', proyek: 'Proyek', kuis: 'Kuis',
};
export const UNIT_KINDS = Object.keys(UNIT_KIND_LABEL) as LearningUnit['kind'][];

export const STATUS_LABEL: Record<LearningModule['status'], string> = { aktif: 'Aktif', ditunda: 'Dijeda', selesai: 'Selesai' };

/** Unit satu modul, urut `sort`. */
export function unitsOf(units: LearningUnit[], moduleId: string): LearningUnit[] {
  return units.filter((u) => u.module_id === moduleId).sort((x, y) => x.sort - y.sort);
}

/** Unit berikutnya: yang sedang dipelajari, kalau tidak ada yang pertama belum selesai. */
export function nextUnit(sorted: LearningUnit[]): LearningUnit | undefined {
  return sorted.find((u) => u.status === 'sedang') ?? sorted.find((u) => u.status !== 'selesai');
}

/** "Unit 7 · Normalisasi" (judul bawaan "Unit 7" tidak diulang). */
export function unitLabel(sorted: LearningUnit[], unit: LearningUnit): string {
  const n = sorted.findIndex((u) => u.id === unit.id) + 1;
  if (/^unit\s*\d+$/i.test(unit.title.trim())) return unit.title.trim();
  return n > 0 ? `Unit ${n} · ${unit.title}` : unit.title;
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

export interface ModuleView {
  module: LearningModule;
  units: LearningUnit[];
  done: number;
  total: number;
  pct: number;
  next: LearningUnit | undefined;
  nextLabel: string | null;
  studiedToday: boolean;
  /** Meta BEL-04: "Berikutnya: Unit 7 · Normalisasi · ingat 20:00" */
  meta: string;
  /** Meta desktop: "Berikutnya: Unit 7 · Normalisasi" */
  metaShort: string;
  color: 0 | 1 | 2 | 3 | 4;
  initials: string;
}

export function moduleView(m: LearningModule, allUnits: LearningUnit[], sessions: StudySession[], today: string): ModuleView {
  const units = unitsOf(allUnits, m.id);
  const done = units.filter((u) => u.status === 'selesai').length;
  const total = units.length;
  const next = nextUnit(units);
  const nextLabel = next ? unitLabel(units, next) : null;
  const studiedToday = studiedOn(sessions, today, m.id);
  const remind = m.remind_enabled && m.remind_at ? `ingat ${hhmm(m.remind_at)}` : 'tanpa pengingat';
  const lead = studiedToday ? 'Sudah belajar hari ini' : nextLabel ? `Berikutnya: ${nextLabel}` : total ? 'Semua unit selesai' : 'Belum ada unit';
  return {
    module: m, units, done, total, pct: total ? Math.round((done / total) * 100) : 0, next, nextLabel, studiedToday,
    meta: `${lead} · ${remind}`,
    metaShort: nextLabel ? `Berikutnya: ${nextLabel}` : lead,
    color: lmIndex(m.color_index), initials: moduleInitials(m.title),
  };
}
