# DEPLOY — Panduan Pemasangan Hamzi (semua free tier)

Panduan langkah demi langkah untuk pemilik (satu pengguna). Ikuti berurutan. Semua layanan memakai paket gratis:
**Supabase** (database, login, storage, Edge Functions), **Cloudflare** (Pages untuk aplikasi + Worker untuk penjadwal),
**GitHub** (repo, CI, keep-alive cadangan), **Google AI Studio** (Gemini) dan **Groq** (AI cadangan).

> Aturan emas: **rahasia tidak pernah ditulis di repo, di `.env` yang ter-commit, atau di kode klien.** Rahasia hanya disimpan di
> *Supabase Edge Function secrets*, *Cloudflare Worker secrets*, dan *GitHub Actions secrets*.

Hal bertanda **[verifikasi]** wajib dicek ke dokumentasi resmi saat memasang (daftar lengkap di bagian 14).

---

## 0. Yang perlu disiapkan

| Kebutuhan | Keterangan |
|---|---|
| Node.js 22 | `node --version` |
| Supabase CLI | <https://supabase.com/docs/guides/local-development/cli/getting-started> — atau pakai `npx supabase …` |
| Akun | Supabase, Cloudflare, GitHub, Google (AI Studio + Google Cloud untuk login Google), Groq |
| Password manager | Untuk menyimpan password database dan semua rahasia yang dibuat di langkah 4 |

Peta komponen:

```
Cloudflare Pages (aplikasi PWA)  ──supabase-js──►  Supabase (Postgres + RLS, Auth, Storage)
Cloudflare Worker (cron tiap menit) ──POST x-cron-secret──►  Edge Function scheduler-tick ──► Web Push ke HP
Service worker HP ──token HMAC──►  Edge Function notif-action
Aplikasi ──JWT──►  ai-generate / ai-chat / push-test / account-delete ──►  Gemini (utama) / Groq (cadangan)
GitHub Actions: CI + keepalive harian (cadangan)
```

---

## 1. Buat project Supabase

1. Masuk ke <https://supabase.com/dashboard> → **New project**.
2. Nama: `hamzi`. Region: **Southeast Asia (Singapore)** (paling dekat ke WIB).
3. Buat **Database password** yang kuat → simpan di password manager.
4. Setelah project siap, catat dari **Project Settings**:
   - **Reference ID** (`<project-ref>`, mis. `abcdxyz…`) — Settings > General.
   - **Project URL** `https://<project-ref>.supabase.co` — Settings > API (Data API).
   - **anon / publishable key** (kunci publik) — Settings > API Keys. **Jangan** salin *service_role / secret key* ke mana pun.
5. **[verifikasi]** Versi Postgres (Settings > Infrastructure). Bila bukan 17, ubah `major_version` di `supabase/config.toml`.

## 2. Hubungkan repo ke project (CLI)

```bash
cd hamzi
npx supabase login                       # buka browser, izinkan CLI
npx supabase link --project-ref <project-ref>
# CLI meminta password database dari langkah 1.3
```

## 3. Terapkan migrasi database

Migrasi ada di `supabase/migrations/0001_init.sql` … `0011_chat.sql` (urutan TECH-SPEC §5.0). Sebelum menerapkan, pastikan
test SQL hijau di komputer sendiri:

```bash
npm ci
npm run test:sql          # menjalankan semua migrasi di PGlite + test vector & RLS
npx supabase db push      # menerapkan migrasi ke project production
```

Periksa di Dashboard:
- **Table Editor**: ada 38 tabel (`profiles`, `tasks`, `routines`, …, `ai_conversations`, `ai_messages`, `ai_actions`, `job_runs`).
- **Database > Advisors > Security**: tidak boleh ada peringatan "RLS disabled". (Migrasi juga gagal sendiri bila ada tabel tanpa RLS.)
- **Storage**: bucket **chat-uploads** ada, **Private**, batas 10 MB, MIME `application/pdf, image/jpeg, image/png, image/webp`.
  Di **Storage > Policies** ada kebijakan `own chat uploads` pada `storage.objects`.

