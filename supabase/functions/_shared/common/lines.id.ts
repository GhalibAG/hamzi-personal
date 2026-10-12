// Bank kalimat Hamzi (DESIGN-SYSTEM §6.4). Maks 80 karakter, ramah, tidak menghakimi.
export type Mood = 'calm' | 'happy' | 'excited' | 'focus' | 'worried' | 'sleepy' | 'sleeping' | 'celebrate';

export const LINES: Record<string, string[]> = {
  pagi: ['Selamat pagi! Mulai dari yang kecil ya.', 'Pagi! Satu langkah kecil dulu, sisanya nyusul.', 'Hari baru, pohon baru tumbuh. Semangat!'],
  siang: ['Siang! Sudah minum air belum?', 'Istirahat sebentar boleh, terus lanjut lagi.'],
  sore: ['Sore! Cek lagi apa yang masih tersisa hari ini.', 'Sore-sore enaknya nyicil satu tugas.'],
  malam: ['Malam! Catat pengeluaran hari ini dulu yuk.', 'Tutup hari dengan satu centang lagi?'],
  calm_summary: ['Hari ini {tasks} tugas & {classes} kelas. Mulai dari yang kecil ya!'],
  happy: ['Satu tugas sudah beres. Mantap!', 'Mantap, satu beres!', 'Kerja bagus, terus begitu.', 'Centang lagi! Kamu konsisten banget.'],
  all_required: ['Semua rutinitas wajib beres. Pohonmu berbunga!', 'Rutinitas hari ini lengkap. Keren!'],
  excited: ['Streak {n} hari! Kamu keren.', 'Naik level! Hamzi bangga.'],
  focus: ['Fokus dulu ya, aku jagain waktunya.', 'Satu hal dulu. Aku tunggu di sini.'],
  worried_task: ['{task} tenggatnya besok, mau dicicil?', 'Tenggatnya dekat nih, mau dipecah kecil?'],
  worried_budget: ['Anggaran sudah {pct}%. Pelan-pelan dulu jajannya ya.'],
  sleepy: ['Jangan begadang ya, catat yang penting saja.', 'Sudah malam. Sisanya besok.'],
  sleeping: ['Zzz… aku nunggu kamu balik.', 'Selamat datang kembali, mulai dari yang kecil saja.'],
  celebrate: ['Target {pct}% tercapai!', 'Pohonmu naik jadi {stage}!'],
  first_expense: ['Pengeluaran pertama hari ini tercatat. Rapi!'],
  no_expense: ['Belum ada pengeluaran hari ini. Hemat!'],
  study_done: ['Kerja bagus! Pohonmu dapat 1 tetes air.'],
  tap: ['Meong!', 'Hehe, geli.', 'Ada yang bisa dibantu?', 'Aku di sini kok.', 'Minum air dulu yuk.', 'Kamu hebat hari ini.'],
  exam: ['Ujian {course} tinggal {n} hari. Yuk cicil materinya.'],
  empty_tasks: ['Belum ada tugas hari ini. Mau tambah satu?'],
  empty_routines: ['Tambah rutinitas pertamamu. Pohonmu mulai dari biji kecil.'],
};

export function fillLine(t: string, vars: Record<string, string | number> = {}): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : ''));
}

/** Pilih kalimat acak (deterministik bila seed diberikan). */
export function pickLine(key: string, vars: Record<string, string | number> = {}, seed?: number): string {
  const arr = LINES[key] ?? LINES.tap;
  const i = seed === undefined ? Math.floor(Math.random() * arr.length) : Math.abs(seed) % arr.length;
  return fillLine(arr[i], vars);
}

export function partOfDay(minutesWib: number): 'pagi' | 'siang' | 'sore' | 'malam' {
  if (minutesWib >= 4 * 60 && minutesWib < 10 * 60) return 'pagi';
  if (minutesWib >= 10 * 60 && minutesWib < 15 * 60) return 'siang';
  if (minutesWib >= 15 * 60 && minutesWib < 18 * 60) return 'sore';
  return 'malam';
}
