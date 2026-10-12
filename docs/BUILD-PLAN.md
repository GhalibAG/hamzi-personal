# BUILD-PLAN — Hamzi: Plan Tracker Pribadi

Panduan membangun Hamzi bertahap bersama coding agent di **Antigravity** (model Gemini Flash). Pendamping `PRD.md` (apa), `TECH-SPEC.md` (bagaimana), `DESIGN-SYSTEM.md` + `UI-SPEC.md` + `prototype/` (tampilan), `FEATURE-CHECKLIST.md` (bukti lengkap), `AGENTS.md` (aturan agent).

**Prinsip untuk model cepat (Flash):**
1. **Satu sesi = satu tugas kecil** (≤ ±10 file). Setiap milestone dipecah menjadi beberapa sesi bernomor; jangan menempel satu prompt raksasa.
2. **Selalu tunjuk sumber**: ID PRD + bagian UI-SPEC + file prototipe + nomor screenshot.
3. **Bukti, bukan klaim**: setiap sesi diakhiri dengan perintah yang dijalankan (`typecheck`, `lint`, `test`, `e2e`/`visual`) dan hasilnya ditempel.
4. **Tampilan dicocokkan dengan screenshot** prototipe, bukan dengan selera agent.
5. Centang item di `FEATURE-CHECKLIST.md` hanya setelah bukti ada.

---

## 0. Setup (sekali)

1. Repo GitHub **privat** `hamzi`; clone, buka di Antigravity.
2. Salin paket ini:
   ```
   hamzi/
   ├─ AGENTS.md
   ├─ docs/
   │  ├─ PRD.md  TECH-SPEC.md  DESIGN-SYSTEM.md  UI-SPEC.md  FEATURE-CHECKLIST.md  BUILD-PLAN.md
   │  └─ prototype/   (semua file .dc.html, support.js, fonts/, screens/, README.md)
   └─ .agents/rules/hamzi.md
   ```
3. Isi `.agents/rules/hamzi.md` (rule workspace Antigravity; maks 12.000 karakter, mendukung `@file`) **[verifikasi lokasi rules di versi Antigravity-mu; bila tidak terbaca, tambahkan lewat panel Rules]**:
   ```
   Ikuti aturan di @../../AGENTS.md.
   Sumber: @../../docs/PRD.md @../../docs/TECH-SPEC.md @../../docs/DESIGN-SYSTEM.md
   @../../docs/UI-SPEC.md @../../docs/FEATURE-CHECKLIST.md @../../docs/BUILD-PLAN.md
   Tampilan WAJIB sama dengan docs/prototype/ (lihat screenshot di docs/prototype/screens/).
   ```
4. Cek prototipe bisa dibuka: `npx serve docs/prototype` → buka `http://localhost:3000/Main.dc.html` (mode perangkat 390×844). Ini acuan saat review.

---

## 1. Prasyarat Akun (dikerjakan **kamu**, bukan agent)

