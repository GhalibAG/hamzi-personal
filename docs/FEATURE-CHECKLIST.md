# FEATURE-CHECKLIST — Semua Fitur yang Disepakati

Tujuan: memastikan **tidak ada fitur yang terlewat** dan setiap fitur **benar-benar berfungsi**. Agent mencentang `[x]` hanya setelah bukti tersedia (output test, nama file e2e, atau catatan cek manual dengan tanggal). Pemilik meninjau centang di akhir tiap milestone.

Kolom: **Fitur** (bahasa pengguna) · **ID** (PRD) · **Layar** (UI-SPEC/rute) · **M** (milestone) · **Bukti** yang diminta.

## A. Permintaan pengguna (dari diskusi) → di mana dipenuhi

| # | Permintaan pengguna | Dipenuhi oleh | M | Bukti | ✓ |
|---|---|---|---|---|---|
| 1 | Plan/tugas/proyek + kalender | TASK-01…10, PROJ-01…03, CAL-01…03 | M2 | e2e tugas; cek kalender — e2e `flows.spec` (tambah & centang tugas); compare 04–06, d03 | [x] |
| 2 | Bagian kuliah lengkap (jadwal, ujian, nilai, IPK) | KUL-01…09 | M6 | test #1–6, #21–22, #30; cek IPS vs portal kampus — test #1–6, #21–22, #30 ✓ + compare 07–08, d04; **sisa:** cocokkan IPS dengan portal kampus (manual) | [ ] |
| 3 | Keuangan dengan tracking harian | FIN-01…13, HOME-03 | M5 | test #7–9, #26–27; catat ≤ 5 dtk — test #7–9, #26–27 ✓; e2e catat 25.000 → "Sisa aman Rp 40.000" (4 ketukan) | [x] |
| 4 | Target tabungan & investasi | GOAL-01…07, INV-01…05 | M7 | test #10–14 — test #10–14 ✓; proyeksi 3 skenario di detail target | [x] |
| 5 | Tracker belajar dengan modul (bisa tambah sendiri) | BEL-01…09 | M3 | e2e tambah modul → unit dibuat — cek Playwright 12 Okt 2026: modul dari templat → unit dibuat | [x] |
| 6 | Rutinitas harian wajib | RUT-01…07 | M3 | e2e centang → tetes air — e2e `flows.spec` centang rutinitas → tetes air | [x] |
| 7 | Akumulasi di kalender | TUM-04, test #24 | M3 | screenshot kebun bulan nyata — compare-14 (kebun bulan dari data demo) | [x] |
| 8 | Pohon tumbuh dari rutinitas & belajar | TUM-01…03, test #23, #25 | M3 | e2e 4 rutinitas → bunga — test #23–25, #34 ✓; cek Playwright: semua wajib + belajar ≥10 mnt → bunga | [x] |
| 9 | **App mengingatkan** (tujuan utama) | NOT-01…09 | M4 | cek manual 3 hari (app tertutup) — **butuh deploy** (push di HP 3 hari); mode demo: ReminderEngine + `reminders.test.ts` ✓ | [ ] |
| 10 | Pengingat bisa ditindaklanjuti dari notifikasi | NOT-04, `notif-action` | M4 | cek manual "Tandai selesai" — **butuh deploy**; aksi dari banner dalam app ✓ (cek Playwright) | [ ] |
| 11 | Semua elemen modular & bisa ditambah sendiri (rutinitas, modul, matkul, kategori, dompet, target) | RUT-02, BEL-02, KUL-02, FIN-01/04, GOAL-01 | M2–M7 | tidak ada data bawaan selain kategori & dompet Tunai — test SQL `handle_new_user` (hanya dompet Tunai + 15 kategori) | [x] |
| 12 | Maskot kucing bermata hamzah (ء) | MAS-01, DESIGN-SYSTEM §6 | M1 | screenshot `/dev/maskot` vs 21 — compare-21 (`/dev/maskot`) | [x] |
| 13 | Maskot hidup (mood sesuai kondisi) | MAS-02, MAS-04 | M8 | unit test mesin mood — `tests/unit/mood.test.ts` (7 test) | [x] |
| 14 | UI mirip super-app, halus, hijau segar | DESIGN-SYSTEM, UI-SPEC | M1 | `compare-*.png` 01–20 ditinjau — `npm run visual` compare 01–20 ditinjau 12 Okt 2026 | [x] |
| 15 | Bisa di HP seperti app (bukan buka Chrome dulu) | NFR-02, PWA | M0 | terpasang di Android, layar penuh — manifest/SW/ikon ✓ di build; **sisa:** pasang di Android | [ ] |
| 15b | **Ramah desktop** (sering login dari laptop) | DESK-01…07, NFR-13, DESIGN-SYSTEM §11 | M1 + tiap milestone | `compare-d*.png` ditinjau; uji 1280 & 1440 px — compare d01–d09 (1440 & 1280); tanpa scroll horizontal 360–1920 px | [x] |
| 16 | Semua gratis | TECH-SPEC §2, NFR-08 | semua | tidak ada layanan berbayar di `.env.example` — `.env.example` + DEPLOY.md hanya layanan gratis | [x] |
| 17 | AI merangkum & memberi saran dari data | AI-01…05, HOME-07 | M9 | Riwayat AI menunjukkan payload agregat — templat ✓ + Riwayat AI menampilkan payload; **sisa:** Gemini sungguhan | [ ] |
| 18 | Data keuangan harian boleh dibaca AI, tapi data sensitif aman | PRD §9, `ai_share`, redaksi | M9 | test #18, #20; cek Riwayat AI — test #18, #20 ✓; Riwayat AI "Lihat data terkirim" | [x] |
| 19 | **Chatbot** di dalam app | CHAT-01 | M9 | layar `/chat` vs 18–20 — compare 18–20, d01 | [x] |
| 20 | Kirim file dosen → dirangkum & diberi saran | CHAT-02, CHAT-11 | M9 | cek manual PDF RPS — **butuh Gemini** (mode demo tidak membaca isi file) | [ ] |
| 21 | AI menjalankan fitur lewat perintah (mis. tambah rutinitas) | CHAT-03, CHAT-04 | M9 | e2e perintah → kartu → simpan → muncul di Tumbuh — e2e chat "tambahin rutinitas…" → Simpan → muncul di Tumbuh | [x] |
| 22 | Tetap bisa manual tanpa AI | Semua tombol "+", sheet | M2–M7 | app berfungsi dengan `ai_enabled=false` — semua alur e2e memakai input manual; `ai_enabled=false` → templat | [x] |
| 23 | Gemini gratis cukup; kalau kuota habis app tetap jalan | AI-04, CHAT-10, TECH-SPEC §7.7 | M9 | test provider tiruan 429 → templat/pesan ramah — loop chat dengan provider tiruan ✓ (Deno); **sisa:** uji 429 → templat di server | [ ] |
| 24 | Kirim file dari WhatsApp ke Hamzi (saran tambahan) | CHAT-07 | M9 | cek manual share dari WA — share target di manifest + SW ✓; **sisa:** uji dari WhatsApp (PWA terpasang) | [ ] |
| 25 | Review mingguan Minggu malam (saran tambahan) | AI-02, NOT-03 | M9 | notifikasi Minggu 19:00 + pesan chat — `reminders.test.ts` (Minggu 19:00) + `chat-parser.test.ts` (`?review=minggu`) | [x] |
| 26 | Mode ujian H-7 (saran tambahan) | KUL-10 (P2) | M10 | draf sesi belajar dibuat — P2 — belum dibuat | [ ] |
| 27 | Project gratis tidak tidur / pengingat tidak mati | ADR 11, keepalive | M4 | log `scheduler-tick` 7 hari tanpa jeda — **butuh deploy** (log scheduler 7 hari) | [ ] |
| 28 | Panduan baterai Android agar notifikasi sampai | AUTH-04, NOT-09 | M4 | layar onboarding langkah 6 — onboarding langkah 6 (screenshot `tests/visual/out/f/`) | [x] |
| 29 | Offline tetap bisa mencatat | OFF-01…04 | M8 | cek manual mode pesawat — outbox `outbox.test.ts` ✓; **sisa:** mode pesawat di HP dengan Supabase | [ ] |
| 30 | Data aman & bisa dibackup | SET-04, SET-05, NFR-04/05 | M0, M10 | export → impor ulang sukses — `settings-data.test.ts` (export → impor gabung) | [x] |
| 31 | Catatan pribadi bebas ("catatan hidup") | NOTE-01 | M2 | unit test derive & schema; e2e buat, refresh, hapus, urungkan — `tests/unit/notes.test.ts` (22 test) + e2e `flows.spec.ts` | [x] |

