// Turunan portofolio (INV-04). Rumus modal bersih & untung/rugi di @common/calc (lewat assetView).
import { diffDays, investmentPL, type DateStr } from '@common/calc/index.ts';
import type { Asset, AssetTransaction, AssetValuation } from '@/data/types';
import { assetView, type AssetView } from '@/features/goals/derive';

export const ASSET_CLASSES = [
  'rd_pasar_uang', 'rd_obligasi', 'rd_campuran', 'rd_saham', 'emas', 'saham', 'kripto', 'deposito', 'lainnya',
] as const;
export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABEL: Record<string, string> = {
  rd_pasar_uang: 'Reksa dana pasar uang', rd_obligasi: 'Reksa dana obligasi', rd_campuran: 'Reksa dana campuran',
  rd_saham: 'Reksa dana saham', emas: 'Emas', saham: 'Saham', kripto: 'Kripto', deposito: 'Deposito', lainnya: 'Lainnya',
};

/** Kelas warna (token) per kelas aset untuk alokasi. */
export const ASSET_CLASS_BAR: Record<string, string> = {
  rd_pasar_uang: 'bg-lm-0-bar', rd_obligasi: 'bg-lm-1-bar', rd_campuran: 'bg-lm-2-bar', rd_saham: 'bg-lm-3-bar',
  emas: 'bg-target-bar', saham: 'bg-invest-bar', kripto: 'bg-kuliah-bar', deposito: 'bg-brand-500', lainnya: 'bg-n-400',
};

export const ASSET_TX_LABEL: Record<AssetTransaction['kind'], string> = { beli: 'Beli', jual: 'Jual', setor: 'Setor', tarik: 'Tarik' };

export interface Portfolio {
  views: AssetView[];
  capital: number;
  value: number;
  pl: number;
  pct: number | null;
  /** Alokasi per kelas aset (berdasarkan nilai terkini; aset tanpa valuasi memakai modal bersih). */
  allocation: { assetClass: string; value: number; pct: number }[];
}

export function portfolio(assets: Asset[], txs: AssetTransaction[], vals: AssetValuation[]): Portfolio {
  const views = assets.filter((a) => !a.archived).map((a) => assetView(a, txs, vals));
  const capital = views.reduce((s, v) => s + v.capital, 0);
  const value = views.reduce((s, v) => s + (v.value ?? v.capital), 0);
  const r = investmentPL(capital, value);
  const byClass = new Map<string, number>();
  for (const v of views) byClass.set(v.asset.asset_class, (byClass.get(v.asset.asset_class) ?? 0) + Math.max(0, v.value ?? v.capital));
  const total = [...byClass.values()].reduce((s, x) => s + x, 0);
  const allocation = [...byClass.entries()]
    .map(([assetClass, val]) => ({ assetClass, value: val, pct: total > 0 ? Math.round((val / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  return { views, capital, value, pl: r.pl, pct: r.pct, allocation };
}

/** "hari ini" / "kemarin" / "3 hari lalu" untuk tanggal valuasi. */
export function agoLabel(d: DateStr, today: DateStr): string {
  const n = diffDays(d, today);
  if (n <= 0) return 'hari ini';
  if (n === 1) return 'kemarin';
  return `${n} hari lalu`;
}

/** "+2,1%" / "−0,8%" (persen satu desimal, koma Indonesia). */
export function pctSigned(p: number | null): string {
  if (p === null) return '–';
  const s = Math.abs(p).toFixed(1).replace('.', ',').replace(/,0$/, '');
  return (p > 0 ? '+' : p < 0 ? '−' : '') + s + '%';
}