| # | Langkah | Hasil | Disimpan di |
|---|---|---|---|
| 1 | Buat project Supabase (free), region terdekat (Singapura) | URL + anon key | `.env.local` |
| 2 | Auth: aktifkan Google (OAuth client di Google Cloud) atau cukup magic link | Bisa login | Dashboard |
| 3 | Setelah akunmu terbuat: **matikan sign-up publik** | Hanya kamu | Dashboard |
| 4 | API key Gemini (Google AI Studio). Pilih model Flash terbaru yang mendukung function calling + PDF; isi `GEMINI_MODEL` | `GEMINI_API_KEY` | Secret Edge Function |
| 5 | (Opsional) API key Groq + `GROQ_MODEL` (yang mendukung tool calling) | `GROQ_API_KEY` | Secret Edge Function |
| 6 | VAPID: `npx web-push generate-vapid-keys` | public & private | public → `.env.local` + secret; private → secret |
| 7 | Buat 2 string acak panjang: `CRON_SECRET`, `NOTIF_ACTION_SECRET` (`openssl rand -hex 32`) | rahasia | Secret Edge Function (+ CRON_SECRET di Worker) |
| 8 | Akun Cloudflare: Pages (hubungkan repo) + Workers (untuk penjadwal) | `*.pages.dev`, Worker | Dashboard |
| 9 | Supabase CLI + `wrangler` terpasang & login | CLI | Lokal |
| 10 | GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY` (untuk keepalive) | | Repo settings |

**Jangan pernah menempel kunci ke chat agent.** Sebut nama variabelnya saja.

---

## 2. Prompt Kickoff (sekali, sebelum M0)
```
Baca AGENTS.md lalu semua file di docs/ (PRD, TECH-SPEC, DESIGN-SYSTEM, UI-SPEC, FEATURE-CHECKLIST, BUILD-PLAN)
dan lihat gambar di docs/prototype/screens/.
Jangan menulis kode. Berikan:
1) Ringkasan produk 10 baris.
2) Daftar ambigu/bertentangan antar dokumen + rekomendasimu.
3) Rencana M0 sesi 1 (file yang dibuat).
Tunggu persetujuanku.
```

---

## 3. Templat Prompt Sesi (pakai untuk setiap sesi di bawah)
```
Kerjakan {Milestone} sesi {N}: {judul sesi}.
Cakupan: {ID PRD}. Acuan: UI-SPEC §{x}, prototipe docs/prototype/{File}.dc.html, screenshot {nn}.
Aturan: ikuti AGENTS.md. Jangan mengerjakan di luar cakupan sesi ini.
Langkah: (1) tulis rencana singkat: file yang dibuat/diubah; (2) kerjakan; (3) jalankan
npm run typecheck && npm run lint && npm run test {&& npm run visual bila ada UI};
(4) tempel output perintah; (5) sebutkan item FEATURE-CHECKLIST yang kini terbukti.
```

---

## 4. Milestone & Sesi

### M0 — Fondasi
| Sesi | Isi | Selesai bila |
|---|---|---|
| M0.1 | Vite + React + TS strict, ESLint, Prettier, Vitest, Playwright; skrip `dev/build/typecheck/lint/test/e2e/visual` | perintah jalan |
| M0.2 | Tailwind + `src/styles/tokens.css` (DESIGN-SYSTEM §2.1 **persis**) + font `@fontsource/plus-jakarta-sans` | token tersedia sebagai kelas/var |
| M0.3 | Router (rute DESIGN-SYSTEM §9, halaman kosong), AppShell + BottomNav (5 tab, ikon dari §8) | nav sama dengan prototipe |
| M0.4 | Supabase klien, Auth (Google/magic link), guard rute, `/masuk` | login jalan |
| M0.5 | Migrasi `0001_init`, `0002_rls` (TECH-SPEC §5.0–5.4: tabel, trigger WIB & `updated_at`, `handle_new_user`, RLS, indeks). **Semua migrasi berikutnya mengikuti tabel §5.0.** | `supabase db reset` sukses; skrip uji RLS dua akun lulus |
| M0.6 | PWA (`vite-plugin-pwa` injectManifest), manifest TECH-SPEC §10, ikon placeholder, `sw.ts` dasar, banner pasang | Lighthouse "installable" |
| M0.7 | CI (`ci.yml`), `_headers` CSP, `.env.example`, deploy Cloudflare Pages | URL `*.pages.dev` hidup |
| M0.8 | **Alat visual**: salin `docs/prototype` ke `tests/visual/prototype`; skrip `npm run visual` (Playwright) yang memotret rute app di 390×844 ke `tests/visual/out/` dan membuat gambar berdampingan `compare-NN.png` (kiri prototipe, kanan app) + skor `pixelmatch` (peringatan bila > 5%, bukan gagal). Viewport per layar dapat diatur (Maskot 1120×640); area yang memang tambahan di luar prototipe (mis. FAB Kuliah) boleh di-mask | `compare-*.png` dihasilkan |

Cek manual: login di HP, pasang ke layar utama, buka dari ikon (layar penuh), akun lain ditolak.

### M1 — UI Kit & Layar Statis (mock)
Tujuan: **semua layar terlihat dan bisa diklik persis seperti prototipe**, memakai data contoh di `src/lib/mock/<layar>.ts` (satu file mock per layar, salin angka & teks dari `<script data-dc-script>` prototipe layar itu).

| Sesi | Isi | Acuan |
|---|---|---|
| M1.1 | Komponen dasar: Button, IconButton, Card, Chip, Segmented, Tag, ProgressBar, Ring, Switch, Toast, Sheet, Fab, SpeedDial, Keypad, WeekStrip, Amount | DESIGN-SYSTEM §5 |
| M1.2 | `Mascot.tsx` port 1:1 dari `Hamzi.dc.html` (8 mood, mirror, still) + halaman dev `/dev/maskot` meniru `Maskot.dc.html` | screenshot 21, 22 |
| M1.3 | `Tree.tsx` (6 tahap) + `GardenDay.tsx` + halaman dev `/dev/pohon` | DESIGN-SYSTEM §6.7 |
| M1.4 | Beranda (mock) termasuk menu FAB & toggle sembunyikan nominal | UI-SPEC §1, `Main`, 01–03 |
| M1.5 | Rencana (mock) 3 tab, centang + toast Urungkan, kebiasaan | UI-SPEC §3, `Rencana`, 04–06 |
| M1.6 | Kuliah (mock) 3 tab + simulasi nilai (pakai `common/calc` gpa — tulis test #1, #21, #22, #36 sekarang) | UI-SPEC §4, `Kuliah`, 07–08 |
| M1.7 | Keuangan (mock) + sheet catat cepat (keypad berfungsi) | UI-SPEC §5, `Keuangan`, 09–11 |
| M1.8 | Tumbuh (mock): kartu pohon, 3 tab, sheet rutinitas/modul, timer (berbasis timestamp) | UI-SPEC §6, `Belajar`, 12–17 |
| M1.9 | Chat (mock): gelembung, kartu aksi dengan checkbox/simpan/urungkan, lampiran tiruan, chip | UI-SPEC §7, `Chat`, 18–20 |
| M1.10 | **Kerangka desktop**: `useMediaQuery`, AppShell responsif (BottomNav ↔ `Sidebar`), `Sheet` ↔ `Dialog`, panel `ChatPanel` kanan (toggle, ingat status), pintasan keyboard | DESIGN-SYSTEM §11, `DeskSidebar`, `DeskChat`, d01–d02 |
| M1.11 | Susunan desktop per halaman (Beranda, Rencana, Kuliah, Keuangan + dialog catat ketik, Tumbuh + dialog timer) memakai komponen yang sama | `Desktop-*.dc.html`, d01–d09 |
| M1.12 | `npm run visual` untuk 01–20 (390×844) dan d01–d09 (1440×900, 1280×800); perbaiki selisih | semua `compare-*.png` |

Prompt tambahan M1: *"Salin struktur, urutan, teks, ukuran, dan warna dari file prototipe; ubah style inline menjadi kelas Tailwind/token. Jangan mendesain ulang."*
DoD M1: kamu membuka app & prototipe berdampingan di HP/DevTools **dan di laptop (≥ 1280 px)** dan tidak menemukan perbedaan berarti; semua `compare-*.png` ditinjau.

**Aturan untuk semua milestone berikutnya:** setiap fitur baru wajib dicek di dua ukuran (390×844 dan 1440×900) sebelum sesi dinyatakan selesai.

### M2 — Rencana (data nyata)
| Sesi | Isi |
|---|---|
| M2.1 | `lib/date` (WIB), `common/calc/priority` (#17), `features/tasks/api` + zod; migrasi `0003_tasks` (`fn_task_set_done_for`/`rpc_task_set_done`, instance berulang) |
| M2.2 | Rencana > Hari ini/Minggu ini dari data; Terlambat + Tunda; sheet Tugas baru; detail tugas + subtugas |
| M2.3 | Proyek + milestone + detail proyek |
| M2.4 | Kalender bulan `/rencana/kalender` + sheet Event baru (CAL-03) |
| M2.5 | Migrasi `0004_home`; Beranda "Hari ini" & "Lihat semua" dari data (`rpc_home` bagian tugas & kelas) |
| M2.6 | Pengulangan tugas (TASK-09) di sheet/detail tugas; kerangka `/pengaturan` + `/pengaturan/profil` + `/pengaturan/tampilan` (tema, mode Minimal, sembunyikan nominal, mata Hamzi A/B) |
Test: #17, e2e "buat tugas → muncul di Hari ini → centang → toast → Urungkan".

### M3 — Tumbuh (rutinitas, belajar, pohon)
| Sesi | Isi |
|---|---|
| M3.1 | Migrasi `0005_growth` bagian tulis: `fn_level_from_xp` + trigger `user_stats`, `fn_routine_set_for`/`rpc_routine_set`, `fn_study_finish_for`/`rpc_study_finish`, `rpc_unit_set_status` (tabelnya sudah ada di 0001) + test #15, #16, #33 |
| M3.2 | `common/calc/growth`: `treeStage`, `gardenLevel`, `streak`, `waterForStudyDay`, `isRoutineDue` (+ test #19, #23–25, #28, #34) dan versi SQL setara di `0005_growth` (`fn_tree_stage`, `fn_garden_level`, `fn_streak`, `rpc_growth_overview`, `rpc_garden_month`, `rpc_learning_overview`) |
| M3.3 | Rutinitas: sheet tambah, daftar wajib/kebiasaan lain, centang/jumlah, detail `/tumbuh/rutinitas/:id`; Rencana > Kebiasaan memakai data sama |
| M3.4 | Modul & unit: sheet tambah (N unit), detail modul, ModuleRow |
| M3.5 | Timer `/tumbuh/sesi` (timestamp + IndexedDB, chip timer mini), selesai → `rpc_study_finish` → tanya unit selesai |
| M3.6 | Kartu pohon + chip "+1 tetes air" + bunga; tab Kalender (bulan, navigasi, detail hari); streak di header & Beranda; XP/level di Beranda |
| M3.7 | BEL-07 statistik mingguan, BEL-08 catat sesi manual, BEL-09 templat modul ("Pakai templat"); `/pengaturan/tumbuh` ("Tugas juga menyiram pohon") |
Test: vektor di atas; e2e "centang 4 rutinitas wajib → bunga muncul, streak +1"; "timer 10 menit (jam dipalsukan) → +1 tetes".

### M4 — Pengingat
| Sesi | Isi |
|---|---|
| M4.1 | Berlangganan push (`push_subscriptions`), Pengaturan > Notifikasi (status izin, Aktifkan, panduan baterai), langkah onboarding 5–6 |
| M4.2 | Migrasi `0006_scheduler`: `job_runs`, `fn_enqueue_notifications` (dengan `dedupe_key`), `fn_dispatch_candidates`, `fn_mark_notification`, `fn_attendance_mark_for`, `rpc_ping`; Edge `scheduler-tick` (enqueue + dispatch + harian) dengan `_shared/push.ts`, `_shared/hmac.ts`; `common/notif-lines.id.ts` |
| M4.3 | Worker `workers/scheduler` (cron tiap menit) + `keepalive.yml` (memanggil `rpc_ping` dari `0006_scheduler`); dokumentasi deploy |
| M4.4 | `sw.ts`: push dengan aksi, `notificationclick` → `notif-action`; Edge `notif-action` (done/snooze/attend) |
| M4.5 | Tab Pengingat (daftar + switch), Edge `push-test` + tombol "Coba pengingat"; `/notifikasi` (kotak notifikasi, tandai dibaca) |
| M4.6 | Pengingat sistem (kelas, ujian, catat pengeluaran 21:00, review mingguan, backup) + jam tenang + batas 6/hari |
Test: #28, #29; unit HMAC (token kedaluwarsa ditolak); e2e SW dengan push tiruan.
**Cek manual wajib (3 hari):** buat rutinitas jam +3 menit → kunci HP → notifikasi tiba ±1 menit → tekan "Tandai selesai" → buka app: rutinitas tercentang & +1 tetes. Ulangi dengan app ditutup dari recent apps. Catat hasil di FEATURE-CHECKLIST.

### M5 — Keuangan
| Sesi | Isi |
|---|---|
| M5.1 | `lib/format` rupiah, `lib/sensitive` (#18), `common/calc/budget` (#7–9, #26, #27, #35); migrasi `0007_finance` (`v_wallet_balance` dengan `direction`, `rpc_finance_daily`, `rpc_finance_period`, trigger XP transaksi, `fn_run_recurring`, `rpc_home` bagian keuangan) |
| M5.2 | Sheet catat cepat nyata (optimistic), toast sisa aman, shortcut `?quick=expense` |
| M5.3 | Layar Keuangan: kartu saldo, anggaran (+ `/keuangan/anggaran`), hari ini, riwayat `/keuangan/transaksi` (cari/filter/edit/hapus + Urungkan) |
| M5.4 | Dompet + transfer + koreksi saldo (FIN-13); export CSV; Beranda kartu pengeluaran & mode sembunyikan nominal dari data |
| M5.5 | Onboarding langkah 1–4 (nama, awal siklus, dompet awal, anggaran total) + pilihan saran rutinitas (TECH-SPEC §15) |
| M5.6 | Transaksi berulang (FIN-09, konfirmasi lewat notifikasi), laporan mingguan/bulanan + donut (FIN-12, Recharts lazy), `/pengaturan/keuangan` (awal siklus, kategori CRUD) |

### M6 — Kuliah
| Sesi | Isi |
|---|---|
| M6.1 | `common/calc/grade`, `gpa`, `attendance` (#1–6, #21, #22, #30); migrasi `0008_courses` (`rpc_attendance_mark`, `rpc_gpa_summary`); skala dari pengaturan |
| M6.2 | Semester & matkul & jadwal (`/kuliah/semester`, form multi-jadwal) |
| M6.3 | Tab Jadwal (timeline, Tandai hadir, Catatan, kehadiran per matkul, banner ujian) + `rpc_attendance_mark` |
| M6.4 | Tab Tugas kuliah, ujian (CRUD + pengingat H-3/H-1), tab Nilai (simulasi `sim_grade`, jadikan resmi), kartu IPK dari data |
| M6.5 | `/pengaturan/akademik` (skala nilai, total SKS kurikulum, target IPK), FAB Kuliah |

### M7 — Target & Investasi
| Sesi | Isi |
|---|---|
| M7.1 | `common/calc/goal`, `investment` (#10–14); migrasi `0009_goals` (RPC overview + trigger XP target); target + setoran/penarikan + detail |
| M7.2 | Carousel Keuangan & kartu Beranda dari data; perayaan 25/50/75/100% |
| M7.3 | Investasi manual (aset, transaksi, valuasi, P/L, disclaimer) |

### M8 — Maskot hidup & Offline
| Sesi | Isi |
|---|---|
| M8.1 | `useMoodEngine` (DESIGN-SYSTEM §6.4) + `lines.id.ts` ≥ 40 baris + reaksi ketuk Hamzi + mode Minimal |
| M8.2 | Persister TanStack Query + outbox (transaksi, tugas, `rpc_routine_set`, `rpc_study_finish`, setoran) + indikator sinkron |
Cek manual: mode pesawat → catat transaksi + centang rutinitas → online → tersinkron tanpa duplikat.

### M9 — AI & Chat Hamzi
| Sesi | Isi |
|---|---|
| M9.1 | `_shared/llm.ts` (Gemini & Groq, `generateJson` + `chat`), provider tiruan untuk test, `_shared/redact.ts` |
| M9.2 | Migrasi `0010_ai` (`rpc_week_summary` + RPC baca yang belum ada) + sanitasi `ai_share` |
| M9.3 | `ai-generate` (daily_summary, weekly_review) + templat lokal + grounding (#20) + kartu Kata Hamzi + alur `/chat?review=minggu` (simpan sebagai pesan Hamzi) |
| M9.4 | Migrasi `0011_chat` + Storage bucket; `_shared/tools.ts` (deklarasi alat §7.8.2–7.8.3 + zod di `common/schemas.ts`) + `common/proposal-format.ts` (#32) |
| M9.5 | `ai-chat` (loop alat, usulan, `ai_actions`, kuota) dengan test provider tiruan |
| M9.6 | UI Chat nyata: unggah file, kartu aksi → penerapan lewat `features/*/api` (#31, #32), Urungkan, dialog privasi, kuota habis |
| M9.7 | Share target (`sw.ts` + `/chat?shared=1`), Riwayat AI `/chat/riwayat`, pengaturan Privasi AI |
Cek manual: kirim PDF RPS asli → usulan masuk akal → simpan sebagian → Urungkan; perintah "tambahin rutinitas minum air 8 gelas jam 9 pagi" → muncul di Tumbuh & Pengingat; bagikan PDF dari WhatsApp → terbuka di chat.

### M10 — Poles, Rilis, & P2 terpilih
| Sesi | Isi |
|---|---|
| M10.1 | Performa (code split, ≤ 250 KB), a11y (axe), mode gelap, font 130% |
| M10.2 | Export/impor JSON, pengingat backup, Diagnostik, pencarian global, shortcuts, hapus akun |
| M10.3 | Poles desktop: tablet 768–1023, hover/fokus, seret-lepas file ke panel chat, uji 1920 px |
| M10.4 | P2 pilihan: Mode ujian (KUL-10), koleksi pohon (TUM-06), PIN (AUTH-05) |
| M10.5 | Uji pakai 14 hari + perbaikan; semua P0/P1 di FEATURE-CHECKLIST tercentang |

---

## 5. Tips Bekerja dengan Gemini Flash di Antigravity
- Mulai sesi baru (percakapan baru) per sesi agar konteks bersih; selalu sertakan templat §3.
- Bila hasil UI melenceng: lampirkan screenshot prototipe + screenshot app, minta "samakan bagian X persis".
- Bila agent mengubah rumus/skema/aturan privasi: hentikan; minta perbarui PRD/TECH-SPEC + test vector dulu.
- Tinjau diff migrasi SQL, RLS, Edge Function sebelum menerima.
- Terapkan migrasi produksi manual (`supabase db push`) setelah export backup.
- Jangan biarkan agent memakai MCP untuk mengubah database produksi tanpa persetujuanmu.
- Commit per sesi; tag per milestone (`m0`, `m1`, …).

---

## 6. Checklist Rilis Pribadi
- [ ] Sign-up publik nonaktif; RLS teruji dengan akun kedua.
- [ ] Tidak ada rahasia di bundle/repo.
- [ ] CSP aktif.
- [ ] Worker penjadwal berjalan (cek log `scheduler-tick` tiap menit) & keepalive aktif.
- [ ] Push teruji 3 hari (app ditutup, layar terkunci), aksi notifikasi bekerja.
- [ ] Backup JSON dibuat & berhasil diimpor ulang di lingkungan uji.
- [ ] Riwayat AI diperiksa: tidak ada data sensitif terkirim.
- [ ] Lighthouse ≥ 90; semua P0/P1 di FEATURE-CHECKLIST tercentang dengan bukti.
