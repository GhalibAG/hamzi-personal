/** XP yang dibutuhkan dari level L ke L+1 (PRD §7.8). */
export function xpToNext(level: number): number {
  return 100 + 50 * (level - 1);
}

/** Level dari total XP kumulatif. */
export function levelFromXp(xp: number): number {
  let lvl = 1;
  let rest = Math.max(0, xp);
  let need = xpToNext(lvl);
  while (rest >= need) {
    rest -= need;
    lvl += 1;
    need = xpToNext(lvl);
  }
  return lvl;
}

/** Progres di level saat ini: { level, into, need, pct }. */
export function xpProgress(xp: number): { level: number; into: number; need: number; pct: number } {
  const level = levelFromXp(xp);
  let spent = 0;
  for (let l = 1; l < level; l++) spent += xpToNext(l);
  const into = Math.max(0, xp) - spent;
  const need = xpToNext(level);
  return { level, into, need, pct: Math.round((into / need) * 100) };
}

/** XP tugas selesai berdasarkan prioritas 1..4 (Rendah/Sedang/Tinggi/Kritis). */
export function taskXp(priority: 1 | 2 | 3 | 4): number {
  const mult = { 1: 1, 2: 1.2, 3: 1.5, 4: 2 }[priority];
  return Math.round(10 * mult);
}

export const XP = {
  routine: 5,
  allRequired: 10,
  perFiveStudyMin: 1,
  studyMaxPerDay: 60,
  transaction: 2,
  transactionMaxPerDay: 3,
  weeklyTarget: 50,
  goal: { 25: 20, 50: 30, 75: 40, 100: 100 } as Record<number, number>,
};
