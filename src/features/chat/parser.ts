// Parser perintah Bahasa Indonesia untuk MODE DEMO (tanpa AI). Murni & deterministik: teks → niat + argumen propose_*.
// Argumen divalidasi ulang dengan PROPOSE_SCHEMAS di proposals.ts sebelum ditampilkan.
import { addDays, isoWeekday, weekStart, type DateStr } from '@common/calc/index.ts';
import { matchName, normName } from '@common/match.ts';
import type { ProposeTool } from '@common/schemas.ts';

export interface ParseContext {
  today: DateStr;
  /** Jam WIB sekarang 'HH:MM'. */
  now: string;
  /** Nama matkul semester aktif. */
  courses: string[];
  categories: { name: string; kind: 'expense' | 'income' }[];
  goals: string[];
  projects: string[];
}

export interface ToolCall { tool: ProposeTool; args: Record<string, unknown>; selected?: boolean }

export type Intent =
  | { type: 'propose'; calls: ToolCall[]; reply: string }
  | { type: 'week_summary' }
  | { type: 'spending' }
  | { type: 'refuse' }
  | { type: 'ask'; text: string }
  | { type: 'help'; greet?: boolean };

/* ---------------- util teks ---------------- */

interface Hit { start: number; end: number }
interface Found<T> extends Hit { value: T }

const pad = (n: number) => String(n).padStart(2, '0');
const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Hapus rentang yang ditemukan dari teks. Rentang yang tumpang tindih digabung dulu; dipotong dari belakang. */
function cut(text: string, hits: (Hit | null | undefined)[]): string {
  const hs = hits.filter((h): h is Hit => !!h).sort((a, b) => a.start - b.start);
  const merged: Hit[] = [];
  for (const h of hs) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) last.end = Math.max(last.end, h.end);
    else merged.push({ start: h.start, end: h.end });
  }
  let s = text;
  for (const h of merged.reverse()) s = s.slice(0, h.start) + ' ' + s.slice(h.end);
  return squash(s);
}

type Match = RegExpExecArray & Hit;

/** Kecocokan pertama + posisi (start/end) agar bisa langsung dipotong dengan `cut`. */
function firstMatch(re: RegExp, text: string): Match | null {
  const r = new RegExp(re.source, re.flags.replace('g', ''));
  const m = r.exec(text);
  return m ? Object.assign(m, { start: m.index, end: m.index + m[0].length }) : null;
}

const FILLER_END = /(?:[\s,]+(?:dong|ya+|yah|deh|ok|oke|please|pls|tolong|nih|aja|sih|untuk|buat|di|pada|ke|yang|dan))+[\s.!?,]*$/i;
const FILLER_START = /^(?:(?:tolong|dong|coba|please|pls|eh|hamzi)[\s,]+)+/i;

