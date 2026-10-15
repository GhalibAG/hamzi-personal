# HANDOFF — Status Hamzi & cara melanjutkan di Antigravity

Dokumen ini untuk kamu (Iqbal) dan coding agent berikutnya. Isinya: apa yang sudah jadi, bukti pengecekannya, apa yang **belum bisa dibuktikan** tanpa deploy, celah yang diketahui, dan sesi lanjutan kecil yang siap ditempel ke Antigravity.

## 1. Yang sudah jadi
Semua layar dan alur di PRD P0/P1 sudah dibangun dan berjalan di **mode demo** (tanpa server), HP 390×844 dan desktop 1440×900/1280×800:

| Area | Isi |
|---|---|
| Kerangka | Navigasi bawah (HP), sidebar + panel Chat kanan (desktop ≥1024), FAB + menu, sheet ↔ dialog otomatis, toast Urungkan, pintasan N/E/T/R/"/"/C/Esc, mode Minimal, sembunyikan nominal, mode gelap (turunan), banner offline + indikator sinkron |
| Beranda | Header hijau + Hamzi + mesin mood, kartu pengeluaran, grid layanan, kelas berikutnya, tugas teratas, target & streak, Kata Hamzi (AI/templat) |
| Rencana | Hari ini / Minggu ini / Proyek, terlambat + Tunda, kebiasaan, form tugas (berulang, pengingat, subtugas), detail proyek & milestone, kalender bulan + event, pencarian global |
| Kuliah | Kartu IPK/proyeksi, jadwal + tandai hadir + catatan, kehadiran per matkul, tugas kuliah, simulasi IPS + "jadikan nilai resmi", kelola semester/matkul/jadwal, detail matkul, komponen nilai, ujian |
| Keuangan | Saldo & anggaran, catat cepat (keypad HP / ketik desktop), riwayat + filter + CSV, anggaran per kategori, dompet + transfer + koreksi, transaksi berulang, **laporan** (donut, tren, perbandingan), target + setor/tarik + **proyeksi 3 skenario**, investasi + valuasi manual |
| Tumbuh | Pohon 6 tahap + tetes air, rutinitas wajib & kebiasaan, belajar mandiri (modul → unit, templat), timer fokus berbasis timestamp (layar penuh HP / dialog desktop), kalender kebun, pengingat + uji, detail modul & rutinitas (heatmap 12 minggu) |
| Chat Hamzi | Percakapan, lampiran + dialog privasi, kartu usulan (centang, simpan, urungkan 24 jam), review mingguan `/chat?review=minggu`, share target, riwayat AI + izin data |
| Pengingat | Server: Worker tiap menit → `scheduler-tick` → Web Push + aksi notifikasi (HMAC). App: `ReminderEngine` (banner dalam app/notifikasi lokal; di mode demo menggantikan server saat app terbuka), kotak `/notifikasi` |
| Pengaturan | Profil, tampilan, notifikasi (izin, langganan, panduan baterai, jenis pengingat sistem, jam tenang), akademik, keuangan, tumbuh, privasi AI, data (export JSON/CSV, impor, reset demo), diagnostik, keluar, hapus akun |
| Catatan | Catatan pribadi bebas ("catatan hidup"): daftar `/catatan` & editor `/catatan/baru` + `/catatan/:id` (HP & desktop), disematkan, pencarian lokal case-insensitive, kelompok per bulan, pratinjau 2 baris, validasi Zod + deteksi data sensitif, soft delete dengan toast Urungkan, tautan masuk di Rencana, dan integrasi pencarian global |
| Masuk & Onboarding | Google / magic link (Supabase), onboarding 6 langkah (saran rutinitas, anggaran, pasang PWA, aktifkan pengingat, panduan baterai) |
| Backend | Migrasi 0001–0012 (RLS semua tabel, RPC atomik, RPC baca, penjadwal, chat & storage, notes), 6 Edge Functions, Worker cron, CI (typecheck, lint, test, test SQL, build, e2e, deno check, scan rahasia), keepalive |
| Offline (mode Supabase) | Cache baca di IndexedDB, outbox tulis (FIFO, idempoten), sinkron otomatis saat online |

## 2. Bukti pengecekan (jalankan ulang kapan saja)
```
npm run typecheck   → 0 error
npm run lint        → 0 masalah
npm test            → 157/157 lulus (36 test vector §13 + chat, pengingat, outbox, mood, IPK matkul diulang, data)
npm run test:sql    → 45/45 lulus (migrasi, RPC, RLS dua pengguna, notifikasi, cascade hapus akun)
npm run e2e         → 9/9 lulus (HP + desktop)
npm run visual      → 30 layar dibandingkan dengan screenshot prototipe (selisih piksel HP 0,2–11%, desktop 1,5–5%;
                      selisih besar = isi data berbeda, mis. percakapan chat contoh), lihat tests/visual/out/compare-*.png
npm run build       → JS awal ±175 KB gzip untuk Beranda (batas 250 KB)
deno check (Edge)   → bersih (Deno 2)
```

