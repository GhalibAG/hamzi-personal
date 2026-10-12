import { isoWeekday, type DateStr } from './calc/date.ts';

export const HARI = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const HARI_PENDEK = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
export const BULAN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
export const BULAN_PENDEK = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** "1.250.000" */
export function thousands(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (neg ? '−' : '') + s;
}

/** "Rp 1.250.000" atau "Rp •••••" bila disembunyikan. */
export function rupiah(n: number, hidden = false): string {
  if (hidden) return 'Rp •••••';
  return n < 0 ? '−Rp ' + thousands(-n) : 'Rp ' + thousands(n);
}

/** Ringkas: "Rp 1,7 jt", "Rp 473rb". */
export function rupiahShort(n: number, hidden = false): string {
  if (hidden) return 'Rp •••';
  const a = Math.abs(n);
  if (a >= 1_000_000) {
    const v = Math.round((a / 1_000_000) * 10) / 10;
    return 'Rp ' + String(v).replace('.', ',') + ' jt';
  }
  if (a >= 1000) return 'Rp ' + Math.round(a / 1000) + 'rb';
  return 'Rp ' + a;
}

/** "Selasa 20 Okt" */
export function dayLabel(d: DateStr): string {
  const [, m, day] = d.split('-').map(Number);
  return `${HARI[isoWeekday(d)]} ${day} ${BULAN_PENDEK[m]}`;
}

/** "Selasa, 13 Okt" */
export function dayLabelComma(d: DateStr): string {
  const [, m, day] = d.split('-').map(Number);
  return `${HARI[isoWeekday(d)]}, ${day} ${BULAN_PENDEK[m]}`;
}

/** "Senin, 12 Oktober" */
export function dayLong(d: DateStr, withYear = false): string {
  const [y, m, day] = d.split('-').map(Number);
  return `${HARI[isoWeekday(d)]}, ${day} ${BULAN[m]}${withYear ? ' ' + y : ''}`;
}

export function monthLabel(y: number, m: number): string {
  return `${BULAN[m]} ${y}`;
}

export function decimalId(x: number, digits = 2): string {
  return x.toFixed(digits).replace('.', ',');
}
