# FEATURE-CHECKLIST — Semua Fitur yang Disepakati

Tujuan: memastikan **tidak ada fitur yang terlewat** dan setiap fitur **benar-benar berfungsi**. Agent mencentang `[x]` hanya setelah bukti tersedia (output test, nama file e2e, atau catatan cek manual dengan tanggal). Pemilik meninjau centang di akhir tiap milestone.

Kolom: **Fitur** (bahasa pengguna) · **ID** (PRD) · **Layar** (UI-SPEC/rute) · **M** (milestone) · **Bukti** yang diminta.

## A. Permintaan pengguna (dari diskusi) → di mana dipenuhi

| # | Permintaan pengguna | Dipenuhi oleh | M | Bukti | ✓ |
|---|---|---|---|---|---|
| 1 | Plan/tugas/proyek + kalender | TASK-01…10, PROJ-01…03, CAL-01…03 | M2 | e2e tugas; cek kalender | [ ] |
| 2 | Bagian kuliah lengkap (jadwal, ujian, nilai, IPK) | KUL-01…09 | M6 | test #1–6, #21–22, #30; cek IPS vs portal kampus | [ ] |
| 3 | Keuangan dengan tracking harian | FIN-01…13, HOME-03 | M5 | test #7–9, #26–27; catat ≤ 5 dtk | [ ] |
| 4 | Target tabungan & investasi | GOAL-01…07, INV-01…05 | M7 | test #10–14 | [ ] |
| 5 | Tracker belajar dengan modul (bisa tambah sendiri) | BEL-01…09 | M3 | e2e tambah modul → unit dibuat | [ ] |
| 6 | Rutinitas harian wajib | RUT-01…07 | M3 | e2e centang → tetes air | [ ] |
| 7 | Akumulasi di kalender | TUM-04, test #24 | M3 | screenshot kebun bulan nyata | [ ] |
| 8 | Pohon tumbuh dari rutinitas & belajar | TUM-01…03, test #23, #25 | M3 | e2e 4 rutinitas → bunga | [ ] |
| 9 | **App mengingatkan** (tujuan utama) | NOT-01…09 | M4 | cek manual 3 hari (app tertutup) | [ ] |
| 10 | Pengingat bisa ditindaklanjuti dari notifikasi | NOT-04, `notif-action` | M4 | cek manual "Tandai selesai" | [ ] |
| 11 | Semua elemen modular & bisa ditambah sendiri (rutinitas, modul, matkul, kategori, dompet, target) | RUT-02, BEL-02, KUL-02, FIN-01/04, GOAL-01 | M2–M7 | tidak ada data bawaan selain kategori & dompet Tunai | [ ] |
| 12 | Maskot kucing bermata hamzah (ء) | MAS-01, DESIGN-SYSTEM §6 | M1 | screenshot `/dev/maskot` vs 21 | [ ] |
| 13 | Maskot hidup (mood sesuai kondisi) | MAS-02, MAS-04 | M8 | unit test mesin mood | [ ] |
| 14 | UI mirip super-app, halus, hijau segar | DESIGN-SYSTEM, UI-SPEC | M1 | `compare-*.png` 01–20 ditinjau | [ ] |
| 15 | Bisa di HP seperti app (bukan buka Chrome dulu) | NFR-02, PWA | M0 | terpasang di Android, layar penuh | [ ] |
| 15b | **Ramah desktop** (sering login dari laptop) | DESK-01…07, NFR-13, DESIGN-SYSTEM §11 | M1 + tiap milestone | `compare-d*.png` ditinjau; uji 1280 & 1440 px | [ ] |
| 16 | Semua gratis | TECH-SPEC §2, NFR-08 | semua | tidak ada layanan berbayar di `.env.example` | [ ] |
| 17 | AI merangkum & memberi saran dari data | AI-01…05, HOME-07 | M9 | Riwayat AI menunjukkan payload agregat | [ ] |
| 18 | Data keuangan harian boleh dibaca AI, tapi data sensitif aman | PRD §9, `ai_share`, redaksi | M9 | test #18, #20; cek Riwayat AI | [ ] |
| 19 | **Chatbot** di dalam app | CHAT-01 | M9 | layar `/chat` vs 18–20 | [ ] |
| 20 | Kirim file dosen → dirangkum & diberi saran | CHAT-02, CHAT-11 | M9 | cek manual PDF RPS | [ ] |
| 21 | AI menjalankan fitur lewat perintah (mis. tambah rutinitas) | CHAT-03, CHAT-04 | M9 | e2e perintah → kartu → simpan → muncul di Tumbuh | [ ] |
| 22 | Tetap bisa manual tanpa AI | Semua tombol "+", sheet | M2–M7 | app berfungsi dengan `ai_enabled=false` | [ ] |
| 23 | Gemini gratis cukup; kalau kuota habis app tetap jalan | AI-04, CHAT-10, TECH-SPEC §7.7 | M9 | test provider tiruan 429 → templat/pesan ramah | [ ] |
| 24 | Kirim file dari WhatsApp ke Hamzi (saran tambahan) | CHAT-07 | M9 | cek manual share dari WA | [ ] |
| 25 | Review mingguan Minggu malam (saran tambahan) | AI-02, NOT-03 | M9 | notifikasi Minggu 19:00 + pesan chat | [ ] |
| 26 | Mode ujian H-7 (saran tambahan) | KUL-10 (P2) | M10 | draf sesi belajar dibuat | [ ] |
| 27 | Project gratis tidak tidur / pengingat tidak mati | ADR 11, keepalive | M4 | log `scheduler-tick` 7 hari tanpa jeda | [ ] |
| 28 | Panduan baterai Android agar notifikasi sampai | AUTH-04, NOT-09 | M4 | layar onboarding langkah 6 | [ ] |
| 29 | Offline tetap bisa mencatat | OFF-01…04 | M8 | cek manual mode pesawat | [ ] |
| 30 | Data aman & bisa dibackup | SET-04, SET-05, NFR-04/05 | M0, M10 | export → impor ulang sukses | [ ] |

