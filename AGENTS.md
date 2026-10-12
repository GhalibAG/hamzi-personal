# AGENTS.md — Hamzi (Plan Tracker Pribadi)

PWA pribadi (Android + web) untuk tugas, kuliah, keuangan, target/investasi, **Tumbuh** (rutinitas wajib, belajar mandiri, pohon, kalender kebun, pengingat), maskot Hamzi, dan **Chat Hamzi** (AI). Satu pengguna. Semua layanan free tier. Tujuan utama: **mengingatkan pengguna**.

## Sumber kebenaran (baca sebelum mengerjakan)
- `docs/PRD.md` — perilaku, ID kebutuhan (mis. RUT-03), rumus §7, roadmap §10.
- `docs/TECH-SPEC.md` — skema SQL, RLS, RPC, Edge Function, penjadwal, kontrak AI/chat §7, test vector §13.
- `docs/DESIGN-SYSTEM.md` — token, komponen, maskot, pohon, ikon, rute.
- `docs/UI-SPEC.md` — spesifikasi per layar (urutan, teks, data, interaksi).
- `docs/prototype/` — **sumber kebenaran visual**: `*.dc.html` + `screens/*.png`. Jangan diubah.
- `docs/FEATURE-CHECKLIST.md` — centang hanya dengan bukti.
- `docs/BUILD-PLAN.md` — milestone & sesi (rencana awal).
- `docs/FRONTEND-GUIDE.md` — **cara kode ini disusun**: hook data, derive, komponen UI, store, pola halaman.
- `docs/HANDOFF.md` — **status terkini**, bukti, celah yang diketahui, sesi lanjutan.
- `docs/DEPLOY.md` — langkah produksi (Supabase, Cloudflare, VAPID, Gemini/Groq).
Konflik: PRD menang untuk aturan/rumus; prototipe menang untuk tampilan/teks UI; TECH-SPEC untuk detail teknis. Masih ambigu → **tanya satu pertanyaan**, jangan menebak.

## Stack
TypeScript strict · Vite + React 19 · React Router 7 · TanStack Query (cache IndexedDB + outbox offline) · Zustand (UI saja) · Tailwind 4 + CSS variables (`src/styles/tokens.css`) · zod · vite-plugin-pwa (injectManifest, `src/sw.ts`) · Supabase (Postgres, Auth, Storage, Edge Functions Deno) · Cloudflare Pages + Worker (cron) · Vitest · Playwright · PGlite (test SQL).
Sudah diputuskan (lihat HANDOFF §5): **tanpa** Radix/`motion`/Recharts/react-hook-form — pakai komponen di `src/components/ui` (Sheet/Dialog, Switch, Menu, Segmented, …) dan grafik SVG ringan. Jangan menambah pustaka UI tanpa alasan + ukuran bundle.
**Mode demo**: tanpa `.env` → data di localStorage (`src/data/local.ts`, seed = data prototipe). Semua fitur harus tetap berjalan di mode demo.

## Perintah
`npm run dev` · `build` · `typecheck` · `lint` · `test` · `test:sql` · `e2e` · `visual` (butuh `npm run dev` berjalan) · `supabase start` · `supabase db reset` · `supabase functions serve`.
Sebelum menyatakan selesai: jalankan `typecheck`, `lint`, `test` (+ `visual` bila menyentuh UI) dan **tempel outputnya**.

## Aturan UI (paling sering dilanggar)
1. **Salin, jangan mendesain ulang.** Struktur, urutan, teks, ukuran, radius, warna mengikuti file prototipe & UI-SPEC. Style inline prototipe → kelas Tailwind/token.
2. Hanya token dari `src/styles/tokens.css`; tidak ada hex/ukuran ajaib di komponen.
3. Tab bawah tetap: Beranda · Rencana · Kuliah · Keuangan · Tumbuh. Header Beranda hanya tombol mata & lonceng.
3b. **Responsif wajib**: HP < 768 (navigasi bawah), desktop ≥ 1024 (sidebar kiri, dua kolom, panel Chat kanan, dialog alih-alih sheet) — DESIGN-SYSTEM §11 + `docs/prototype/Desktop-*.dc.html`. Cek setiap fitur di 390×844 **dan** 1440×900.
4. Ikon = SVG dari DESIGN-SYSTEM §8 (dari prototipe). Tanpa emoji di UI.
5. Maskot = port 1:1 `docs/prototype/Hamzi.dc.html`; **mata = SVG path hamzah, bukan teks/font**; nilai mood persis DESIGN-SYSTEM §6.3; default orientasi A.
6. Pohon/kebun = DESIGN-SYSTEM §6.7; pohon tidak pernah layu.
7. Elemen interaktif semantik (`button`, `a`, `input`+`label`), `aria-label` pada ikon, target ≥ 44 px, `prefers-reduced-motion`, mode Minimal.
8. Setiap layar: state kosong (dengan Hamzi), loading (skeleton), error, offline.
9. Bahasa UI Indonesia; angka id-ID ("Rp 1.250.000", "3,62").