## 3. Belum bisa dibuktikan tanpa deploy (lakukan setelah `docs/DEPLOY.md`)
- [ ] Login Google & magic link sungguhan; matikan sign-up publik (AUTH-01/02).
- [ ] Push sungguhan di Android terpasang, app tertutup, 3 hari (NOT-01, checklist A#9) + tombol "Tandai selesai"/"Tunda" dari notifikasi (NOT-04).
- [ ] `scheduler-tick` jalan tiap menit 7 hari tanpa jeda (Worker + keepalive).
- [ ] Chat dengan Gemini sungguhan: rangkum PDF RPS (CHAT-02), "pecah proyek" (PROJ-04/CHAT-11), impor jadwal dari foto KRS (KUL-11), kuota habis → pesan ramah (CHAT-10). Di mode demo, AI diganti parser perintah sederhana.
- [ ] Kata Hamzi dari Gemini (AI-01) + grounding angka di server.
- [ ] Bagikan file dari WhatsApp ke Hamzi (CHAT-07) — butuh PWA terpasang.
- [ ] Lighthouse ≥ 90 (Perf/A11y/PWA) di HP menengah; uji font 130%; audit axe.
- [ ] Export → impor ulang di akun Supabase sungguhan (SET-04).

## 4. Celah yang diketahui (kecil)
1. Chat: belum bisa mengubah item kartu usulan lewat sheet sebelum simpan (P1); penerapan usulan = beberapa insert (bukan satu RPC), dengan pembersihan bila gagal.
2. Sesi belajar belum bisa diubah/dihapus; sesi berjalan tidak bisa dibatalkan tanpa tercatat (minimal 1 menit).
3. Hapus memakai tombol (belum gestur geser); kalender belum bisa digeser antarbulan; proyek belum punya pemilih warna (warna = jenis).
4. Review mingguan tampil dua kali di Riwayat AI (log ringkasan + pesan chat).
5. Mode gelap memakai palet turunan (prototipe hanya mode terang) — tinjau sekali di HP.
6. `repo.list()` mode Supabase memuat seluruh tabel (aman untuk satu pengguna; bila data > 1 tahun, batasi rentang tanggal untuk `transactions`, `routine_logs`, `study_sessions`, `xp_events`).
7. Di HP, layar Chat menutupi banner offline global (Chat menampilkan pesan offline sendiri).
8. P2 belum dibuat: TASK-11 (Eisenhower), CAL-04 (.ics), KUL-10 (mode ujian), BEL-10 (spaced repetition), MAS-06 (aksesori), AUTH-05 (PIN), GOAL-08, TUM-06.

## 5. Keputusan yang menyimpang/menambah dokumen (sudah diterapkan)
- **Stack**: tanpa Radix, `motion`, Recharts, react-hook-form — komponen (Sheet/Dialog, Switch, Menu) dibuat sendiri dengan aksesibilitas dasar, grafik = SVG ringan, form = state React + zod. Alasan: bundle kecil (±175 KB gzip awal). Tambahan: `idb-keyval` (outbox/cache), `workbox-*`, `@electric-sql/pglite` (dev, test SQL).
- **Angka turunan dihitung di klien** dari tabel (`src/features/*/derive.ts` + `@common/calc`) untuk mode demo & Supabase; RPC baca SQL (`rpc_home`, `rpc_gpa_summary`, …) tetap ada dan dipakai Edge/AI. Keduanya diuji dengan vektor yang sama.
- **Bunga pohon** = level 3 **dan** belajar ≥ 10 menit (PRD §7.12, vektor #24/#34).
- **Matkul diulang** → nilai terbaru menggantikan (PRD §7.1) diterapkan di `latestAttempts` (TS) dan `rpc_gpa_summary` (SQL), dengan test.
- `rpc_study_finish` punya parameter opsional `p_source` (`timer`/`manual`) untuk sesi manual.
- Kunci dedupe notifikasi server untuk rutinitas/modul/kelas diberi akhiran jam (HHMM) agar perubahan jam pengingat di hari yang sama tetap terkirim; kolom tambahan `scheduled_notifications.ref_day/claimed_until`, `ai_requests.calls/calls_day`.
- Hak akses lebih ketat dari spec: klien hanya boleh mengubah `read_at` notifikasi; `water_events`/`xp_events`/`user_stats` hanya baca (diisi RPC/trigger).
- `line-height: normal` global (sama dengan prototipe); paragraf panjang memakai leading eksplisit.
- Persen kategori di kartu anggaran = porsi dari total pengeluaran siklus; kehadiran di kartu IPK = rata-rata persen per matkul (PRD §7.3).

## 6. Sesi lanjutan (tempel satu per satu ke Antigravity)
Templat (sama seperti BUILD-PLAN §3):
```
Baca AGENTS.md, docs/FRONTEND-GUIDE.md, docs/HANDOFF.md. Kerjakan HANYA sesi berikut: <isi>.
Sebutkan file yang akan disentuh dulu. Setelah selesai jalankan: npm run typecheck && npm run lint && npm test
(+ npm run e2e / npm run visual bila menyentuh UI) dan tempel outputnya. Jangan ubah docs/prototype.
```
| # | Sesi | Catatan |
|---|---|---|
| S1 | Deploy produksi mengikuti `docs/DEPLOY.md` (kamu yang mengisi secret) | lalu centang item §3 satu per satu |
| S2 | Kartu usulan Chat: ketuk judul item → sheet ubah (pakai TaskFormSheet/RoutineFormSheet dengan `initial`) sebelum simpan | UI-SPEC §7 |
| S3 | Sesi belajar: ubah/hapus sesi di detail modul + tombol "Batalkan sesi" di timer (tanpa mencatat) | hapus = hapus water/xp terkait lewat RPC baru `rpc_study_delete` (migrasi 0012) |
| S4 | Batasi `repo.list()` Supabase untuk tabel besar ke 400 hari terakhir | `src/data/supabase.ts` |
| S5 | Gestur geser untuk hapus transaksi/tugas + geser bulan di kalender | tetap sediakan tombol (aksesibilitas) |
| S6 | Lighthouse + axe: perbaiki temuan, uji font 130% | NFR-01/06 |
| S7 | P2 pilihan: mode ujian H-7 (KUL-10) atau ekspor .ics (CAL-04) | tambah ke PRD/checklist dulu |
