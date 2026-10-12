# Hamzi — Plan Tracker Pribadi

PWA pribadi (Android + desktop) untuk **tugas & proyek, kuliah, keuangan, target tabungan & investasi, Tumbuh** (rutinitas wajib, belajar mandiri, pohon, kalender kebun, pengingat), maskot **Hamzi** (kucing bermata ء), dan **Chat Hamzi** (AI yang membaca file dosen dan menambah data lewat kartu konfirmasi). Satu pengguna, semua layanan gratis. Tujuan utama: **mengingatkan kamu**.

> Status: aplikasi sudah dibangun lengkap (frontend + backend Supabase + penjadwal). Bisa langsung dicoba di **mode demo** tanpa akun apa pun. Untuk dipakai sungguhan, ikuti `docs/DEPLOY.md`. Sisa pekerjaan & cara melanjutkan di Antigravity: `docs/HANDOFF.md`.

## Coba sekarang (mode demo, 2 menit)
Butuh Node.js 22+.
```bash
npm install
npm run dev          # buka http://localhost:5173
```
Tanpa file `.env`, app berjalan di **mode demo**: semua data disimpan di peramban (localStorage) dan diisi data contoh yang sama dengan prototipe (Iqbal, semester 6, Rp 1.250.000, pohon muda, dst.). AI di mode demo diganti parser perintah sederhana (mis. ketik di Chat: `tambahin rutinitas siapin bekal jam 06:30 sen-jum`, `jajan bakso 15rb`, `ada tugas laporan besok jam 19:00 matkul basis data lanjut`). Reset data: Pengaturan › Data.

Buka di HP pada jaringan yang sama: `npm run dev -- --host`, lalu buka alamat IP laptop dari Chrome HP. Desktop (≥ 1024 px) otomatis memakai sidebar + panel Chat (tekan `C`).

## Perintah
| Perintah | Fungsi |
|---|---|
| `npm run dev` | server pengembangan |
| `npm run build` / `npm run preview` | build produksi (PWA + service worker) |
| `npm run typecheck` · `npm run lint` | TypeScript strict · ESLint |
| `npm test` | unit test (Vitest): 36 test vector TECH-SPEC §13, parser chat, pengingat, outbox, mood, IPK |
| `npm run test:sql` | migrasi + RPC + RLS diuji di Postgres (PGlite) |
| `npm run e2e` | Playwright: catat transaksi, centang rutinitas → tetes air, tugas, chat → kartu → simpan, timer, desktop |
| `npm run visual` | memotret semua layar & membandingkan dengan `docs/prototype/screens/` (butuh `npm run dev` berjalan) |
| `node scripts/make-icons.mjs` | membuat ulang ikon PWA dari maskot |

Playwright di mesin sendiri: `npx playwright install chromium` sekali.

## Struktur
```
AGENTS.md                aturan untuk coding agent (baca dulu)
docs/                    PRD, TECH-SPEC, DESIGN-SYSTEM, UI-SPEC, FEATURE-CHECKLIST, BUILD-PLAN,
                         FRONTEND-GUIDE (cara kode ini disusun), DEPLOY (langkah produksi), HANDOFF (sisa pekerjaan)
docs/prototype/          sumber kebenaran visual (*.dc.html + screens/*.png) — jangan diubah
src/app/                 router, AppShell (navigasi bawah / sidebar + panel chat), sheet tambah cepat, PWA prompt
src/components/          ikon, maskot Hamzi, pohon & kebun, UI kit
src/data/                repo demo (localStorage) & Supabase, hook TanStack Query, outbox offline, seed demo
src/features/<fitur>/    halaman, komponen, derive (turunan murni) per fitur
src/sw.ts                service worker: precache, push + aksi notifikasi, share target
supabase/migrations/     0001–0011 (skema, RLS, RPC, penjadwal, chat & storage)
supabase/functions/      Edge Functions: scheduler-tick, notif-action, push-test, ai-generate, ai-chat, account-delete
supabase/functions/_shared/common/   kode bersama klien + Edge: rumus (calc), skema zod, bank kalimat
workers/scheduler/       Cloudflare Worker cron tiap menit → scheduler-tick
tests/                   unit, e2e, sql, visual
```

## Pakai sungguhan (gratis)
Supabase (DB, login, storage, Edge Functions) + Cloudflare Pages (hosting) + Cloudflare Worker (penjadwal tiap menit) + Gemini API (AI, Groq cadangan) + Web Push (VAPID). Langkah lengkap, berurutan, dalam Bahasa Indonesia: **`docs/DEPLOY.md`**. Setelah `.env` diisi (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`), app otomatis keluar dari mode demo dan memakai login.

Rahasia (kunci Gemini/Groq, VAPID private, service role, CRON_SECRET, NOTIF_ACTION_SECRET) **hanya** disimpan sebagai secret Supabase/Cloudflare — tidak pernah di repo atau di kode klien.
