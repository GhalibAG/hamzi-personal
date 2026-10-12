// Turunan target tabungan & investasi (setara rpc_goals_overview / rpc_investments_overview).
import { diffDays, goalMonthlyNeeded, goalProgressPct, investmentPL, monthsLeft, netCapital, type DateStr } from '@common/calc/index.ts';
import type { Asset, AssetTransaction, AssetValuation, GoalContribution, SavingsGoal } from '@/data/types';

export function goalSaved(goalId: string, contributions: GoalContribution[]): number {
  return contributions.filter((c) => c.goal_id === goalId && !c.deleted_at).reduce((s, c) => s + c.amount, 0);
}

export interface GoalView {
  goal: SavingsGoal; saved: number; pct: number; monthly: number | null; monthsLeft: number | null; onTrack: boolean | null;
}

export function goalView(goal: SavingsGoal, contributions: GoalContribution[], today: DateStr): GoalView {
  const saved = goalSaved(goal.id, contributions);
  const pct = goalProgressPct(saved, goal.target_amount);
  const ml = goal.due_date ? monthsLeft(Math.max(0, diffDays(today, goal.due_date))) : null;
  const monthly = ml ? goalMonthlyNeeded(goal.target_amount, saved, ml, goal.assumed_return_pct) : null;
  const onTrack = monthly !== null && goal.monthly_plan ? goal.monthly_plan >= monthly : null;
  return { goal, saved, pct, monthly, monthsLeft: ml, onTrack };
}

/** Target aktif prioritas tertinggi (angka priority kecil = lebih penting). */
export function topGoal(goals: SavingsGoal[], contributions: GoalContribution[], today: DateStr): GoalView | null {
  const g = goals.filter((x) => x.status === 'aktif' && !x.deleted_at).sort((a, b) => a.priority - b.priority)[0];
  return g ? goalView(g, contributions, today) : null;
}

export interface AssetView { asset: Asset; capital: number; value: number | null; valuedOn: string | null; pl: number | null; pct: number | null }

export function assetView(asset: Asset, txs: AssetTransaction[], vals: AssetValuation[]): AssetView {
  const mine = txs.filter((t) => t.asset_id === asset.id);
  const capital = netCapital(mine.map((t) => ({ kind: t.kind, amount: t.amount })));
  const last = vals.filter((v) => v.asset_id === asset.id).sort((a, b) => b.valued_on.localeCompare(a.valued_on))[0];
  if (!last) return { asset, capital, value: null, valuedOn: null, pl: null, pct: null };
  const r = investmentPL(capital, last.value);
  return { asset, capital, value: last.value, valuedOn: last.valued_on, pl: r.pl, pct: r.pct };
}

/* ---------- Tambahan (layar Target) ---------- */

export const GOAL_KIND_LABEL: Record<SavingsGoal['kind'], string> = {
  dana_darurat: 'Dana darurat', barang: 'Barang', pendidikan: 'Pendidikan', investasi: 'Investasi', lainnya: 'Lainnya',
};

export type GoalStatus = 'selesai' | 'di_jalur' | 'terlambat' | 'dibatalkan' | 'tanpa_tenggat';
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  selesai: 'Selesai', di_jalur: 'Di jalur', terlambat: 'Terlambat', dibatalkan: 'Dibatalkan', tanpa_tenggat: 'Tanpa tenggat',
};

/** Status GOAL-03: Selesai (progres 100% / ditandai), Terlambat (lewat tenggat atau rencana < kebutuhan), Di jalur. */
export function goalStatus(v: GoalView, today: DateStr): GoalStatus {
  if (v.goal.status === 'dibatalkan') return 'dibatalkan';
  if (v.goal.status === 'selesai' || v.pct >= 100) return 'selesai';
  if (!v.goal.due_date) return 'tanpa_tenggat';
  if (v.goal.due_date < today) return 'terlambat';
  if (v.onTrack === false) return 'terlambat';
  return 'di_jalur';
}

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;

/** Tonggak 25/50/75/100% tertinggi yang baru terlewati (GOAL-07), atau null. */
export function crossedMilestone(prevPct: number, nextPct: number): number | null {
  const hit = GOAL_MILESTONES.filter((m) => prevPct < m && nextPct >= m);
  return hit.length ? hit[hit.length - 1] : null;
}