function tidy(s: string): string {
  let x = squash(s.replace(/[“”"]/g, ' '));
  for (let i = 0; i < 3; i++) x = x.replace(FILLER_END, '').replace(FILLER_START, '').replace(/^[\s,:;.\-–—]+|[\s,:;\-–—]+$/g, '');
  return squash(x);
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function titleCase(s: string): string {
  return s.split(' ').map((w) => (w.length <= 3 && w === w.toUpperCase() ? w : capitalize(w))).join(' ');
}

/* ---------------- jam ---------------- */

function toTime(hRaw: string, mRaw: string | undefined, period: string | undefined): string | null {
  let h = Number(hRaw);
  const m = mRaw ? Number(mRaw) : 0;
  if (!Number.isFinite(h) || h > 24 || m > 59) return null;
  const p = period?.toLowerCase();
  if ((p === 'sore' || p === 'malam') && h < 12) h += 12;
  else if (p === 'siang' && h < 11) h += 12;
  else if (p === 'malam' && h === 12) h = 0;
  else if (p === 'pagi' && h === 12) h = 0;
  if (h === 24) h = 0;
  return `${pad(h)}:${pad(m)}`;
}

const PERIOD = '(pagi|siang|sore|malam)';
const TIME_WORD = /\b(?:jam|pukul|pkl)\.?\s*(\d{1,2})(?:[.:](\d{2}))?(?:\s*(?:wib))?(?:\s+(pagi|siang|sore|malam))?\b/i;
const TIME_BARE = new RegExp(`\\b([01]?\\d|2[0-3])[.:]([0-5]\\d)\\b(?:\\s*wib)?(?:\\s+${PERIOD})?`, 'i');
const TIME_RANGE_WORD = new RegExp(
  `\\b(?:jam|pukul|pkl)\\.?\\s*(\\d{1,2})(?:[.:](\\d{2}))?\\s*(?:-|–|—|s\\.?d\\.?|sampai|hingga)\\s*(?:jam\\s*)?(\\d{1,2})(?:[.:](\\d{2}))?(?:\\s*wib)?(?:\\s+${PERIOD})?\\b`, 'i');
const TIME_RANGE_BARE = /\b([01]?\d|2[0-3])[.:]([0-5]\d)\s*(?:-|–|—|sampai|hingga)\s*([01]?\d|2[0-3])[.:]([0-5]\d)\b/i;

export function parseTime(text: string): Found<string> | null {
  for (const re of [TIME_WORD, TIME_BARE]) {
    const m = firstMatch(re, text);
    if (m) {
      const t = toTime(m[1], m[2], m[3]);
      if (t) return { value: t, start: m.index, end: m.index + m[0].length };
    }
  }
  return null;
}

export function parseTimeRange(text: string): Found<{ start: string; end: string }> | null {
  const a = firstMatch(TIME_RANGE_WORD, text);
  if (a) {
    const start = toTime(a[1], a[2], a[5]);
    const end = toTime(a[3], a[4], a[5]);
    if (start && end) return { value: { start, end }, start: a.index, end: a.index + a[0].length };
  }
  const b = firstMatch(TIME_RANGE_BARE, text);
  if (b) {
    const start = toTime(b[1], b[2], undefined);
    const end = toTime(b[3], b[4], undefined);
    if (start && end) return { value: { start, end }, start: b.index, end: b.index + b[0].length };
  }
  return null;
}

/* ---------------- hari & tanggal ---------------- */

const DAY_TOKENS: [RegExp, number][] = [
  [/^sen(in)?$/, 1], [/^sel(asa)?$/, 2], [/^rab(u)?$/, 3], [/^kam(is)?$/, 4],
  [/^jum('?at)?$/, 5], [/^sab(tu)?$/, 6], [/^(min(ggu)?|ahad)$/, 7],
];
const DAY_RE_SRC = "senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad|sen|sel|rab|kam|jum|sab|min";

function dayNum(tok: string): number | null {
  const t = tok.toLowerCase();
  for (const [re, n] of DAY_TOKENS) if (re.test(t)) return n;
  return null;
}

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^feb/, 2], [/^mar/, 3], [/^apr/, 4], [/^mei/, 5], [/^jun/, 6], [/^jul/, 7],
  [/^(agu|agt)/, 8], [/^sep/, 9], [/^okt/, 10], [/^nov/, 11], [/^des/, 12],
];
const MONTH_SRC = 'jan(?:uari)?|feb(?:ruari)?|mar(?:et)?|apr(?:il)?|mei|jun(?:i)?|jul(?:i)?|agu(?:stus)?|agt|sep(?:t(?:ember)?)?|okt(?:ober)?|nov(?:ember)?|des(?:ember)?';

function monthNum(tok: string): number | null {
  const t = tok.toLowerCase();
  for (const [re, n] of MONTHS) if (re.test(t)) return n;
  return null;
}

function validDate(y: number, m: number, d: number): DateStr | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return null;
  return dt.toISOString().slice(0, 10);
}

/** Tanggal di masa depan terdekat untuk hari-bulan (tahun ini, atau tahun depan bila sudah lewat > 7 hari). */
function upcomingDayMonth(today: DateStr, m: number, d: number): DateStr | null {
  const y = Number(today.slice(0, 4));
  const a = validDate(y, m, d);
  if (a && a >= addDays(today, -7)) return a;
  return validDate(y + 1, m, d);
}

/** Tanggal "tanggal 20" → bulan ini bila belum lewat, selain itu bulan depan. */
function upcomingDayOfMonth(today: DateStr, d: number): DateStr | null {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const a = validDate(y, m, d);
  if (a && a >= today) return a;
  return m === 12 ? validDate(y + 1, 1, d) : validDate(y, m + 1, d);
}

export function parseDate(text: string, today: DateStr): Found<DateStr> | null {
  const rel: [RegExp, number][] = [
    [/\b(?:hari ini|hr ini|nanti malam|malam ini|sore ini)\b/i, 0],
    [/\bbesok(?:\s+lusa)?\b|\bbsk\b/i, 1],
    [/\blusa\b/i, 2],
    [/\bkemarin\b|\bkmrn\b/i, -1],
    [/\bminggu depan\b/i, 7],
  ];
  // urutan: tanggal eksplisit dulu, lalu relatif, lalu nama hari
  const iso = firstMatch(/\b(\d{4})-(\d{2})-(\d{2})\b/, text);
  if (iso) {
    const v = validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (v) return { value: v, start: iso.index, end: iso.index + iso[0].length };
  }
  const dm = firstMatch(new RegExp(`\\b(?:(?:tanggal|tgl)\\.?\\s*)?(\\d{1,2})\\s+(${MONTH_SRC})\\b(?:\\s+(\\d{4}))?`, 'i'), text);
  if (dm) {
    const mo = monthNum(dm[2]);
    const v = mo ? (dm[3] ? validDate(Number(dm[3]), mo, Number(dm[1])) : upcomingDayMonth(today, mo, Number(dm[1]))) : null;
    if (v) return { value: v, start: dm.index, end: dm.index + dm[0].length };
  }
  const slash = firstMatch(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/, text);
  if (slash) {
    const y = slash[3] ? Number(slash[3].length === 2 ? '20' + slash[3] : slash[3]) : null;
    const v = y ? validDate(y, Number(slash[2]), Number(slash[1])) : upcomingDayMonth(today, Number(slash[2]), Number(slash[1]));
    if (v) return { value: v, start: slash.index, end: slash.index + slash[0].length };
  }
  const tgl = firstMatch(/\b(?:tanggal|tgl)\.?\s*(\d{1,2})\b/i, text);
  if (tgl) {
    const v = upcomingDayOfMonth(today, Number(tgl[1]));
    if (v) return { value: v, start: tgl.index, end: tgl.index + tgl[0].length };
  }
  for (const [re, off] of rel) {
    const m = firstMatch(re, text);
    if (m) return { value: addDays(today, off), start: m.index, end: m.index + m[0].length };
  }
  const day = firstMatch(/\b(?:hari\s+)?(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad)\b(?!\s+(?:ini|lalu|ke|kemarin))(\s+depan)?/i, text);
  if (day) {
    const n = dayNum(day[1])!;
    let off = ((n - isoWeekday(today) + 7) % 7) || 7;
    let v = addDays(today, off);
    if (day[2] && weekStart(v) === weekStart(today)) { off += 7; v = addDays(today, off); }
    return { value: v, start: day.index, end: day.index + day[0].length };
  }
  return null;
}

/* ---------------- ulangi (rutinitas) ---------------- */

export type RepeatArg = 'daily' | 'weekdays' | 'weekend' | number[];

function presetOf(days: number[]): RepeatArg {
  const s = [...new Set(days)].sort((a, b) => a - b);
  const k = s.join(',');
  if (k === '1,2,3,4,5,6,7') return 'daily';
  if (k === '1,2,3,4,5') return 'weekdays';
  if (k === '6,7') return 'weekend';
  return s;
}

export function parseRepeat(text: string): Found<RepeatArg> | null {
  const daily = firstMatch(/\b(?:setiap|tiap)\s*(?:hari|pagi|siang|sore|malam)\b|\b(?:daily|harian)\b/i, text);
  const range = firstMatch(new RegExp(`\\b(${DAY_RE_SRC})\\s*(?:-|–|—|s\\.?d\\.?|sampai|hingga)\\s*(${DAY_RE_SRC})\\b`, 'i'), text);
  if (range) {
    const a = dayNum(range[1]);
    const b = dayNum(range[2]);
    if (a && b) {
      const days: number[] = [];
      for (let d = a; ; d = (d % 7) + 1) { days.push(d); if (d === b || days.length > 7) break; }
      const pre = firstMatch(/\b(?:setiap|tiap)\s*$/i, text.slice(0, range.index));
      const start = pre ? pre.index : range.index;
      return { value: presetOf(days), start, end: range.index + range[0].length };
    }
  }
  const wk = firstMatch(/\b(?:weekdays?|hari kerja|hari kuliah)\b/i, text);
  if (wk) return { value: 'weekdays', start: wk.index, end: wk.index + wk[0].length };
  const we = firstMatch(/\b(?:setiap\s+|tiap\s+)?(?:akhir pekan|weekend)\b/i, text);
  if (we) return { value: 'weekend', start: we.index, end: we.index + we[0].length };
  const list = firstMatch(new RegExp(`\\b(?:setiap|tiap)\\s+((?:${DAY_RE_SRC})(?:\\s*(?:,|&|\\+|dan|sama)\\s*(?:${DAY_RE_SRC}))*)\\b`, 'i'), text);
  if (list) {
    const days = list[1].split(/\s*(?:,|&|\+|\bdan\b|\bsama\b)\s*/i).map((t) => dayNum(t.trim())).filter((x): x is number => !!x);
    if (days.length) return { value: presetOf(days), start: list.index, end: list.index + list[0].length };
  }
  if (daily) return { value: 'daily', start: daily.index, end: daily.index + daily[0].length };
  return null;
}

/* ---------------- nominal ---------------- */

const AMOUNT_RE = /(\brp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d{1,2})?)\s*(rb|ribu|k|jt|juta)?(?![\w])/gi;

function amountValue(raw: string, unit: string | undefined): number {
  const u = unit?.toLowerCase();
  const mult = u === 'jt' || u === 'juta' ? 1_000_000 : u ? 1000 : 1;
  const n = /^\d{1,3}(?:[.,]\d{3})+$/.test(raw) ? Number(raw.replace(/[.,]/g, '')) : Number(raw.replace(',', '.'));
  return Math.round(n * mult);
}

/** Nominal rupiah: "25rb", "25k", "25.000", "1,5jt", "Rp 12.500". Tanpa satuan & < 1000 → dianggap ribuan. */
export function parseAmount(text: string): Found<number> | null {
  const all = [...text.matchAll(AMOUNT_RE)].map((m) => ({
    m, strong: !!m[1] || !!m[3], value: amountValue(m[2], m[3]),
  }));
  if (!all.length) return null;
  const pick = all.find((a) => a.strong) ?? all.find((a) => a.value >= 1000) ?? all[0];
  let value = pick.value;
  if (!pick.strong && value < 1000) value *= 1000;
  if (!Number.isFinite(value) || value < 1) return null;
  const idx = pick.m.index ?? 0;
  return { value, start: idx, end: idx + pick.m[0].length };
}

/* ---------------- pencocokan nama ---------------- */

/** Cari nama kandidat yang muncul utuh di dalam teks (mis. nama matkul di tengah kalimat). */
function containedName(text: string, names: string[]): string | null {
  const t = ` ${normName(text)} `;
  const sorted = [...names].sort((a, b) => b.length - a.length);
  return sorted.find((n) => normName(n) && t.includes(` ${normName(n)} `)) ?? null;
}

function canonical(input: string, names: string[]): string | null {
  return matchName(input, names.map((name) => ({ name })))?.name ?? null;
}

/* ---------------- kategori ---------------- */

const EXPENSE_CAT: [RegExp, string][] = [
  [/\b(makan|jajan|ngopi|kopi|minum|bakso|nasi|mie|mi ayam|snack|cemilan|sarapan|gorengan|seblak|martabak|es teh|boba|warteg)\b/i, 'Makan'],
  [/\b(ojek|ojol|bensin|grab|gojek|maxim|parkir|angkot|bus|kereta|krl|transport|tol|bengkel)\b/i, 'Transport'],
  [/\b(kuota|pulsa|paket data|internet|wifi)\b/i, 'Kuota'],
  [/\b(kos|kost|listrik|token|tagihan|pdam)\b/i, 'Kos & Tagihan'],
  [/\b(buku|fotokopi|fotocopy|print|ukt|spp|modul|alat tulis)\b/i, 'Pendidikan'],
  [/\b(obat|dokter|apotek|klinik|vitamin)\b/i, 'Kesehatan'],
  [/\b(nonton|bioskop|game|netflix|spotify|konser)\b/i, 'Hiburan'],
  [/\b(belanja|baju|sabun|sampo|skincare|sepatu|tas)\b/i, 'Belanja'],
  [/\b(sedekah|donasi|kondangan|traktir|kado|arisan)\b/i, 'Sosial'],
];
const INCOME_CAT: [RegExp, string][] = [
  [/\b(gaji|gajian|honor|upah)\b/i, 'Gaji'],
  [/\b(kiriman|dikirim|transferan|ortu|orang tua|mama|papa|ibu|ayah|uang saku|jajan dari)\b/i, 'Kiriman'],
  [/\b(bonus|thr|hadiah|beasiswa)\b/i, 'Bonus'],
  [/\b(jualan|usaha|dagang|freelance|proyekan|order)\b/i, 'Usaha'],
];

export function guessCategory(text: string, kind: 'expense' | 'income', cats: ParseContext['categories']): string {
  const own = cats.filter((c) => c.kind === kind).map((c) => c.name);
  for (const [re, name] of kind === 'expense' ? EXPENSE_CAT : INCOME_CAT) {
    if (re.test(text)) return canonical(name, own) ?? (own.length ? canonical('Lainnya', own) ?? 'Lainnya' : name);
  }
  return canonical('Lainnya', own) ?? 'Lainnya';
}

const MODULE_CAT: [RegExp, string][] = [
  [/\b(sql|basis data|database|mysql|postgres|query)\b/i, 'basis_data'],
  [/\b(python|javascript|js|react|web|html|css|java|kotlin|flutter|program|coding|ngoding|golang|php|laravel|git)\b/i, 'pemrograman'],
  [/\b(statistik|statistika|spss|data analis|analisis data|excel)\b/i, 'statistik'],
  [/\b(inggris|english|toefl|ielts|bahasa|jepang|arab|mandarin|korea)\b/i, 'bahasa'],
  [/\b(sertifikasi|certification|aws|azure|cisco|ccna|cert)\b/i, 'sertifikasi'],
];

/* ---------------- niat ---------------- */

const RE = {
  refuse: /^(?:tolong\s+)?(?:hapus(?:in|kan)?|delete|ubah(?:in)?|edit|ganti(?:in)?|pindah(?:in|kan)|transfer(?:in)?|reset|matikan|nyalakan|aktifkan)\b/i,
  greet: /^(?:hai|halo|hallo|hi|hello|hey|pagi|siang|sore|malam|assalamualaikum|permisi)\b[\s!.,]*$/i,
  help: /^(?:bantuan|help|tolong|bisa apa|kamu bisa apa|apa aja yang bisa)\b/i,
  week: /\b(?:rangkum|ringkas|rekap|review|ringkasan)(?:in|kan)?\b[^.]*\b(?:minggu|pekan)\b|^(?:rangkum|ringkas|rekap)(?:in|kan)?(?:\s+(?:dong|ya|data(?:ku)?|semua))*[\s!.?]*$|\bminggu ini\b.*\b(?:gimana|bagaimana)\b/i,
  spending: /\bboros\b|\b(?:pengeluaran(?:ku)?|uangku|duitku)\b.*\b(?:paling|terbesar|banyak|habis)\b|\bhabis (?:di|ke) mana\b/i,
  routine: /\b(?:rutinitas|kebiasaan|habit)\b/i,
  goal: /\bsetor(?:an)?\b|\bnabung\b/i,
  task: /\b(?:tugas|deadline|tenggat|pr|kumpul(?:in|kan)?)\b/i,
  exam: /\b(?:ujian|uts|uas|kuis|quiz|praktikum)\b/i,
  module: /^(?:(?:tambahin|tambahkan|tambah|bikin(?:in)?|buat(?:in|kan)?)\s+)?(?:modul|belajar)\b|\bmodul\b/i,
  event: /\b(?:event|acara|agenda|kegiatan)\b/i,
  income: /\b(?:dapat|dapet|terima|nerima|gaji|gajian|kiriman|dikirim(?:in)?|transferan|bonus|pemasukan|thr|beasiswa)\b/i,
  expense: /\b(?:jajan|beli|bayar|makan|minum|ngopi|kopi|bensin|ojek|ojol|grab|gojek|parkir|kuota|pulsa|habis|keluar|belanja|nonton|pengeluaran|catat)\b/i,
};

const VERB_PREFIX = '(?:tolong\\s+)?(?:(?:tambahin|tambahkan|tambah|bikin(?:in)?|buat(?:in|kan)?|catat(?:in)?|masukin|masukkan|add|ada|ingetin|ingatkan)\\s+)?';

export function parseIntent(raw: string, ctx: ParseContext): Intent {
  const text = squash(raw);
  if (!text) return { type: 'help' };
  if (RE.greet.test(text)) return { type: 'help', greet: true };
  if (RE.help.test(text) && text.split(' ').length <= 4) return { type: 'help' };
  if (RE.refuse.test(text) && !STRONG_AMOUNT.test(text)) return { type: 'refuse' };
  if (RE.week.test(text)) return { type: 'week_summary' };
  if (RE.spending.test(text)) return { type: 'spending' };
  if (RE.routine.test(text)) return routine(text);
  if (RE.goal.test(text) && parseAmount(text)) return goal(text, ctx);
  if (EVENT_START.test(text)) return eventIntent(text, ctx);
  if (RE.task.test(text)) return task(text, ctx);
  if (RE.exam.test(text)) return exam(text, ctx);
  if (RE.module.test(text)) return moduleIntent(text);
  if (RE.event.test(text)) return eventIntent(text, ctx);
  if (RE.income.test(text) && parseAmount(text)) return transaction(text, 'income', ctx);
  if (RE.expense.test(text)) return transaction(text, 'expense', ctx);
  // nominal yang jelas (Rp/rb/jt) tanpa kata kerja → anggap pengeluaran
  if (STRONG_AMOUNT.test(text)) return transaction(text, 'expense', ctx);
  return { type: 'help' };
}

const STRONG_AMOUNT = /\d\s*(?:rb|ribu|k|jt|juta)\b|\brp\.?\s*\d/i;
const EVENT_START = new RegExp(`^\\s*${VERB_PREFIX}(?:event|acara|agenda|kegiatan)\\b`, 'i');

/* ---------------- rutinitas ---------------- */

function routine(text: string): Intent {
  const time = parseTime(text);
  const rep = parseRepeat(text);
  const optional = /\b(?:tidak|nggak|ngga|gak|ga|enggak)\s+wajib\b|\bopsional\b|\bkebiasaan\b/i.test(text);
  const countM = firstMatch(/\b(\d{1,2})\s*(?:x|kali)\b(?:\s+(?:sehari|per hari))?/i, text);
  const head = firstMatch(new RegExp(`^\\s*${VERB_PREFIX}(?:satu\\s+|1\\s+)?(?:rutinitas|kebiasaan|habit)(?:\\s+(?:wajib|baru|harian|opsional))*\\s*[:\\-]?`, 'i'), text);
  const flags = firstMatch(/\b(?:(?:tidak|nggak|ngga|gak|ga|enggak)\s+)?wajib\b|\bopsional\b/i, text);
  let name = cut(text, [time, rep, head, flags, countM ? { start: countM.index, end: countM.index + countM[0].length } : null]);
  name = name.replace(/\b(?:rutinitas|kebiasaan|habit)\b/gi, ' ').replace(/\b(?:pengingat|ingetin|ingatkan)\b/gi, ' ');
  name = capitalize(tidy(name)).slice(0, 60).trim();
  if (!name) return { type: 'ask', text: 'Rutinitasnya apa? Contoh: "tambahin rutinitas minum air jam 9 pagi".' };
  const args: Record<string, unknown> = {
    name,
    kind: countM ? 'count' : 'check',
    repeat: rep?.value ?? 'daily',
    is_required: !optional,
  };
  if (countM) args.target_count = Math.min(50, Math.max(1, Number(countM[1])));
  if (time) args.remind_at = time.value;
  const reply = time
    ? 'Siap. Ini rutinitas yang aku tangkap, cek dulu ya:'
    : 'Siap. Ini rutinitas yang aku tangkap. Jam pengingatnya aku isi 07:00 dulu, bisa diubah nanti. Cek dulu ya:';
  return { type: 'propose', calls: [{ tool: 'propose_routine', args }], reply };
}

/* ---------------- tugas ---------------- */

const STOP_AFTER_NAME = "(?=\\s+(?:besok|lusa|hari ini|tanggal|tgl|jam|pukul|deadline(?:nya)?|dikumpul(?:kan)?|kumpul|senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|prioritas|bobot|penting|urgent|matkul|mata kuliah|proyek|project)\\b|[,.;]|$)";

function task(text: string, ctx: ParseContext): Intent {
  const time = parseTime(text);
  let rest = cut(text, [time]);
  const date = parseDate(rest, ctx.today);
  rest = cut(rest, [date]);
  const head = firstMatch(new RegExp(`^\\s*${VERB_PREFIX}(?:tugas|deadline|tenggat|pr)\\b(?:\\s+baru)?\\s*[:\\-]?`, 'i'), rest);
  rest = cut(rest, [head]);
  const course = firstMatch(new RegExp(`\\b(?:matkul|mata kuliah|mk)\\.?\\s+(.+?)${STOP_AFTER_NAME}`, 'i'), rest);
  let courseName: string | undefined;
  if (course) {
    courseName = canonical(course[1], ctx.courses) ?? undefined;
    rest = cut(rest, [{ start: course.index, end: course.index + course[0].length }]);
  }
  const project = firstMatch(new RegExp(`\\b(?:proyek|project)\\s+(.+?)${STOP_AFTER_NAME}`, 'i'), rest);
  let projectName: string | undefined;
  if (project) {
    projectName = canonical(project[1], ctx.projects) ?? undefined;
    if (projectName) rest = cut(rest, [{ start: project.index, end: project.index + project[0].length }]);
  }
  const weight = firstMatch(/\bbobot(?:nya)?\s*(\d{1,3})\s*(?:%|persen)?/i, rest);
  if (weight) rest = cut(rest, [{ start: weight.index, end: weight.index + weight[0].length }]);
  let priority: 1 | 2 | 3 | 4 | undefined;
  const prio = firstMatch(/\b(?:prioritas\s+)?(kritis|darurat|penting banget|penting|urgent|mendesak|tinggi|sedang|rendah|santai)\b/i, rest);
  if (prio) {
    const p = prio[1].toLowerCase();
    priority = p === 'kritis' || p === 'darurat' || p === 'penting banget' ? 4 : p === 'rendah' || p === 'santai' ? 1 : p === 'sedang' ? 2 : 3;
    rest = cut(rest, [{ start: prio.index, end: prio.index + prio[0].length }]);
  }
  rest = rest.replace(/\b(?:dikumpul(?:kan|in)?|kumpul(?:in|kan)?|deadline(?:nya)?|tenggat(?:nya)?|sebelum|paling lambat|maks(?:imal)?)\b/gi, ' ');
  if (!courseName) courseName = containedName(rest, ctx.courses) ?? undefined;
  if (!courseName && !projectName) projectName = containedName(rest, ctx.projects) ?? undefined;
  const title = capitalize(tidy(rest)).slice(0, 200).trim();
  if (!title) return { type: 'ask', text: 'Tugasnya apa? Contoh: "ada tugas resume jurnal besok jam 20.00".' };
  const args: Record<string, unknown> = { title };
  if (date) args.due_date = date.value;
  if (date && time) args.due_time = time.value;
  else if (!date && time) { args.due_date = ctx.today; args.due_time = time.value; }
  if (priority) args.priority = priority;
  if (courseName) args.course_name = courseName;
  if (projectName) args.project_name = projectName;
  if (weight) args.weight_pct = Math.min(100, Number(weight[1]));
  const reply = args.due_date ? 'Aku masukin ke Rencana ya, cek dulu:' : 'Aku masukin ke Rencana tanpa tenggat dulu ya, cek dulu:';
  return { type: 'propose', calls: [{ tool: 'propose_task', args }], reply };
}

/* ---------------- ujian ---------------- */

function exam(text: string, ctx: ParseContext): Intent {
  const lower = text.toLowerCase();
  const kind = /\buts\b|ujian tengah/.test(lower) ? 'uts'
    : /\buas\b|ujian akhir/.test(lower) ? 'uas'
      : /\bpraktikum\b/.test(lower) ? 'praktikum'
        : /\b(?:kuis|quiz)\b/.test(lower) ? 'kuis' : 'kuis';
  const time = parseTime(text);
  let rest = cut(text, [time]);
  const date = parseDate(rest, ctx.today);
  rest = cut(rest, [date]);
  const material = firstMatch(/\b(?:materi(?:nya)?|bahan(?:nya)?|bab)\s*:?\s+(.+)$/i, rest);
  if (material) rest = cut(rest, [{ start: material.index, end: material.index + material[0].length }]);
  rest = rest
    .replace(/\bujian\s+(?:tengah|akhir)\s+semester\b/gi, ' ')
    .replace(/\b(?:ujian|uts|uas|kuis|quiz|praktikum)\b/gi, ' ')
    .replace(new RegExp(`^\\s*${VERB_PREFIX}`, 'i'), ' ')
    .replace(/\b(?:jadwal|matkul|mata kuliah|mk|ada|nanti|tanggal|tgl)\b/gi, ' ');
  const typed = tidy(rest);
  if (!typed) return { type: 'ask', text: 'Ujian matkul apa? Contoh: "uts basis data lanjut 2 nov jam 8".' };
  if (!date) return { type: 'ask', text: `Ujian ${typed} tanggal berapa? Contoh: "${kind} ${typed.toLowerCase()} 2 nov jam 8".` };
  const course = canonical(typed, ctx.courses) ?? titleCase(typed);
  const args: Record<string, unknown> = { course_name: course.slice(0, 120), kind, date: date.value };
  if (time) args.time = time.value;
  if (material) args.material = tidy(material[1]).slice(0, 300);
  const known = ctx.courses.some((c) => c === course);
  const reply = known
    ? 'Ini ujian yang aku tangkap, pengingatnya H-3. Cek dulu ya:'
    : `Matkul "${course}" belum ada di semester aktif, nanti aku buatkan sekalian. Cek dulu ya:`;
  return { type: 'propose', calls: [{ tool: 'propose_exam', args }], reply };
}

/* ---------------- modul belajar ---------------- */

function moduleIntent(text: string): Intent {
  const time = parseTime(text);
  let rest = cut(text, [time]);
  const rep = parseRepeat(rest);
  rest = cut(rest, [rep]);
  const units = firstMatch(/\b(\d{1,2})\s*(unit|bab|pertemuan|materi|part|bagian|video|sesi)\b/i, rest);
  if (units) rest = cut(rest, [{ start: units.index, end: units.index + units[0].length }]);
  const head = firstMatch(new RegExp(`^\\s*${VERB_PREFIX}(?:modul(?:\\s+belajar)?|belajar(?:\\s+mandiri)?)\\b(?:\\s+(?:baru|tentang|soal))?\\s*[:\\-]?`, 'i'), rest);
  rest = cut(rest, [head]).replace(/\b(?:modul|isi(?:nya)?|terdiri dari|sebanyak|dengan)\b/gi, ' ');
  const title = capitalize(tidy(rest)).slice(0, 80).trim();
  if (!title) return { type: 'ask', text: 'Modulnya tentang apa? Contoh: "modul belajar python dasar 10 unit".' };
  const args: Record<string, unknown> = { title, unit_count: units ? Math.min(40, Math.max(1, Number(units[1]))) : 10 };
  const cat = MODULE_CAT.find(([re]) => re.test(title))?.[1];
  args.category = cat ?? 'lainnya';
  if (time) args.remind_at = time.value;
  if (rep) args.remind_days = rep.value === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : rep.value === 'weekdays' ? [1, 2, 3, 4, 5] : rep.value === 'weekend' ? [6, 7] : rep.value;
  return { type: 'propose', calls: [{ tool: 'propose_learning_module', args }], reply: 'Siap, ini modul belajarnya. Unitnya bisa kamu ganti judulnya nanti. Cek dulu ya:' };
}

/* ---------------- event ---------------- */

function eventIntent(text: string, ctx: ParseContext): Intent {
  const range = parseTimeRange(text);
  let rest = cut(text, [range]);
  const time = range ? null : parseTime(rest);
  rest = cut(rest, [time]);
  const date = parseDate(rest, ctx.today);
  rest = cut(rest, [date]);
  const allDay = /\b(?:seharian|sehari penuh|all day|full day)\b/i.test(rest);
  rest = rest.replace(/\b(?:seharian|sehari penuh|all day|full day)\b/gi, ' ');
  const head = firstMatch(new RegExp(`^\\s*${VERB_PREFIX}(?:event|acara|agenda|kegiatan)\\b(?:\\s+baru)?\\s*[:\\-]?`, 'i'), rest);
  rest = cut(rest, [head]).replace(/\b(?:event|acara|agenda)\b/gi, ' ');
  const title = capitalize(tidy(rest)).slice(0, 120).trim();
  if (!title) return { type: 'ask', text: 'Acaranya apa? Contoh: "acara seminar karier jumat jam 13-15".' };
  if (!date) return { type: 'ask', text: `"${title}" tanggal berapa? Contoh: "acara ${title.toLowerCase()} besok jam 13-15".` };
  const args: Record<string, unknown> = { title, date: date.value };
  if (range) { args.start_time = range.value.start; args.end_time = range.value.end; }
  else if (time) args.start_time = time.value;
  if (allDay || (!range && !time)) args.all_day = true;
  return { type: 'propose', calls: [{ tool: 'propose_event', args }], reply: 'Ini acaranya, aku taruh di Kalender. Cek dulu ya:' };
}

/* ---------------- setoran target ---------------- */

function goal(text: string, ctx: ParseContext): Intent {
  const date = parseDate(text, ctx.today);
  let rest = cut(text, [date]);
  const amount = parseAmount(rest)!;
  const after = rest.slice(amount.end);
  const target = firstMatch(/^\s*(?:ke|untuk|buat|di)\s+(?:target\s+|tabungan\s+)?(.+)$/i, after);
  rest = cut(rest, [amount]);
  const typed = tidy(target?.[1] ?? '');
  const name = typed ? canonical(typed, ctx.goals) : ctx.goals.length === 1 ? ctx.goals[0] : null;
  if (!name && !typed) return { type: 'ask', text: 'Setor ke target yang mana? Contoh: "setor 100rb ke dana darurat".' };
  const goalName = (name ?? titleCase(typed)).slice(0, 120);
  const args: Record<string, unknown> = { goal_name: goalName, amount: amount.value };
  if (date) args.date = date.value;
  const reply = name
    ? 'Ini setorannya, cek dulu ya:'
    : `Target "${goalName}" belum ketemu. Kalau disimpan, item ini ditandai "perlu dipilih" supaya kamu pilih targetnya manual. Cek dulu ya:`;
  return { type: 'propose', calls: [{ tool: 'propose_goal_contribution', args }], reply };
}

/* ---------------- transaksi ---------------- */

function transaction(text: string, kind: 'expense' | 'income', ctx: ParseContext): Intent {
  const time = parseTime(text);
  let rest = cut(text, [time]);
  const date = parseDate(rest, ctx.today);
  rest = cut(rest, [date]);
  const amount = parseAmount(rest);
  if (!amount) {
    return {
      type: 'ask',
      text: kind === 'expense'
        ? 'Berapa nominalnya? Contoh: "jajan bakso 15rb" atau "bensin 20.000".'
        : 'Berapa yang masuk? Contoh: "dapat kiriman 500rb".',
    };
  }
  rest = cut(rest, [amount]);
  const category = guessCategory(text, kind, ctx.categories);
  const note = capitalize(tidy(rest.replace(/\b(?:catat(?:in)?|pengeluaran|pemasukan|tadi|barusan|habis|seharga|sebesar)\b/gi, ' '))).slice(0, 140);
  const args: Record<string, unknown> = {
    kind,
    amount: amount.value,
    category_name: category,
    date: date?.value ?? ctx.today,
    time: time?.value ?? (date && date.value !== ctx.today ? '12:00' : ctx.now),
  };
  if (note) args.note = note;
  const when = !date || date.value === ctx.today ? ' hari ini' : '';
  const reply = kind === 'expense' ? `Oke, aku catat sebagai pengeluaran${when}. Cek dulu ya:` : `Oke, aku catat sebagai pemasukan${when}. Cek dulu ya:`;
  return { type: 'propose', calls: [{ tool: 'propose_transaction', args }], reply };
}

/* ---------------- lampiran (demo) ---------------- */

/** Contoh usulan dari nama file RPS/kontrak kuliah (mode demo tidak membaca isi file). */
export function sampleFromFile(fileName: string, ctx: ParseContext): ToolCall[] | null {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '');
  const lower = base.toLowerCase();
  const isRps = /\brps\b|silabus/.test(lower);
  const isKontrak = /kontrak/.test(lower);
  if (!isRps && !isKontrak) return null;
  const hint = tidy(base.replace(/\b(?:rps|silabus|kontrak|kuliah|perkuliahan|semester|ganjil|genap|final|revisi|v\d+)\b/gi, ' ').replace(/[_\-()[\]]+/g, ' ').replace(/\d{4}/g, ' '));
  const course = (hint && (canonical(hint, ctx.courses) ?? containedName(hint, ctx.courses))) || ctx.courses[0] || (hint ? titleCase(hint) : 'Mata kuliah');
  const d = (n: number) => addDays(ctx.today, n);
  if (isRps) {
    return [
      { tool: 'propose_task', args: { title: 'Laporan praktikum 5', due_date: d(8), course_name: course } },
      { tool: 'propose_task', args: { title: 'Rancangan ERD kelompok', due_date: d(15), course_name: course, weight_pct: 10 } },
      { tool: 'propose_exam', args: { course_name: course, kind: 'uts', date: d(21), time: '08:00' } },
      { tool: 'propose_learning_module', args: { title: course, unit_count: 14, category: 'kuliah' }, selected: false },
    ];
  }
  return [
    { tool: 'propose_task', args: { title: 'Mockup sistem (kelompok)', due_date: d(7), course_name: course, weight_pct: 15 } },
    { tool: 'propose_exam', args: { course_name: course, kind: 'kuis', date: d(10), time: '10:00' } },
    { tool: 'propose_task', args: { title: 'Usability test 5 responden', due_date: d(35), course_name: course, weight_pct: 20 } },
  ];
}
