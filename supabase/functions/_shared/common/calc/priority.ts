export interface PriorityInput {
  priority: 1 | 2 | 3 | 4;
  dueAt?: Date | null;
  linkedSoon?: boolean; // ujian/proyek bertenggat ≤ 7 hari
}

const BASE: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50 };

/** Skor prioritas tugas (PRD §7.9). */
export function priorityScore(t: PriorityInput, now: Date = new Date()): number {
  let s = BASE[t.priority];
  if (t.dueAt) {
    const h = (t.dueAt.getTime() - now.getTime()) / 3_600_000;
    if (h < 0) s += 60;
    else if (h <= 24) s += 40;
    else if (h <= 72) s += 20;
  }
  if (t.linkedSoon) s += 10;
  return s;
}

export const PRIORITY_LABEL: Record<number, string> = { 1: 'Rendah', 2: 'Sedang', 3: 'Tinggi', 4: 'Kritis' };