## B. Daftar ID (centang saat terbukti)

**AUTH** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 06 · (P2) [ ] 05
**HOME** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 10
**TASK** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 10 [ ] 12 · (P2) [ ] 11
**PROJ** [ ] 01 [ ] 02 [ ] 03 [ ] 04
**CAL** [ ] 01 [ ] 02 [ ] 03 · (P2) [ ] 04
**RUT** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07
**BEL** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 · (P2) [ ] 10
**TUM** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 · (P2) [ ] 06
**NOT** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09
**FIN** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 10 [ ] 11 [ ] 12 [ ] 13
**KUL** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 11 · (P2) [ ] 10
**GOAL** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 · (P2) [ ] 08
**INV** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05
**MAS** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 · (P2) [ ] 06
**OFF** [ ] 01 [ ] 02 [ ] 03 [ ] 04
**AI** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05
**CHAT** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 10 [ ] 11
**SET** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08
**SRCH** [ ] 01 [ ] 02 [ ] 03
**DESK** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07
**NFR** [ ] 01 [ ] 02 [ ] 03 [ ] 04 [ ] 05 [ ] 06 [ ] 07 [ ] 08 [ ] 09 [ ] 10 [ ] 11 [ ] 12 [ ] 13

## C. Test vector (TECH-SPEC §13)
[ ] 1 [ ] 2 [ ] 3 [ ] 4 [ ] 5 [ ] 6 [ ] 7 [ ] 8 [ ] 9 [ ] 10 [ ] 11 [ ] 12 [ ] 13 [ ] 14 [ ] 15 [ ] 16 [ ] 17 [ ] 18 [ ] 19 [ ] 20 [ ] 21 [ ] 22 [ ] 23 [ ] 24 [ ] 25 [ ] 26 [ ] 27 [ ] 28 [ ] 29 [ ] 30 [ ] 31 [ ] 32 [ ] 33 [ ] 34 [ ] 35 [ ] 36

## D. Kesesuaian visual (UI-SPEC §13)
| Screenshot | Layar app | ✓ |
|---|---|---|
| 01–03 | `/` | [ ] |
| 04–06 | `/rencana` | [ ] |
| 07–08 | `/kuliah` | [ ] |
| 09–11 | `/keuangan` | [ ] |
| 12–17 | `/tumbuh`, `/tumbuh/sesi` | [ ] |
| 18–20 | `/chat` | [ ] |
| 21 | `/dev/maskot` (viewport 1120×640) | [ ] |
| d01–d09 | Desktop `/`, `/rencana`, `/kuliah`, `/keuangan`, `/tumbuh` (1440×900 & 1280×800) | [ ] |

## E. Log cek manual
| Tanggal | Milestone | Yang dicek | Hasil |
|---|---|---|---|
| | | | |