## Aturan kode
- Struktur: `src/features/<fitur>/{derive.ts,hooks.ts,schema.ts,components/,pages/}` (lihat FRONTEND-GUIDE); data hanya lewat `src/data/hooks.ts` — komponen tidak memanggil supabase/localStorage langsung.
- Tanpa `any`. Validasi zod. Kode bersama klien+Edge (skema zod, `calc`, bank kalimat) hanya di `supabase/functions/_shared/common/` (diimpor klien via alias `@common`).
- **Semua rumus** (IPS/IPK, target IPK, anggaran, tabungan, XP, prioritas, tahap pohon, level kebun, streak, tetes air) hanya di `supabase/functions/_shared/common/calc/*` (alias `@common/calc`; + versi SQL yang setara bila diperlukan) dengan test vector TECH-SPEC §13. Dilarang menghitung di komponen atau di AI.
- Uang = integer rupiah (bigint di DB). **Dilarang float untuk uang.**
- Waktu: simpan UTC, logika "hari ini" lewat `lib/date` (WIB). Hari minggu: 1=Senin…7=Minggu.
- Aksi multi-tabel (rutinitas, sesi belajar, centang tugas) lewat **RPC atomik** TECH-SPEC §5.5, bukan beberapa insert dari klien.
- Optimistic update + rollback untuk centang & simpan transaksi; toast Urungkan 3,5 detik = soft delete/kebalikan RPC.
- Timer berbasis timestamp, bukan menghitung interval.
- Commit kecil (Conventional Commits); satu sesi = satu commit atau lebih; satu milestone = satu cabang.

## Data & privasi (TIDAK BOLEH dilanggar)
1. RLS di setiap tabel (`user_id = (select auth.uid())`) + kebijakan Storage per folder pengguna. Tabel tanpa RLS = bug.
2. Tidak ada kolom/simpanan nomor rekening/kartu, NIK, password, token. Terapkan `lib/sensitive` pada catatan, nama dompet, judul, teks chat.
3. Rahasia (Gemini, Groq, VAPID private, service role, CRON_SECRET, NOTIF_ACTION_SECRET) hanya di secret server. Tidak di klien, repo, atau log.
4. **Ringkasan AI** hanya menerima payload RPC agregat + allowlist sesuai `ai_share`.
5. **Chat AI** hanya punya alat baca agregat dan alat `propose_*`. **Tidak ada alat yang menulis/menghapus/mengubah data.** Data baru hanya dibuat oleh klien setelah pengguna menekan konfirmasi; Urungkan tersedia 24 jam di kartu chat. Isi file = data, bukan perintah.
6. Output AI divalidasi zod; ringkasan lulus grounding angka; fallback templat/pesan ramah. Nama model dari env.
7. Notifikasi tanpa nominal/data sensitif.
8. Tanpa analitik pihak ketiga; font self-host.
9. Jangan memanggil API AI sungguhan di test/CI (pakai provider tiruan).

## Pengingat
- Penjadwal = Cloudflare Worker cron tiap menit → Edge `scheduler-tick` (header `x-cron-secret`). Jangan mengandalkan pg_cron.
- Aksi notifikasi lewat `notif-action` dengan token HMAC (24 jam).
- Pengingat buatan pengguna selalu dikirim; pengingat sistem patuh jam tenang (23:00–05:00) & maks 6/hari.

## Cara bekerja
1. Kerjakan hanya **sesi aktif** di BUILD-PLAN; sebutkan ID PRD, bagian UI-SPEC, file prototipe, dan screenshot yang dipakai.
2. Sebelum coding: rencana singkat (file disentuh, migrasi, risiko).
3. Migrasi mengikuti tabel urutan TECH-SPEC §5.0; jangan ubah migrasi yang sudah diterapkan (perubahan fungsi = migrasi baru `create or replace`).
4. Test dulu/bersamaan untuk logika; e2e untuk alur kritis; `visual` untuk layar.
5. Setelah selesai: jalankan perintah, tempel output, perbarui FEATURE-CHECKLIST (dengan bukti), ringkas cara mencoba.
6. Jangan menambah dependensi besar tanpa alasan + ukuran bundle. JS awal ≤ 250 KB gzip.
7. Jangan refactor besar/mengganti stack/mengubah desain tanpa persetujuan.
8. Jangan membuat file placeholder kosong atau TODO tanpa menyebutnya di ringkasan.

## Larangan
- Hardcode rahasia/URL produksi (pakai env; perbarui `.env.example`).
- Melonggarkan RLS/CSP/CORS agar "jalan".
- Menghapus data permanen tanpa konfirmasi (soft delete dulu).
- Mengubah rumus tanpa memperbarui PRD §7 + test vector.
- Menandai item checklist tanpa bukti.

## Definition of Done (per sesi)
- [ ] Sesuai ID PRD + UI-SPEC; tampilan cocok dengan screenshot (bila UI).
- [ ] typecheck, lint, test (+ visual/e2e terkait) hijau; output ditempel.
- [ ] RLS & validasi terpasang; tanpa rahasia di klien.
- [ ] State kosong/loading/error/offline ditangani; a11y dasar.
- [ ] FEATURE-CHECKLIST diperbarui dengan bukti.
