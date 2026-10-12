// Test vector wajib TECH-SPEC §13 (#1–#36). Hasil harus identik.
import { describe, expect, it } from 'vitest';
import {
  addDays, attendancePct, attendanceWarn, budgetUsedPct, ceil2, courseProjected, cycleStart, daysLeftInCycle,
  emergencyFundTarget, futureValue, gardenLevel, goalMonthlyNeeded, hasBloom, investmentPL, ips, ipk, isRoutineDue,
  levelFromXp, pctVsAvg, priorityScore, projectedGpa, qualifies, requiredAvgForTarget, requiredIpsThisSemester,
  roundHalfUp2, safeDaily, safeDailyRounded, shouldSendNow, streak, taskXp, treeStage, waterForStudyDay, xpToNext,
  type DateStr,
} from '@common/calc/index.ts';
import { detectSensitive, redact } from '@common/sensitive.ts';
import { groundingCheck } from '@common/grounding.ts';
import { matchName } from '@common/match.ts';
import { proposalDetail } from '@common/proposal-format.ts';

describe('TECH-SPEC §13 test vectors', () => {
  it('#1 ips', () => {
    const v = ips([{ credits: 3, grade: 'A' }, { credits: 2, grade: 'B' }, { credits: 3, grade: 'B+' }]);
    expect(v).toBeCloseTo(3.5625, 10);
    expect(roundHalfUp2(v)).toBe(3.56);
  });
  it('#2 ipk', () => {
    expect(roundHalfUp2(ipk([{ points: 70, credits: 20 }, { points: 28.5, credits: 8 }]))).toBe(3.52);
  });
  it('#3 requiredAvgForTarget', () => {
    const r = requiredAvgForTarget({ creditsDone: 100, pointsDone: 350, creditsLeft: 44, target: 3.6 });
    expect(r.display).toBe(3.83);
    expect(r.unreachable).toBe(false);
  });
  it('#4 requiredAvgForTarget unreachable', () => {
    const r = requiredAvgForTarget({ creditsDone: 100, pointsDone: 350, creditsLeft: 20, target: 3.65 });
    expect(r.value).toBeCloseTo(4.4, 10);
    expect(r.unreachable).toBe(true);
  });
  it('#5 courseProjected', () => {
    const r = courseProjected([{ weightPct: 30, score: 90 }, { weightPct: 30, score: 80 }, { weightPct: 40, score: null }], 80);
    expect(r.current).toBe(85);
    expect(r.neededOnRemaining).toBe(72.5);
  });
  it('#6 attendancePct', () => expect(attendancePct(12, 14)).toBe(85.71));
  it('#7 safeDaily', () => {
    expect(budgetUsedPct(1_740_000, 3_000_000)).toBe(58);
    expect(safeDaily(3_000_000, 1_740_000, 21)).toBe(60_000);
  });
  it('#8 cycleStart', () => expect(cycleStart('2026-10-12', 25)).toBe('2026-09-25'));
  it('#9 cycleStart', () => expect(cycleStart('2026-10-28', 25)).toBe('2026-10-25'));
  it('#10 goalMonthlyNeeded r=0', () => expect(goalMonthlyNeeded(12_000_000, 3_000_000, 6)).toBe(1_500_000));
  it('#11 futureValue', () => expect(Math.abs(futureValue(0, 500_000, 12, 12) - 6_341_251)).toBeLessThanOrEqual(1));
  it('#12 goalMonthlyNeeded r=12%', () => expect(goalMonthlyNeeded(6_000_000, 0, 12, 12)).toBe(473_093));
  it('#13 emergencyFundTarget', () => expect(emergencyFundTarget(3_000_000, 6)).toBe(18_000_000));
  it('#14 investmentPL', () => expect(investmentPL(2_000_000, 2_150_000)).toEqual({ pl: 150_000, pct: 7.5 }));
  it('#15 xpToNext', () => expect([xpToNext(1), xpToNext(2), xpToNext(5)]).toEqual([100, 150, 300]));
  it('#16 taskXp', () => expect([taskXp(1), taskXp(2), taskXp(3), taskXp(4)]).toEqual([10, 12, 15, 20]));
  it('#17 priorityScore', () => {
    const now = new Date('2026-10-12T09:00:00Z');
    expect(priorityScore({ priority: 3, dueAt: new Date('2026-10-11T16:59:00Z') }, now)).toBe(95);
  });
  it('#18 redact', () => {
    expect(detectSensitive('transfer ke 1234567890123')).toContain('nomor_panjang');
    expect(redact('transfer ke 1234567890123')).not.toMatch(/\d{9,}/);
  });
  it('#19 streak', () => {
    const today: DateStr = '2026-10-12';
    const set = (days: number[]) => new Set(days.map((d) => addDays(today, -d)));
    const q1 = set([3, 2, 1]);
    expect(streak(today, (d) => q1.has(d))).toBe(3);
    const q2 = set([3, 2, 1, 0]);
    expect(streak(today, (d) => q2.has(d))).toBe(4);
    const q3 = set([3, 2, 0]);
    expect(streak(today, (d) => q3.has(d))).toBe(1);
    const q4 = set([3, 2]);
    expect(streak(today, (d) => q4.has(d))).toBe(0);
  });
  it('#20 groundingCheck', () => {
    expect(groundingCheck('Pengeluaran naik 37% hari ini', { pct: 37 }).ok).toBe(true);
    expect(groundingCheck('Kamu boros Rp 250.000 minggu ini', { pct: 37 }).ok).toBe(false);
  });
  it('#21 requiredIpsThisSemester', () => {
    const r = requiredIpsThisSemester({ pointsDone: 343.9, creditsDone: 95, semesterCredits: 17, target: 3.65 });
    expect(r.display).toBe(3.82);
  });
  it('#22 projectedGpa', () => {
    expect(roundHalfUp2(projectedGpa({ pointsDone: 343.9, creditsDone: 95, semesterPoints: 63, semesterCredits: 17 }))).toBe(3.63);
  });
  it('#23 treeStage', () => {
    expect(treeStage(0).name).toBe('Biji');
    expect(treeStage(4).name).toBe('Biji');
    expect(treeStage(5).name).toBe('Tunas');
    const s48 = treeStage(48);
    expect(s48).toMatchObject({ name: 'Pohon muda', progressPct: 90, toNext: 2, nextName: 'Pohon rindang' });
    expect(treeStage(50).name).toBe('Pohon rindang');
    expect(treeStage(80).name).toBe('Pohon berbuah');
    expect(treeStage(200)).toMatchObject({ name: 'Pohon berbuah', progressPct: 100 });
  });
  it('#24 gardenLevel', () => {
    expect([gardenLevel(4, 0, 0), gardenLevel(4, 1, 0), gardenLevel(4, 2, 0), gardenLevel(4, 4, 0), gardenLevel(0, 0, 15), gardenLevel(0, 0, 5)])
      .toEqual([0, 1, 2, 3, 3, 0]);
    expect(hasBloom(gardenLevel(4, 4, 12), 12)).toBe(true);
    expect(hasBloom(gardenLevel(4, 3, 30), 30)).toBe(false);
  });
  it('#25 waterForStudyDay', () => {
    expect(waterForStudyDay([10, 15, 20, 30])).toBe(3);
    expect(waterForStudyDay([9])).toBe(0);
  });
  it('#26 safeDailyRounded', () => expect(safeDailyRounded(2_000_000, 1_160_000, 20)).toBe(42_000));
  it('#27 pctVsAvg', () => expect(pctVsAvg(85_000, 62_000)).toBe(37));
  it('#28 isRoutineDue', () => {
    expect(isRoutineDue([1, 2, 3, 4, 5], '2026-10-17')).toBe(false);
    expect(isRoutineDue([1, 2, 3, 4, 5], '2026-10-12')).toBe(true);
  });
  it('#29 shouldSendNow', () => {
    expect(shouldSendNow('system', '23:30')).toBe(false);
    expect(shouldSendNow('user', '04:30')).toBe(true);
  });
  it('#30 attendanceWarn', () => {
    expect(attendanceWarn(4, 6, 75)).toBe(true);
    expect(attendanceWarn(5, 6, 75)).toBe(false);
  });
  it('#31 matchName', () => {
    expect(matchName('basis data lanjut ', [{ name: 'Basis Data Lanjut' }, { name: 'Pemrograman Web' }])?.name).toBe('Basis Data Lanjut');
  });
  it('#32 proposalDetail', () => {
    expect(proposalDetail('propose_task', { title: 'Laporan', due_date: '2026-10-20', course_name: 'Basis Data Lanjut' }))
      .toBe('Selasa 20 Okt · Kuliah · Basis Data Lanjut');
  });
  it('#33 levelFromXp', () => {
    expect([0, 99, 100, 249, 250, 449, 450].map(levelFromXp)).toEqual([1, 1, 2, 2, 3, 3, 4]);
  });
  it('#34 belajar gabungan', () => {
    const mins = [6, 6];
    const total = mins.reduce((a, b) => a + b, 0);
    expect(waterForStudyDay(mins)).toBe(0);
    const lvl = gardenLevel(4, 4, total);
    expect(hasBloom(lvl, total)).toBe(true);
    expect(qualifies(lvl, total)).toBe(true);
  });
  it('#35 daysLeftInCycle', () => {
    expect(daysLeftInCycle('2026-10-12', 1)).toBe(20);
    expect(daysLeftInCycle('2026-10-12', 25)).toBe(13);
  });
  it('#36 roundHalfUp2', () => {
    expect([roundHalfUp2(3.5625), roundHalfUp2(3.565), roundHalfUp2(3.70588)]).toEqual([3.56, 3.57, 3.71]);
    expect(ceil2(3.81765)).toBe(3.82);
  });
});
