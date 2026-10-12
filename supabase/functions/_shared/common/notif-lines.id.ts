// Kalimat badan notifikasi (tanpa nominal/data sensitif).
export const NOTIF_BODY: Record<string, string[]> = {
  routine: ['Pohonmu nunggu disiram. Cuma butuh sebentar.', 'Satu centang lagi buat pohonmu.'],
  module: ['Waktunya belajar 25 menit. Aku jagain timernya.', 'Sesi singkat dulu yuk, pohonmu senang.'],
  task: ['Tenggatnya sebentar lagi. Yuk dicicil.'],
  class: ['Kelas mulai 30 menit lagi.'],
  exam: ['Ujian makin dekat. Cicil materinya ya.'],
  expense_nudge: ['Ada pengeluaran hari ini yang belum dicatat?'],
  budget: ['Anggaran bulan ini hampir habis. Cek dulu yuk.'],
  budget100: ['Anggaran bulan ini sudah habis. Cek dulu yuk.'],
  recurring: ['Ada transaksi berulang yang perlu dikonfirmasi.'],
  weekly_review: ['Review mingguanmu siap. Lihat sebentar?'],
  goal: ['Hari ini jadwal setor ke target tabungan.'],
  backup: ['Sudah 14 hari sejak backup terakhir. Export dulu yuk.'],
  valuation: ['Waktunya perbarui nilai investasi bulan ini.'],
  morning_brief: ['Selamat pagi! Ringkasan harimu sudah siap.'],
  test: ['Pohonmu nunggu disiram. Cuma butuh sebentar.'],
};

export const NOTIF_ACTIONS: Record<string, { action: string; title: string }[]> = {
  routine: [{ action: 'done', title: 'Tandai selesai' }, { action: 'snooze10', title: 'Tunda 10 mnt' }],
  test: [{ action: 'done', title: 'Tandai selesai' }, { action: 'snooze10', title: 'Tunda 10 mnt' }],
  module: [{ action: 'start', title: 'Mulai sekarang' }, { action: 'snooze10', title: 'Tunda 10 mnt' }],
  task: [{ action: 'done', title: 'Selesai' }, { action: 'snooze60', title: 'Tunda 1 jam' }],
  class: [{ action: 'attend', title: 'Tandai hadir' }],
  expense_nudge: [{ action: 'log', title: 'Catat' }],
};

export function notifBody(kind: string, seed = 0): string {
  const arr = NOTIF_BODY[kind] ?? NOTIF_BODY.test;
  return arr[Math.abs(seed) % arr.length];
}