## B. Daftar ID (centang saat terbukti)
Bukti per ID: test di `tests/unit`, `tests/sql`, `tests/e2e`, perbandingan `npm run visual`, dan cek Playwright 12 Okt 2026 (lihat HANDOFF §2). ID yang belum dicentang butuh deploy/AI sungguhan atau P2 — rinciannya di HANDOFF §3–§4.

**NOTE** [x] 01

**AUTH** [ ] 01 [ ] 02 [ ] 03 [x] 04 [x] 06 · (P2) [ ] 05
**HOME** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08 [x] 09 [x] 10
**TASK** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08 [x] 09 [x] 10 [x] 12 · (P2) [ ] 11
**PROJ** [x] 01 [x] 02 [x] 03 [ ] 04
**CAL** [x] 01 [x] 02 [x] 03 · (P2) [ ] 04
**RUT** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07
**BEL** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08 [x] 09 · (P2) [ ] 10
**TUM** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 · (P2) [ ] 06
**NOT** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [x] 06 [x] 07 [x] 08 [x] 09
**FIN** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08 [x] 09 [x] 10 [x] 11 [x] 12 [x] 13
**KUL** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08 [x] 09 [ ] 11 · (P2) [ ] 10
**GOAL** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 · (P2) [ ] 08
**INV** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05
**MAS** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 · (P2) [ ] 06
**OFF** [ ] 01 [x] 02 [ ] 03 [x] 04
**AI** [ ] 01 [x] 02 [x] 03 [ ] 04 [ ] 05
**CHAT** [x] 01 [ ] 02 [x] 03 [x] 04 [x] 05 [x] 06 [ ] 07 [x] 08 [x] 09 [x] 10 [ ] 11
**SET** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07 [x] 08
**SRCH** [x] 01 [x] 02 [x] 03
**DESK** [x] 01 [x] 02 [x] 03 [x] 04 [x] 05 [x] 06 [x] 07
**NFR** [ ] 01 [ ] 02 [ ] 03 [x] 04 [x] 05 [ ] 06 [ ] 07 [x] 08 [ ] 09 [x] 10 [x] 11 [x] 12 [x] 13