> Migrasi yang sudah diterapkan **tidak boleh diubah**. Perubahan berikutnya = file migrasi baru (`0012_…sql`) dengan
> `create or replace`. Sebelum `db push` berikutnya, lakukan **Export JSON** dari aplikasi (Pengaturan > Data) sebagai backup.

## 4. Buat rahasia Edge Functions

Buat file rahasia **di luar folder repo**, mis. `~/hamzi-secrets.env` (jangan di dalam `hamzi/`: `.gitignore` hanya
mengabaikan `.env`, `.env.local`, dan `.env.*.local`).

| Nama | Cara mendapatkan |
|---|---|
| `GEMINI_API_KEY` | <https://aistudio.google.com> → **Get API key** → Create API key (proyek Google baru boleh). |
| `GEMINI_MODEL` | Nama model Gemini Flash yang mendukung *function calling* + PDF/gambar. **[verifikasi]** daftar model di <https://ai.google.dev/gemini-api/docs/models> (nama model **hanya** di env, tidak di kode). |
| `GROQ_API_KEY` | <https://console.groq.com> → **API Keys** → Create API Key. |
| `GROQ_MODEL` | Model Groq yang mendukung *tool use*. **[verifikasi]** <https://console.groq.com/docs/tool-use>. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` → salin *Public Key* & *Private Key*. Public key juga dipakai klien (`VITE_VAPID_PUBLIC_KEY`). |
| `VAPID_SUBJECT` | `mailto:<email-anda>` |
| `CRON_SECRET` | `openssl rand -hex 32` (Windows: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Nilai yang **sama** dipasang di Cloudflare Worker (langkah 10). |
| `NOTIF_ACTION_SECRET` | `openssl rand -hex 32` (nilai berbeda dari `CRON_SECRET`). |
| `ALLOWED_ORIGIN` | URL aplikasi, mis. `https://hamzi.pages.dev` (boleh beberapa, pisahkan koma; tambahkan domain sendiri bila ada). |
| `AI_DAILY_LIMIT` | `20` (ringkasan AI per hari). |
| `AI_CHAT_DAILY_LIMIT` | `30` (pesan chat per hari). |

Format file (contoh isi dengan placeholder — ganti dengan nilai asli di komputer Anda saja):

```dotenv
GEMINI_API_KEY=<kunci-dari-ai-studio>
GEMINI_MODEL=<nama-model-gemini>
GROQ_API_KEY=<kunci-dari-groq>
GROQ_MODEL=<nama-model-groq>
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:<email>
CRON_SECRET=<hasil-openssl>
NOTIF_ACTION_SECRET=<hasil-openssl-lain>
ALLOWED_ORIGIN=https://hamzi.pages.dev
AI_DAILY_LIMIT=20
AI_CHAT_DAILY_LIMIT=30
```

Unggah ke Supabase lalu hapus file lokalnya bila tidak diperlukan lagi:

```bash
npx supabase secrets set --env-file ~/hamzi-secrets.env
npx supabase secrets list            # hanya menampilkan nama + digest, bukan nilai
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` **otomatis** tersedia di Edge Functions — jangan diset manual.
**[verifikasi]** Project baru yang hanya memakai kunci *publishable/secret*: kode juga membaca `SUPABASE_PUBLISHABLE_KEY` /
`SUPABASE_SECRET_KEY` sebagai cadangan; cek nama env yang tersedia di dokumentasi Edge Functions > Environment variables.

Jangan pernah mengisi `LLM_MOCK` di production (itu hanya untuk test lokal/CI).

## 5. Deploy Edge Functions

```bash
npx supabase functions deploy scheduler-tick --no-verify-jwt
npx supabase functions deploy notif-action   --no-verify-jwt
npx supabase functions deploy push-test
npx supabase functions deploy ai-generate
npx supabase functions deploy ai-chat
npx supabase functions deploy account-delete
```

- `scheduler-tick` & `notif-action` tanpa verifikasi JWT (dilindungi `x-cron-secret` / token HMAC). Fungsi lain wajib JWT.
- Import map: `supabase/functions/deno.json` (zod, supabase-js, web-push lewat `npm:`). Pengaturan per fungsi ada di
  `supabase/config.toml`. **[verifikasi]** dukungan `deno.json`/import map oleh versi CLI Anda (`npx supabase --version`).

Uji cepat (ganti nilai):

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/scheduler-tick" -H "x-cron-secret: <CRON_SECRET>"
# → 200 {"enqueued":0,"sent":0,"skipped":0,"failed":0,"daily":{…}|null}
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/scheduler-tick" -H "x-cron-secret: salah"
# → 401
```

## 6. Login: Magic link & Google

**Authentication > URL Configuration**
- *Site URL*: `https://hamzi.pages.dev` (URL Cloudflare Pages Anda).
- *Redirect URLs*: `https://hamzi.pages.dev/**` dan, untuk pengembangan, `http://localhost:5173/**`.

**Magic link (email)** — Authentication > Sign In / Providers > **Email**: aktif. Kuota email bawaan Supabase terbatas
**[verifikasi]**; untuk satu pengguna biasanya cukup.

**Google**
1. <https://console.cloud.google.com> → buat project → **APIs & Services > OAuth consent screen**: User type *External*,
   status *Testing*, tambahkan email Anda sebagai *Test user*.
2. **Credentials > Create credentials > OAuth client ID** → *Web application*.
   - *Authorized JavaScript origins*: `https://hamzi.pages.dev`
   - *Authorized redirect URIs*: `https://<project-ref>.supabase.co/auth/v1/callback`
3. Salin *Client ID* & *Client secret* → Supabase **Authentication > Sign In / Providers > Google** → Enable → simpan.

## 7. Buat akun pemilik, lalu MATIKAN pendaftaran

1. Buka aplikasi (setelah langkah 9) → masuk dengan Google atau magic link.
2. Cek di **SQL Editor**:
   ```sql
   select count(*) from public.profiles;                         -- 1
   select count(*) from public.categories;                       -- 15
   select name, is_default from public.wallets;                  -- Tunai | true
   ```
3. **Authentication > Sign In / Providers > "Allow new users to sign up" = OFF** (TECH-SPEC §11).
4. Uji: jendela penyamaran → coba daftar dengan email lain → harus ditolak.
5. (Opsional, sebelum langkah 3) Uji RLS dengan akun kedua: data akun pertama tidak boleh terlihat. Hapus akun uji di
   Authentication > Users. Test otomatis yang sama ada di `npm run test:sql`.

## 8. Storage

Sudah dibuat oleh migrasi `0011_chat.sql`. Pastikan: bucket `chat-uploads` **tidak publik**, ukuran maks 10 MB,
MIME hanya PDF/JPG/PNG/WebP. File chat dihapus otomatis setelah 7 hari oleh job harian `scheduler-tick`.

## 9. Cloudflare Pages (aplikasi)

1. Push repo ke GitHub (privat).
2. Cloudflare Dashboard → **Workers & Pages > Create > Pages > Connect to Git** → pilih repo.
3. Build settings: Framework *None/Vite*, **Build command** `npm run build`, **Output directory** `dist`.
4. **Environment variables** (Production):
   | Nama | Nilai |
   |---|---|
   | `NODE_VERSION` | `22` |
   | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | anon / publishable key (publik, dibatasi RLS) |
   | `VITE_VAPID_PUBLIC_KEY` | VAPID **public** key dari langkah 4 |
   | `VITE_APP_NAME` | `Hamzi` |
5. Deploy → URL `https://<nama>.pages.dev`. Pastikan nilai ini sama dengan `ALLOWED_ORIGIN` dan Site URL Auth.
6. **Header keamanan**: file `public/_headers` ikut tersalin ke `dist/_headers` dan diterapkan Pages (CSP
   `default-src 'self'; connect-src 'self' https://*.supabase.co; img-src 'self' data: blob:; frame-ancestors 'none'` +
   `base-uri`, `object-src`, `form-action`, nosniff, Referrer-Policy). Cek:
   ```bash
   curl -sI https://hamzi.pages.dev | grep -i -E "content-security-policy|x-content-type"
   ```
   Buka aplikasi → DevTools > Console: **tidak boleh** ada pesan *Refused to …* (CSP). **[verifikasi]** bila ada komponen
   yang menyisipkan `<style>` inline, perbaiki komponennya — jangan melonggarkan CSP.
7. SPA routing: Cloudflare Pages otomatis melayani `index.html` untuk rute yang tidak ada (selama tidak ada `404.html`).

## 10. Cloudflare Worker (penjadwal tiap menit)

```bash
cd workers/scheduler
# 1) Edit wrangler.toml → TICK_URL = "https://<project-ref>.supabase.co/functions/v1/scheduler-tick"
npx wrangler login
npx wrangler secret put CRON_SECRET     # tempel nilai CRON_SECRET yang sama dengan langkah 4
npx wrangler deploy
npx wrangler tail                       # lihat log: "scheduler-tick 200 {…}" muncul tiap menit
```

- Cron `* * * * *` (tiap menit) ≈ 43.200 permintaan/bulan. **[verifikasi]** batas gratis Workers & Cron Triggers di
  <https://developers.cloudflare.com/workers/platform/limits/>.
- `workers_dev = false`: Worker tidak punya URL publik; hanya cron yang menjalankannya.
- Worker ini sekaligus menjaga project Supabase gratis tetap aktif (tidak di-*pause*). pg_cron **tidak** dipakai.

## 11. GitHub Actions

- **CI** (`.github/workflows/ci.yml`) jalan otomatis di push/PR: typecheck, lint, unit test, `test:sql`, build,
  `deno check` Edge Functions, dan **scan rahasia** (repo + bundle `dist`). Tidak butuh secret.
- **Keepalive cadangan** (`.github/workflows/keepalive.yml`, setiap hari 03:17 UTC): repo **Settings > Secrets and variables >
  Actions > New repository secret**:
  - `SUPABASE_URL` = `https://<project-ref>.supabase.co`
  - `SUPABASE_ANON_KEY` = anon / publishable key
  Lalu tab **Actions > Keepalive > Run workflow** sekali untuk uji (harus mencetak `1`).
  **[verifikasi]** GitHub menonaktifkan workflow terjadwal pada repo yang lama tidak aktif; penjadwal utama tetap Cloudflare.

## 12. Verifikasi akhir (checklist)

| Cek | Cara | Hasil yang diharapkan |
|---|---|---|
| Penjadwal hidup | Supabase > Edge Functions > `scheduler-tick` > Logs | Baris `{"fn":"scheduler-tick","enqueued":…}` tiap menit, status 200 |
| Push uji | Aplikasi > Tumbuh > Pengingat > **Coba pengingat** (setelah "Aktifkan pengingat") | Notifikasi muncul di HP; log `push-test` `sent ≥ 1` |
| Tombol notifikasi | Tekan "Tandai selesai" pada push uji | Notifikasi konfirmasi "Tercatat. …" tanpa membuka aplikasi |
| Pengingat rutinitas | Buat rutinitas dengan jam 3 menit lagi | Push tiba ±1 menit; baris `scheduled_notifications` status `sent` |
| Jam tenang | Pengingat sistem tidak dikirim 23:00–05:00 | Status `skipped` / tidak di-enqueue |
| Job harian | SQL: `select * from public.job_runs order by day desc limit 3;` | Satu baris `daily` per hari (setelah 00:05 WIB) |
| Kata Hamzi | Buka Beranda | Kartu ringkasan; `ai_requests.status = ok` (atau `fallback` = templat) |
| Chat | `/chat` → "tambahin rutinitas minum air 8 gelas jam 9 pagi" | Kartu usulan Rutinitas; tidak ada data tersimpan sebelum Simpan |
| Kuota | `AI_CHAT_DAILY_LIMIT` terlampaui | Pesan "Kuota ngobrol hari ini sudah habis…" (status `limited`) |
| Rahasia | `curl https://hamzi.pages.dev/assets/*.js` + cari `service_role` | Tidak ditemukan (CI juga memeriksa) |

Log Edge Function **tidak** memuat isi pesan, payload, atau token — hanya angka/status.

## 13. Pengembangan lokal

```bash
npx supabase start                         # Postgres, Auth, Storage, Studio lokal (butuh Docker)
npx supabase db reset                      # terapkan semua migrasi + seed.sql (kosong)
cp .env.example .env.local                 # isi VITE_SUPABASE_URL=http://127.0.0.1:54321 & anon key lokal (dari `supabase status`)
# Secret lokal Edge Functions (file ini JANGAN di-commit):
#   supabase/functions/.env  → CRON_SECRET, NOTIF_ACTION_SECRET, VAPID_*, ALLOWED_ORIGIN=http://localhost:5173, LLM_MOCK=1
npx supabase functions serve --env-file supabase/functions/.env
npm run dev
# picu penjadwal lokal:
curl -X POST http://127.0.0.1:54321/functions/v1/scheduler-tick -H "x-cron-secret: <CRON_SECRET lokal>"
```

- `LLM_MOCK=1` memakai penyedia AI tiruan (tanpa memanggil Gemini/Groq) — wajib untuk test & CI.
- Email magic link lokal terlihat di <http://localhost:54324>.
- Test SQL tanpa Docker: `npm run test:sql` (PGlite).
- Cek tipe Edge Functions: `npx -y deno@2 check --config supabase/functions/deno.json supabase/functions/*/index.ts`.

## 14. Daftar [verifikasi] dan tempat mengeceknya

| Item | Sumber resmi |
|---|---|
| Batas gratis Cloudflare Workers & Cron Triggers | developers.cloudflare.com/workers/platform/limits · …/configuration/cron-triggers |
| `web-push` (npm specifier) berjalan di Supabase Edge Runtime | Uji langsung dengan **Coba pengingat**; docs Supabase Edge Functions > npm modules |
| Gemini: batas ukuran `inlineData` & dukungan PDF untuk model terpilih | ai.google.dev/gemini-api/docs/document-processing · …/vision |
| Gemini: function calling (`toolConfig`, `functionResponse`) untuk model terpilih | ai.google.dev/gemini-api/docs/function-calling |
| Groq: dukungan tool calling model terpilih | console.groq.com/docs/tool-use |
| Import map / `deno.json` di Supabase Edge Functions | supabase.com/docs/guides/functions/dependencies |
| Nama env kunci API baru (publishable/secret) di Edge Functions | supabase.com/docs/guides/functions/secrets |
| Versi Postgres project (`major_version` di config.toml) | Dashboard > Settings > Infrastructure |
| Chrome Android menampilkan maks 2 tombol aksi notifikasi | developer.chrome.com (Notification actions) |
| GitHub menonaktifkan workflow terjadwal pada repo tidak aktif | docs.github.com > Actions > Disabling and enabling a workflow |
| Kuota email bawaan Supabase Auth | supabase.com/docs/guides/auth/auth-smtp |
| CSP: tidak ada komponen yang butuh `<style>` inline | DevTools Console di aplikasi production |

## 15. Pemeliharaan

- Rotasi rahasia: buat nilai baru → `npx supabase secrets set NAMA=…` → (untuk `CRON_SECRET`) `npx wrangler secret put CRON_SECRET`.
  Mengganti `NOTIF_ACTION_SECRET` membuat tombol pada notifikasi lama (≤ 24 jam) tidak berlaku — wajar.
- Perubahan skema: migrasi baru → `npm run test:sql` → Export JSON dari aplikasi → `npx supabase db push`.
- Perubahan Edge Function: `npx supabase functions deploy <nama>`.
- Perubahan Worker: `cd workers/scheduler && npx wrangler deploy`.
- Hapus akun permanen: Pengaturan > Hapus akun (fungsi `account-delete`, ketik `HAPUS`) — menghapus file Storage dan seluruh data.