## C. Test vector (TECH-SPEC §13)
Bukti: `tests/unit/vectors.test.ts` (36/36 lulus) + versi SQL di `npm run test:sql`.
[x] 1 [x] 2 [x] 3 [x] 4 [x] 5 [x] 6 [x] 7 [x] 8 [x] 9 [x] 10 [x] 11 [x] 12 [x] 13 [x] 14 [x] 15 [x] 16 [x] 17 [x] 18 [x] 19 [x] 20 [x] 21 [x] 22 [x] 23 [x] 24 [x] 25 [x] 26 [x] 27 [x] 28 [x] 29 [x] 30 [x] 31 [x] 32 [x] 33 [x] 34 [x] 35 [x] 36

## D. Kesesuaian visual (UI-SPEC §13)
Bukti: `npm run visual` → `tests/visual/out/compare-*.png` (prototipe | app), ditinjau 12 Okt 2026.
| Screenshot | Layar app | ✓ |
|---|---|---|
| 01–03 | `/` | [x] |
| 04–06 | `/rencana` | [x] |
| 07–08 | `/kuliah` | [x] |
| 09–11 | `/keuangan` | [x] |
| 12–17 | `/tumbuh`, `/tumbuh/sesi` | [x] |
| 18–20 | `/chat` | [x] |
| 21 | `/dev/maskot` (viewport 1120×640) | [x] |
| d01–d09 | Desktop `/`, `/rencana`, `/kuliah`, `/keuangan`, `/tumbuh` (1440×900 & 1280×800) | [x] |

## E. Log cek manual
| Tanggal | Milestone | Yang dicek | Hasil |
|---|---|---|---|
| 2026-10-12 | M0–M10 (mode demo) | typecheck, lint, unit 157, SQL 45, e2e 9, visual 30 layar, tanpa scroll horizontal 360/800/1024/1920 px, mode gelap | Lulus; sisa uji produksi di HANDOFF §3 |
