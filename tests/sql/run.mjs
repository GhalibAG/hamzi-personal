// Test SQL Hamzi — menjalankan semua migrasi di PGlite (Postgres 17 WASM) dengan stub Supabase
// (role anon/authenticated/service_role, skema auth & storage), lalu memeriksa test vector TECH-SPEC §13
// dan perilaku RPC/trigger/RLS. Jalankan: npm run test:sql
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migDir = join(root, 'supabase', 'migrations');

// ---------- Stub yang biasanya disediakan Supabase ----------
const STUBS = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to public;

create schema storage;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now()
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null, owner uuid, created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;
`;

// ---------- Mini runner ----------
const results = [];
let current = '';
async function test(name, fn) {
  current = name;
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e });
    console.log(`  ✗ ${name}\n      ${String(e?.message ?? e).split('\n').join('\n      ')}`);
  } finally {
    await reset();
  }
}

const db = new PGlite({ extensions: { pgcrypto } });
const q = async (sql, params = []) => (await db.query(sql, params)).rows;
const one = async (sql, params = []) => {
  const r = await db.query(sql, params);
  if (!r.rows.length) return undefined;
  return Object.values(r.rows[0])[0];
};
async function as(uid) {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await db.exec(`set role authenticated`);
}
async function asService() {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role service_role`);
}
async function asAnon() {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role anon`);
}
async function reset() {
  await db.exec(`reset role`);
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
}
async function rejects(promise, re) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `seharusnya gagal (${re})`);
  if (re) assert.match(String(err.message), re);
}
async function newUser(name = 'Teman') {
  return one(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`,
    [`${name.toLowerCase()}@contoh.test`, JSON.stringify({ name })]);
}
const today = async () => one(`select public.wib_today()::text`);
const addDays = async (d, n) => one(`select ($1::date + $2::int)::text`, [d, n]);
const num = (x) => (x === null || x === undefined ? x : Number(x));

// ---------- Apply migrasi ----------
console.log('Hamzi · test SQL (PGlite)');
await db.exec(STUBS);
const files = readdirSync(migDir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
for (const f of files) {
  try {
    await db.exec(readFileSync(join(migDir, f), 'utf8'));
    console.log(`  migrasi ${f} ✓`);
  } catch (e) {
    console.error(`  migrasi ${f} GAGAL: ${e.message}`);
    process.exit(1);
  }
}
assert.equal(files.length, 12, 'harus ada 12 migrasi 0001…0012');

// =====================================================================================
console.log('\nTest vector TECH-SPEC §13 (versi SQL)');

await test('#33 fn_level_from_xp 0/99/100/249/250/449/450 → 1/1/2/2/3/3/4', async () => {
  const r = await q(`select array_agg(public.fn_level_from_xp(x) order by o) a
                     from unnest(array[0,99,100,249,250,449,450]) with ordinality t(x,o)`);
  assert.deepEqual(r[0].a, [1, 1, 2, 2, 3, 3, 4]);
});

await test('#15 xpToNext level 1/2/5 → 100/150/300 (fn_xp_progress.need)', async () => {
  assert.equal(await one(`select (public.fn_xp_progress(0)->>'need')::int`), 100);
  assert.equal(await one(`select (public.fn_xp_progress(100)->>'need')::int`), 150);
  // level 5 dimulai pada 100+150+200+250 = 700
  assert.equal(await one(`select (public.fn_xp_progress(700)->>'level')::int`), 5);
  assert.equal(await one(`select (public.fn_xp_progress(700)->>'need')::int`), 300);
});

await test('#16 taskXp Rendah/Sedang/Tinggi/Kritis → 10/12/15/20', async () => {
  const r = await q(`select array_agg(public.fn_task_xp(p) order by p) a from generate_series(1,4) p`);
  assert.deepEqual(r[0].a, [10, 12, 15, 20]);
});

await test('#17 priorityScore prioritas 3 terlambat → 95', async () => {
  assert.equal(await one(`select public.fn_priority_score(3, now() - interval '1 hour', now(), false)`), 95);
  assert.equal(await one(`select public.fn_priority_score(2, now() + interval '30 hours', now(), true)`), 50);
});

await test('#23 fn_tree_stage 0/4/5/48/50/80/200', async () => {
  const r = await q(`select w, public.fn_tree_stage(w) s from unnest(array[0,4,5,48,50,80,200]) w`);
  const names = r.map((x) => x.s.name);
  assert.deepEqual(names, ['Biji', 'Biji', 'Tunas', 'Pohon muda', 'Pohon rindang', 'Pohon berbuah', 'Pohon berbuah']);
  const s48 = r[3].s;
  assert.equal(s48.progress_pct, 90);
  assert.equal(s48.to_next, 2);
  assert.equal(s48.next_name, 'Pohon rindang');
  assert.equal(r[6].s.progress_pct, 100);
});

await test('#24 fn_garden_level (4,0,0)(4,1,0)(4,2,0)(4,4,0)(0,0,15)(0,0,5) → 0,1,2,3,3,0; bunga', async () => {
  const r = await q(`select array[public.fn_garden_level(4,0,0), public.fn_garden_level(4,1,0), public.fn_garden_level(4,2,0),
                                  public.fn_garden_level(4,4,0), public.fn_garden_level(0,0,15), public.fn_garden_level(0,0,5)] a`);
  assert.deepEqual(r[0].a, [0, 1, 2, 3, 3, 0]);
  assert.equal(await one(`select public.fn_has_bloom(public.fn_garden_level(4,4,12), 12)`), true);
  assert.equal(await one(`select public.fn_has_bloom(public.fn_garden_level(4,3,30), 30)`), false);
});

await test('#8/#9 fn_cycle_start 12 Okt & 28 Okt 2026 (cycle 25) → 25 Sep / 25 Okt', async () => {
  assert.equal(await one(`select public.fn_cycle_start('2026-10-12', 25)::text`), '2026-09-25');
  assert.equal(await one(`select public.fn_cycle_start('2026-10-28', 25)::text`), '2026-10-25');
  assert.equal(await one(`select public.fn_cycle_start('2026-01-10', 25)::text`), '2025-12-25');
});

await test('#35 daysLeftInCycle 12 Okt 2026 cycle 1 / 25 → 20 / 13', async () => {
  assert.equal(await one(`select public.fn_days_left_in_cycle('2026-10-12', 1)`), 20);
  assert.equal(await one(`select public.fn_days_left_in_cycle('2026-10-12', 25)`), 13);
});

await test('#7/#26/#27 anggaran: terpakai 58% aman 60.000; aman 42.000; +37%', async () => {
  assert.equal(await one(`select public.fn_budget_used_pct(1740000, 3000000)`), 58);
  assert.equal(num(await one(`select public.fn_safe_daily_rounded(3000000, 1740000, 21)`)), 60000);
  assert.equal(num(await one(`select public.fn_safe_daily_rounded(2000000, 1160000, 20)`)), 42000);
  assert.equal(await one(`select public.fn_pct_vs_avg(85000, 62000)`), 37);
  assert.equal(await one(`select public.fn_pct_vs_avg(85000, 0)`), null);
});

await test('#10/#12 goalMonthlyNeeded r=0 → 1.500.000; r=12% → 473.093', async () => {
  assert.equal(num(await one(`select public.fn_goal_monthly_needed(12000000, 3000000, 6, 0)`)), 1500000);
  assert.equal(num(await one(`select public.fn_goal_monthly_needed(6000000, 0, 12, 12)`)), 473093);
});

await test('#29 jam tenang: sistem 23:30 → skip; pengguna 04:30 → kirim', async () => {
  assert.equal(await one(`select public.fn_in_quiet('23:30', '23:00', '05:00')`), true);
  assert.equal(await one(`select public.fn_in_quiet('04:30', '23:00', '05:00')`), true); // hanya sistem yang patuh
  assert.equal(await one(`select public.fn_in_quiet('05:00', '23:00', '05:00')`), false);
  assert.equal(await one(`select public.fn_in_quiet('12:00', '23:00', '05:00')`), false);
});

await test('#36 roundHalfUp2 3,5625/3,565/3,70588 → 3,56/3,57/3,71; ceil2 3,8176 → 3,82', async () => {
  const r = await q(`select public.fn_round_half_up2(3.5625)::text a, public.fn_round_half_up2(3.565)::text b,
                            public.fn_round_half_up2(3.70588)::text c, public.fn_ceil2(64.9/17.0)::text d`);
  assert.deepEqual([Number(r[0].a), Number(r[0].b), Number(r[0].c), Number(r[0].d)], [3.56, 3.57, 3.71, 3.82]);
});

await test('#28 isRoutineDue: Sen–Jum pada Sabtu 17 Okt 2026 false; Senin 12 Okt true', async () => {
  assert.equal(await one(`select extract(isodow from date '2026-10-17')::int = any ('{1,2,3,4,5}'::smallint[])`), false);
  assert.equal(await one(`select extract(isodow from date '2026-10-12')::int = any ('{1,2,3,4,5}'::smallint[])`), true);
});

await test('fn_next_due: harian, mingguan by_day (WIB), bulanan dijepit', async () => {
  // Senin 12 Okt 2026 06:00 WIB = 11 Okt 23:00 UTC; mingguan by_day [3] → Rabu 14 Okt 06:00 WIB
  assert.equal(await one(`select to_char(public.fn_next_due('2026-10-11T23:00:00Z', '{"freq":"weekly","interval":1,"by_day":[3]}') at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI')`), '2026-10-14 06:00');
  assert.equal(await one(`select to_char(public.fn_next_due('2026-10-11T23:00:00Z', '{"freq":"daily","interval":2}') at time zone 'Asia/Jakarta', 'YYYY-MM-DD HH24:MI')`), '2026-10-14 06:00');
  assert.equal(await one(`select to_char(public.fn_next_due('2026-01-31T05:00:00Z', '{"freq":"monthly","interval":1}') at time zone 'Asia/Jakarta', 'YYYY-MM-DD')`), '2026-02-28');
});

// =====================================================================================
console.log('\nPendaftaran & RLS');

const U1 = await newUser('Iqbal');
const U2 = await newUser('Kedua');

await test('handle_new_user: profil, pengaturan, stats, dompet Tunai default + 15 kategori', async () => {
  assert.equal(await one(`select display_name from public.profiles where id = $1`, [U1]), 'Iqbal');
  assert.equal(num(await one(`select count(*) from public.user_settings where user_id = $1`, [U1])), 1);
  assert.equal(num(await one(`select count(*) from public.user_stats where user_id = $1`, [U1])), 1);
  const w = await q(`select name, kind, is_default from public.wallets where user_id = $1`, [U1]);
  assert.deepEqual(w, [{ name: 'Tunai', kind: 'cash', is_default: true }]);
  assert.equal(num(await one(`select count(*) from public.categories where user_id = $1`, [U1])), 15);
  assert.equal(num(await one(`select count(*) from public.categories where user_id = $1 and kind = 'expense'`, [U1])), 10);
  assert.equal(num(await one(`select count(*) from public.routines where user_id = $1`, [U1])), 0);
});

await test('RLS: semua tabel public memakai RLS', async () => {
  const r = await q(`select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
  assert.deepEqual(r, []);
});

let T1;
await test('RLS: isolasi antar pengguna (baca/ubah/sisip/RPC)', async () => {
  await as(U1);
  T1 = await one(`insert into public.tasks(title, priority) values ('Laporan praktikum', 3) returning id`);
  assert.equal(num(await one(`select count(*) from public.tasks`)), 1);
  assert.equal(num(await one(`select count(*) from public.wallets`)), 1);
  await as(U2);
  assert.equal(num(await one(`select count(*) from public.tasks`)), 0);
  assert.equal(num(await one(`select count(*) from public.categories`)), 15); // hanya miliknya
  assert.equal(num(await one(`select count(*) from public.profiles`)), 1);
  const upd = await db.query(`update public.tasks set title = 'diretas' where id = $1`, [T1]);
  assert.equal(upd.affectedRows ?? 0, 0);
  await rejects(db.query(`insert into public.tasks(user_id, title) values ($1, 'titipan')`, [U1]), /row-level security/);
  await rejects(db.query(`select public.rpc_task_set_done($1, true)`, [T1]), /Tugas tidak ditemukan/);
  await rejects(db.query(`select public.fn_task_set_done_for($1, $2, true)`, [U1, T1]), /permission denied/);
  await as(U1);
  assert.equal(await one(`select title from public.tasks where id = $1`, [T1]), 'Laporan praktikum');
});

await test('Buku besar gamifikasi (water/xp/user_stats) hanya bisa dibaca klien', async () => {
  await as(U1);
  assert.equal(num(await one(`select count(*) from public.user_stats`)), 1);
  await rejects(db.query(`insert into public.water_events(source, ref_id, day) values ('routine', gen_random_uuid(), current_date)`), /permission denied/);
  await rejects(db.query(`insert into public.xp_events(kind, ref_id, day, xp) values ('task', gen_random_uuid(), current_date, 999)`), /permission denied/);
  await rejects(db.query(`update public.user_stats set xp_total = 999`), /permission denied/);
});

await test('RLS: anon tidak melihat data; rpc_ping boleh', async () => {
  await asAnon();
  await rejects(db.query(`select count(*) from public.tasks`), /permission denied/);
  assert.equal(await one(`select public.rpc_ping()`), 1);
  await rejects(db.query(`select public.rpc_routine_set(gen_random_uuid(), current_date, 1)`), /permission denied/);
});

await test('RLS & validasi public.notes: isolasi dua pengguna, catatan kosong ditolak, anon ditolak', async () => {
  const UA = await newUser('CatatanA');
  const UB = await newUser('CatatanB');

  // Catatan kosong total ditolak (check constraint)
  await as(UA);
  await rejects(db.query(`insert into public.notes(title, body) values (null, '')`), /check/i);
  await rejects(db.query(`insert into public.notes(title, body) values ('', '')`), /check/i);
  await rejects(db.query(`insert into public.notes(title, body) values ('   ', '   ')`), /check/i);

  // Judul > 120 atau body > 20000 ditolak
  await rejects(db.query(`insert into public.notes(title, body) values ($1, 'isi')`, ['x'.repeat(121)]), /check/i);
  await rejects(db.query(`insert into public.notes(title, body) values ('judul', $1)`, ['x'.repeat(20001)]), /check/i);

  // Pengguna A membuat 2 catatan: satu disematkan (hanya judul), satu biasa (hanya isi)
  const NA1 = await one(`insert into public.notes(title, body, pinned) values ('Catatan Penting A', '', true) returning id`);
  const NA2 = await one(`insert into public.notes(title, body) values (null, 'Isi catatan A tanpa judul') returning id`);
  assert.equal(num(await one(`select count(*) from public.notes`)), 2);

  // Pengguna B tidak bisa melihat catatan A
  await as(UB);
  assert.equal(num(await one(`select count(*) from public.notes`)), 0);

  // Pengguna B tidak bisa mengubah catatan A
  const upd = await db.query(`update public.notes set body = 'dibajak B' where id = $1`, [NA1]);
  assert.equal(upd.affectedRows ?? 0, 0);

  // Pengguna B tidak bisa menghapus catatan A
  const del = await db.query(`delete from public.notes where id = $1`, [NA1]);
  assert.equal(del.affectedRows ?? 0, 0);

  // Pengguna B tidak bisa menyisipkan catatan atas nama Pengguna A
  await rejects(db.query(`insert into public.notes(user_id, body) values ($1, 'titipan')`, [UA]), /row-level security/i);

  // Anon tidak punya akses
  await asAnon();
  await rejects(db.query(`select count(*) from public.notes`), /permission denied/i);
  await rejects(db.query(`insert into public.notes(body) values ('isi anon')`), /permission denied/i);
  await rejects(db.query(`update public.notes set body = 'isi anon' where id = $1`, [NA1]), /permission denied/i);
  await rejects(db.query(`delete from public.notes where id = $1`, [NA1]), /permission denied/i);

  // Pengguna A memeriksa kembali datanya (utuh dan tidak terganggu)
  await as(UA);
  assert.equal(await one(`select title from public.notes where id = $1`, [NA1]), 'Catatan Penting A');
  assert.equal(await one(`select body from public.notes where id = $1`, [NA2]), 'Isi catatan A tanpa judul');
  assert.equal(await one(`select pinned from public.notes where id = $1`, [NA1]), true);
});

await test('RLS: scheduled_notifications hanya baca + ubah read_at oleh pengguna', async () => {
  const nid = await one(`insert into public.scheduled_notifications(user_id, category, kind, dedupe_key, fire_at, title, body, status)
                         values ($1, 'user', 'test', 'test:x', now(), 'Halo', 'Isi', 'sent') returning id`, [U1]);
  await as(U1);
  assert.equal(num(await one(`select count(*) from public.scheduled_notifications`)), 1);
  await db.query(`update public.scheduled_notifications set read_at = now() where id = $1`, [nid]);
  await rejects(db.query(`update public.scheduled_notifications set title = 'x' where id = $1`, [nid]), /permission denied/);
  await rejects(db.query(`insert into public.scheduled_notifications(user_id, category, kind, dedupe_key, fire_at, title, body)
                          values ($1, 'user', 'test', 'test:y', now(), 'a', 'b')`, [U1]), /permission denied/);
  await as(U2);
  assert.equal(num(await one(`select count(*) from public.scheduled_notifications`)), 0);
  await reset();
  assert.ok(await one(`select read_at from public.scheduled_notifications where id = $1`, [nid]));
  await db.query(`delete from public.scheduled_notifications where id = $1`, [nid]);
});

await test('RLS Storage: chat-uploads hanya folder {uid}/', async () => {
  assert.equal(num(await one(`select count(*) from storage.buckets where id = 'chat-uploads' and not public`)), 1);
  await as(U1);
  await db.query(`insert into storage.objects(bucket_id, name) values ('chat-uploads', $1)`, [`${U1}/2026-10-12/a-rps.pdf`]);
  await rejects(db.query(`insert into storage.objects(bucket_id, name) values ('chat-uploads', $1)`, [`${U2}/2026-10-12/b.pdf`]), /row-level security/);
  await as(U2);
  assert.equal(num(await one(`select count(*) from storage.objects`)), 0);
});

// =====================================================================================
console.log('\nRPC tulis atomik');

await test('rpc_routine_set: tetes air, XP, bonus semua wajib, nilai dijepit, urungkan', async () => {
  const d = await today();
  await as(U1);
  const rA = await one(`insert into public.routines(name) values ('Bangun pagi') returning id`);
  const rB = await one(`insert into public.routines(name, kind, target_count) values ('Minum air', 'count', 3) returning id`);
  const rOpt = await one(`insert into public.routines(name, is_required) values ('Jurnal', false) returning id`);

  let res = await one(`select public.rpc_routine_set($1, $2::date, 1)`, [rA, d]);
  assert.equal(res.done, true);
  assert.equal(res.water_total, 1);
  assert.equal(res.all_required, false);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 5);

  res = await one(`select public.rpc_routine_set($1, $2::date, 2)`, [rB, d]);
  assert.equal(res.done, false);
  assert.equal(res.garden_level_today, 2);   // 1 dari 2 wajib → bibit
  // idempoten: kirim ulang nilai sama
  await one(`select public.rpc_routine_set($1, $2::date, 1)`, [rA, d]);
  assert.equal(num(await one(`select count(*) from public.water_events`)), 1);

  res = await one(`select public.rpc_routine_set($1, $2::date, 9)`, [rB, d]);   // dijepit ke target 3
  assert.equal(res.done, true);
  assert.equal(res.value, 3);
  assert.equal(res.all_required, true);
  assert.equal(res.garden_level_today, 3);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 5 + 5 + 10);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'all_required'`)), 1);

  // rutinitas tidak wajib tidak memengaruhi bonus
  await one(`select public.rpc_routine_set($1, $2::date, 1)`, [rOpt, d]);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 25);
  assert.equal(num(await one(`select level from public.user_stats`)), 1);

  // urungkan B → bonus & tetes B ditarik
  res = await one(`select public.rpc_routine_set($1, $2::date, 0)`, [rB, d]);
  assert.equal(res.done, false);
  assert.equal(res.all_required, false);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'all_required'`)), 0);
  assert.equal(num(await one(`select count(*) from public.water_events`)), 2);   // A + Jurnal
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 10);
  // bersihkan untuk test lain
  await reset();
  await db.query(`delete from public.routines where user_id = $1`, [U1]);
  await db.query(`delete from public.water_events where user_id = $1`, [U1]);
  await db.query(`delete from public.xp_events where user_id = $1`, [U1]);
});

await test('rpc_routine_set: rutinitas milik orang lain ditolak', async () => {
  await as(U2);
  const r2 = await one(`insert into public.routines(name) values ('Milik U2') returning id`);
  await as(U1);
  await rejects(db.query(`select public.rpc_routine_set($1, public.wib_today(), 1)`, [r2]), /Rutinitas tidak ditemukan/);
});

await test('rpc_study_finish: tetes maks 3/hari, sesi < 10 mnt tanpa tetes, XP maks 60, target mingguan, idempoten', async () => {
  const U4 = await newUser('Belajar');
  await as(U4);
  await db.query(`insert into public.learning_modules(title, weekly_target_min) values ('SQL', 300)`);
  const startedAt = await one(`select ((public.wib_today() + time '08:00') at time zone 'Asia/Jakarta')::text`);
  const ids = await q(`select gen_random_uuid()::text id from generate_series(1,5)`);
  const call = (i, dur) => one(`select public.rpc_study_finish($1::uuid, $2::timestamptz, $3::int, null, null)`, [ids[i].id, startedAt, dur]);

  let r = await call(0, 120);
  assert.equal(r.water_awarded, true);
  assert.equal(r.xp, 24);
  r = await call(1, 120);
  assert.equal(r.water_awarded, true);
  r = await call(2, 120);
  assert.equal(r.water_awarded, true);
  assert.equal(r.xp, 12);                                   // sisa kuota 60
  r = await call(3, 25);
  assert.equal(r.water_awarded, false);                     // #25: 4 sesi ≥ 10 mnt → 3 tetes
  assert.equal(r.xp, 0);
  assert.equal(r.water_total, 3);
  const before = num(await one(`select xp_total from public.user_stats`));
  assert.equal(before, 24 + 24 + 12 + 50);                  // + weekly_target (360 ≥ 300)
  r = await call(0, 120);                                   // kirim ulang (outbox) → tidak berubah
  assert.equal(r.water_awarded, false);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), before);
  assert.equal(num(await one(`select count(*) from public.study_sessions`)), 4);
  assert.equal(num(await one(`select level from public.user_stats`)), 2);
});

await test('#25/#34 sesi 9 mnt tanpa tetes; 2 sesi @6 mnt W=4 S=4 → tetes 0, bunga ya, memenuhi streak', async () => {
  const U5 = await newUser('Gabungan');
  await as(U5);
  const d = await today();
  const startedAt = await one(`select ((public.wib_today() + time '09:00') at time zone 'Asia/Jakarta')::text`);
  const r9 = await one(`select public.rpc_study_finish(gen_random_uuid(), $1::timestamptz, 9)`, [startedAt]);
  assert.equal(r9.water_awarded, false);
  await reset();
  await db.query(`delete from public.study_sessions where user_id = $1`, [U5]);
  await as(U5);
  const rids = [];
  for (let i = 0; i < 4; i++) rids.push(await one(`insert into public.routines(name) values ($1) returning id`, [`R${i}`]));
  for (const id of rids) await one(`select public.rpc_routine_set($1, $2::date, 1)`, [id, d]);
  const a = await one(`select public.rpc_study_finish(gen_random_uuid(), $1::timestamptz, 6)`, [startedAt]);
  const b = await one(`select public.rpc_study_finish(gen_random_uuid(), $1::timestamptz, 6)`, [startedAt]);
  assert.equal(a.water_awarded || b.water_awarded, false);
  const g = (await q(`select * from public.fn_day_growth($1, $2::date)`, [U5, d]))[0];
  assert.deepEqual([g.due, g.done, g.study_min, g.level, g.bloom, g.qualifies], [4, 4, 12, 3, true, true]);
  const ov = await one(`select public.rpc_growth_overview()`);
  assert.equal(ov.bloom_today, true);
  assert.equal(ov.water_total, 4);
});

await test('#19 streak: H-3,H-2,H-1 → 3; +hari ini → 4; H-1 kosong & hari ini → 1; keduanya kosong → 0', async () => {
  const U3 = await newUser('Streak');
  const d = await today();
  const rid = await one(`insert into public.routines(user_id, name, created_at) values ($1, 'Olahraga', now() - interval '10 days') returning id`, [U3]);
  const setLog = (day, done) => db.query(`insert into public.routine_logs(user_id, routine_id, log_date, value, done) values ($1, $2, $3::date, $4, $5)
                                          on conflict (routine_id, log_date) do update set done = excluded.done, value = excluded.value`,
    [U3, rid, day, done ? 1 : 0, done]);
  for (const n of [-3, -2, -1]) await setLog(await addDays(d, n), true);
  assert.equal(await one(`select public.fn_streak($1::date, $2)`, [d, U3]), 3);
  await setLog(d, true);
  assert.equal(await one(`select public.fn_streak($1::date, $2)`, [d, U3]), 4);
  await setLog(await addDays(d, -1), false);
  assert.equal(await one(`select public.fn_streak($1::date, $2)`, [d, U3]), 1);
  await setLog(d, false);
  assert.equal(await one(`select public.fn_streak($1::date, $2)`, [d, U3]), 0);
  // belajar ≥ 10 menit kemarin juga memenuhi syarat → H-1 (belajar), H-2, H-3 (rutinitas) = 3
  await db.query(`insert into public.study_sessions(user_id, started_at, duration_min) values ($1, ($2::date + time '10:00') at time zone 'Asia/Jakarta', 15)`,
    [U3, await addDays(d, -1)]);
  assert.equal(await one(`select public.fn_streak($1::date, $2)`, [d, U3]), 3);
  await as(U3);
  assert.equal(await one(`select public.fn_streak()`), 3);
  assert.equal((await one(`select public.rpc_garden_month()`)).days.length >= 28, true);
});

await test('rpc_task_set_done: XP prioritas, instance berulang dibuat sekali, urungkan', async () => {
  await as(U1);
  const tid = await one(`insert into public.tasks(title, priority, due_at, recurrence)
                         values ('Setor laporan', 3, ((public.wib_today() + time '19:00') at time zone 'Asia/Jakarta'),
                                 '{"freq":"weekly","interval":1}') returning id`);
  let r = await one(`select public.rpc_task_set_done($1, true)`, [tid]);
  assert.equal(r.done, true);
  assert.equal(r.xp, 15);
  assert.ok(r.next_task_id);
  const next = (await q(`select status, recurrence_parent_id,
                                extract(epoch from due_at - (select due_at from public.tasks where id = $1))::int / 86400 as gap_days
                         from public.tasks where id = $2`, [tid, r.next_task_id]))[0];
  assert.equal(next.status, 'belum');
  assert.equal(next.recurrence_parent_id, tid);
  assert.equal(next.gap_days, 7);
  // idempoten
  await one(`select public.rpc_task_set_done($1, true)`, [tid]);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'task' and ref_id = $1`, [tid])), 1);
  // urungkan lalu centang lagi → tetap satu instance berikutnya
  r = await one(`select public.rpc_task_set_done($1, false)`, [tid]);
  assert.equal(r.done, false);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'task' and ref_id = $1`, [tid])), 0);
  assert.equal(await one(`select completed_at from public.tasks where id = $1`, [tid]), null);
  r = await one(`select public.rpc_task_set_done($1, true)`, [tid]);
  assert.equal(r.next_task_id, null);
  assert.equal(num(await one(`select count(*) from public.tasks where recurrence_parent_id = $1`, [tid])), 1);
});

await test('rpc_task_set_done: "tugas juga menyiram pohon" maks 3/hari', async () => {
  const U6 = await newUser('Siram');
  await as(U6);
  await db.query(`update public.user_settings set water_from_tasks = true`);
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await one(`insert into public.tasks(title) values ($1) returning id`, [`T${i}`]));
  const got = [];
  for (const id of ids) got.push((await one(`select public.rpc_task_set_done($1, true)`, [id])).water_awarded);
  assert.deepEqual(got, [true, true, true, false]);
});

await test('rpc_unit_set_status & rpc_attendance_mark (upsert, catatan dipertahankan)', async () => {
  await as(U1);
  const m = await one(`insert into public.learning_modules(title) values ('Web') returning id`);
  const u = await one(`insert into public.learning_units(module_id, title) values ($1, 'Unit 1') returning id`, [m]);
  await one(`select public.rpc_unit_set_status($1, 'selesai')`, [u]);
  assert.ok(await one(`select completed_at from public.learning_units where id = $1`, [u]));
  await one(`select public.rpc_unit_set_status($1, 'belum')`, [u]);
  assert.equal(await one(`select completed_at from public.learning_units where id = $1`, [u]), null);
  await rejects(db.query(`select public.rpc_unit_set_status($1, 'aneh')`, [u]), /Status tidak valid/);

  const sem = await one(`insert into public.semesters(number, label, start_date, end_date, is_active) values (3, 'Ganjil 2026/2027', '2026-09-01', '2027-01-31', true) returning id`);
  const c = await one(`insert into public.courses(semester_id, name, credits) values ($1, 'Basis Data', 3) returning id`, [sem]);
  await one(`select public.rpc_attendance_mark($1, '2026-10-12', 'hadir', 'bawa laptop')`, [c]);
  await one(`select public.rpc_attendance_mark($1, '2026-10-12', 'izin')`, [c]);
  const a = (await q(`select status, note from public.attendances where course_id = $1`, [c]))[0];
  assert.deepEqual(a, { status: 'izin', note: 'bawa laptop' });
});

await test('trigger XP transaksi: +2 maks 3/hari, ditarik saat soft delete', async () => {
  const U7 = await newUser('Dompet');
  await as(U7);
  const w = await one(`select id from public.wallets where is_default`);
  const tx = [];
  for (let i = 0; i < 4; i++) tx.push(await one(`insert into public.transactions(kind, amount, wallet_id) values ('expense', 10000, $1) returning id`, [w]));
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'tx'`)), 3);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 6);
  await db.query(`update public.transactions set deleted_at = now() where id = $1`, [tx[0]]);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'tx'`)), 2);
  assert.equal(num(await one(`select xp_total from public.user_stats`)), 4);
  // transfer tidak memberi XP
  const w2 = await one(`insert into public.wallets(name, kind) values ('Bank', 'bank') returning id`);
  await db.query(`insert into public.transactions(kind, amount, wallet_id, to_wallet_id) values ('transfer', 5000, $1, $2)`, [w, w2]);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'tx'`)), 2);
  // transaksi baru masih dalam kuota hari ini → XP lagi
  await db.query(`insert into public.transactions(kind, amount, wallet_id) values ('income', 50000, $1)`, [w]);
  assert.equal(num(await one(`select count(*) from public.xp_events where kind = 'tx'`)), 3);
});

await test('v_wallet_balance: saldo awal + masuk − keluar ± transfer + koreksi; abaikan terhapus', async () => {
  const U8 = await newUser('Saldo');
  await as(U8);
  const a = await one(`select id from public.wallets where is_default`);
  await db.query(`update public.wallets set opening_balance = 100000 where id = $1`, [a]);
  const b = await one(`insert into public.wallets(name, kind) values ('Bank', 'bank') returning id`);
  const ins = (kind, amount, w, to = null, dir = 1) =>
    db.query(`insert into public.transactions(kind, amount, wallet_id, to_wallet_id, direction) values ($1, $2, $3, $4, $5) returning id`, [kind, amount, w, to, dir]);
  await ins('income', 50000, a);
  await ins('expense', 20000, a);
  await ins('transfer', 30000, a, b);
  await ins('adjustment', 5000, a, null, -1);
  await ins('adjustment', 1000, b, null, 1);
  const del = (await ins('expense', 99999, a)).rows[0].id;
  await db.query(`update public.transactions set deleted_at = now() where id = $1`, [del]);
  const bal = Object.fromEntries((await q(`select wallet_id, balance from public.v_wallet_balance`)).map((r) => [r.wallet_id, num(r.balance)]));
  assert.equal(bal[a], 100000 + 50000 - 20000 - 30000 - 5000);
  assert.equal(bal[b], 30000 + 1000);
  const fin = await one(`select public.rpc_finance_daily()`);
  assert.equal(num(fin.spent_today), 20000);
  assert.equal(num(fin.balance_total), 95000 + 31000);
  await as(U1);
  assert.equal(num(await one(`select count(*) from public.v_wallet_balance where wallet_id = $1`, [a])), 0); // RLS lewat security_invoker
});

await test('trigger XP target tabungan: 25/50/75/100 sekali per target', async () => {
  const U9 = await newUser('Target');
  await as(U9);
  const g = await one(`insert into public.savings_goals(name, target_amount) values ('Laptop', 1000000) returning id`);
  await db.query(`insert into public.goal_contributions(goal_id, amount) values ($1, 300000)`, [g]);
  assert.deepEqual((await q(`select kind from public.xp_events order by kind`)).map((r) => r.kind), ['goal_25']);
  const c2 = await one(`insert into public.goal_contributions(goal_id, amount) values ($1, 500000) returning id`, [g]);
  assert.deepEqual((await q(`select kind from public.xp_events order by kind`)).map((r) => r.kind), ['goal_25', 'goal_50', 'goal_75']);
  await db.query(`update public.goal_contributions set deleted_at = now() where id = $1`, [c2]);   // urungkan hari yang sama
  assert.deepEqual((await q(`select kind from public.xp_events order by kind`)).map((r) => r.kind), ['goal_25']);
  const ov = await one(`select public.rpc_goals_overview()`);
  assert.equal(ov.goals[0].progress_pct, 30);
});

// =====================================================================================
console.log('\nPenjadwal notifikasi');

await test('fn_enqueue_notifications: rutinitas di jendela, dedupe, sudah selesai tidak diingatkan', async () => {
  const UN = await newUser('Notif');
  const d1 = await addDays(await today(), 1);
  await db.query(`insert into public.routines(user_id, name, remind_at) values ($1, 'Olahraga 20 menit', '06:00')`, [UN]);
  const rDone = await one(`insert into public.routines(user_id, name, remind_at) values ($1, 'Sudah beres', '06:02') returning id`, [UN]);
  await db.query(`insert into public.routine_logs(user_id, routine_id, log_date, value, done) values ($1, $2, $3::date, 1, true)`, [UN, rDone, d1]);
  await db.query(`insert into public.routines(user_id, name, remind_at, repeat_days) values ($1, 'Tidak terjadwal', '06:01', '{}')`, [UN]);
  const pNow = `(($1::date + time '05:55') at time zone 'Asia/Jakarta')`;
  await asService();
  const n1 = await one(`select public.fn_enqueue_notifications(${pNow})`, [d1]);
  await reset();
  const rows = await q(`select kind, category, title, body, url, actions, dedupe_key, ref_day::text from public.scheduled_notifications where user_id = $1`, [UN]);
  assert.equal(rows.length, 1);
  assert.equal(n1 >= 1, true);
  const r = rows[0];
  assert.equal(r.title, 'Olahraga 20 menit');
  assert.equal(r.category, 'user');
  assert.equal(r.url, '/tumbuh');
  assert.ok(['Pohonmu nunggu disiram. Cuma butuh sebentar.', 'Satu centang lagi buat pohonmu.'].includes(r.body));
  assert.deepEqual(r.actions.map((a) => a.action), ['done', 'snooze10']);
  assert.match(r.dedupe_key, new RegExp(`^routine:.+:${d1}:0600$`));
  assert.equal(r.ref_day, d1);
  // dedupe: jalankan lagi (menit berikutnya)
  await asService();
  await one(`select public.fn_enqueue_notifications(${pNow} + interval '1 minute')`, [d1]);
  await reset();
  assert.equal(num(await one(`select count(*) from public.scheduled_notifications where user_id = $1`, [UN])), 1);
  assert.ok(!/\d{4,}/.test(r.body), 'badan tanpa nominal');
});

await test('jam pengingat diubah setelah masuk antrean → antrean lama dilewati, jam baru tetap diingatkan', async () => {
  const UJ = await newUser('Ubah');
  const d1 = await addDays(await today(), 1);
  const rid = await one(`insert into public.routines(user_id, name, remind_at) values ($1, 'Baca buku', '06:00') returning id`, [UJ]);
  const at = (t) => `(('${d1}'::date + time '${t}') at time zone 'Asia/Jakarta')`;
  await asService();
  await one(`select public.fn_enqueue_notifications(${at('05:55')})`);
  await reset();
  await db.query(`update public.routines set remind_at = '06:30' where id = $1`, [rid]);
  await asService();
  assert.equal((await q(`select * from public.fn_dispatch_candidates(${at('06:00')}) where user_id = '${UJ}'`)).length, 0);
  await one(`select public.fn_enqueue_notifications(${at('06:25')})`);
  const c = await q(`select * from public.fn_dispatch_candidates(${at('06:30')}) where user_id = '${UJ}'`);
  await reset();
  assert.equal(c.length, 1);
  assert.match(c[0].dedupe_key, /:0630$/);
  const st = await q(`select dedupe_key, status from public.scheduled_notifications where user_id = $1 order by dedupe_key`, [UJ]);
  assert.deepEqual(st.map((x) => x.status), ['skipped', 'pending']);   // :0600 usang, :0630 aktif
});

await test('fn_enqueue_notifications: jam tenang hanya untuk sistem; pengingat pengguna tetap', async () => {
  const UQ = await newUser('Tenang');
  const d1 = await addDays(await today(), 1);
  await db.query(`update public.user_settings set quiet_start = '20:00', quiet_end = '23:00' where user_id = $1`, [UQ]);
  await db.query(`insert into public.routines(user_id, name, remind_at) values ($1, 'Catat pengeluaran', '21:00')`, [UQ]);
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '20:55') at time zone 'Asia/Jakarta'))`, [d1]);
  await reset();
  const kinds = (await q(`select kind, category from public.scheduled_notifications where user_id = $1 order by kind`, [UQ]));
  assert.deepEqual(kinds, [{ kind: 'routine', category: 'user' }]);       // expense_nudge 21:00 dilewati (jam tenang)
  // tanpa jam tenang → expense_nudge masuk
  await db.query(`update public.user_settings set quiet_start = '23:00', quiet_end = '05:00' where user_id = $1`, [UQ]);
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '20:56') at time zone 'Asia/Jakarta'))`, [d1]);
  await reset();
  const sys = await q(`select title, url, actions from public.scheduled_notifications where user_id = $1 and kind = 'expense_nudge'`, [UQ]);
  assert.equal(sys.length, 1);
  assert.equal(sys[0].title, 'Catat pengeluaran hari ini?');
  assert.deepEqual(sys[0].actions, [{ action: 'log', title: 'Catat' }]);
});

await test('fn_enqueue_notifications: maks 6 notifikasi sistem per hari; flag system_notif dihormati', async () => {
  const UC = await newUser('Kuliah');
  const d1 = await addDays(await today(), 1);
  const sem = await one(`insert into public.semesters(user_id, number, label, start_date, end_date, is_active)
                         values ($1, 1, 'Ganjil', '2026-01-01', '2027-12-31', true) returning id`, [UC]);
  const wd = await one(`select extract(isodow from $1::date)::int`, [d1]);
  for (let i = 0; i < 8; i++) {
    const c = await one(`insert into public.courses(user_id, semester_id, name, credits) values ($1, $2, $3, 2) returning id`, [UC, sem, `Matkul ${i}`]);
    await db.query(`insert into public.course_schedules(user_id, course_id, weekday, start_time, end_time) values ($1, $2, $3, '08:00', '09:40')`, [UC, c, wd]);
  }
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '07:25') at time zone 'Asia/Jakarta'))`, [d1]);
  await reset();
  const n = num(await one(`select count(*) from public.scheduled_notifications where user_id = $1 and category = 'system'`, [UC]));
  assert.equal(n, 6);
  const t = await one(`select title from public.scheduled_notifications where user_id = $1 and kind = 'class' limit 1`, [UC]);
  assert.match(t, /^Matkul \d$/);
  // flag dimatikan → tidak ada notifikasi kelas
  const UD = await newUser('Mati');
  await db.query(`update public.user_settings set system_notif = system_notif || '{"class":false}' where user_id = $1`, [UD]);
  const sem2 = await one(`insert into public.semesters(user_id, number, label, start_date, end_date, is_active) values ($1, 1, 'G', '2026-01-01', '2027-12-31', true) returning id`, [UD]);
  const c2 = await one(`insert into public.courses(user_id, semester_id, name, credits) values ($1, $2, 'Statistika', 3) returning id`, [UD, sem2]);
  await db.query(`insert into public.course_schedules(user_id, course_id, weekday, start_time, end_time) values ($1, $2, $3, '08:00', '09:40')`, [UD, c2, wd]);
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '07:26') at time zone 'Asia/Jakarta'))`, [d1]);
  await reset();
  assert.equal(num(await one(`select count(*) from public.scheduled_notifications where user_id = $1`, [UD])), 0);
});

await test('fn_enqueue_notifications: ujian H-3 19:00, review mingguan, anggaran 80%/100% sekali per siklus', async () => {
  const UE = await newUser('Ujian');
  const d0 = await today();
  // ujian 3 hari setelah besok → pengingat H-3 besok 19:00
  const d1 = await addDays(d0, 1);
  const sem = await one(`insert into public.semesters(user_id, number, label, start_date, end_date, is_active) values ($1, 1, 'G', '2026-01-01', '2027-12-31', true) returning id`, [UE]);
  const c = await one(`insert into public.courses(user_id, semester_id, name, credits) values ($1, $2, 'Analisis Sistem', 3) returning id`, [UE, sem]);
  await db.query(`insert into public.exams(user_id, course_id, kind, starts_at) values ($1, $2, 'kuis', (($3::date + 3 + time '10:00') at time zone 'Asia/Jakarta'))`, [UE, c, d1]);
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '18:55') at time zone 'Asia/Jakarta'))`, [d1]);
  await reset();
  const ex = await q(`select title, dedupe_key, to_char(fire_at at time zone 'Asia/Jakarta', 'HH24:MI') t from public.scheduled_notifications where user_id = $1 and kind = 'exam'`, [UE]);
  assert.equal(ex.length, 1);
  assert.equal(ex[0].title, 'Kuis Analisis Sistem');
  assert.equal(ex[0].t, '19:00');
  assert.match(ex[0].dedupe_key, /:h3$/);
  // Minggu berikutnya 19:00 → review mingguan
  const sunday = await one(`select ($1::date + (7 - extract(isodow from $1::date)::int))::text`, [d1]);
  await asService();
  await one(`select public.fn_enqueue_notifications((($1::date + time '18:55') at time zone 'Asia/Jakarta'))`, [sunday]);
  await reset();
  const wr = await q(`select title, url from public.scheduled_notifications where user_id = $1 and kind = 'weekly_review'`, [UE]);
  assert.deepEqual(wr, [{ title: 'Review mingguanmu siap', url: '/chat?review=minggu' }]);
  // anggaran: 850rb dari 1jt → budget80; lalu 1,05jt → budget100; tidak berulang
  const w = await one(`select id from public.wallets where user_id = $1`, [UE]);
  await db.query(`insert into public.budgets(user_id, category_id, amount, effective_from) values ($1, null, 1000000, '2020-01-01')`, [UE]);
  await db.query(`insert into public.transactions(user_id, kind, amount, wallet_id) values ($1, 'expense', 850000, $2)`, [UE, w]);
  const at = `(($1::date + time '12:00') at time zone 'Asia/Jakarta')`;
  await asService();
  await one(`select public.fn_enqueue_notifications(${at})`, [d0]);
  await one(`select public.fn_enqueue_notifications(${at} + interval '1 minute')`, [d0]);
  await reset();
  let b = await q(`select dedupe_key, title, body from public.scheduled_notifications where user_id = $1 and kind = 'budget'`, [UE]);
  assert.equal(b.length, 1);
  assert.match(b[0].dedupe_key, /^budget80:/);
  assert.ok(!/\d/.test(b[0].title + b[0].body), 'tanpa nominal');
  await db.query(`insert into public.transactions(user_id, kind, amount, wallet_id) values ($1, 'expense', 200000, $2)`, [UE, w]);
  await asService();
  await one(`select public.fn_enqueue_notifications(${at} + interval '2 minutes')`, [d0]);
  await reset();
  b = await q(`select dedupe_key from public.scheduled_notifications where user_id = $1 and kind = 'budget' order by dedupe_key`, [UE]);
  assert.deepEqual(b.map((x) => x.dedupe_key.split(':')[0]), ['budget100', 'budget80']);
});

await test('fn_dispatch_candidates: klaim sekali, relevansi dicek ulang, kuota & mark', async () => {
  const UX = await newUser('Kirim');
  const d1 = await addDays(await today(), 1);
  const r1 = await one(`insert into public.routines(user_id, name, remind_at) values ($1, 'Rutin A', '06:00') returning id`, [UX]);
  await db.query(`insert into public.routines(user_id, name, remind_at) values ($1, 'Rutin B', '06:00')`, [UX]);
  await db.query(`insert into public.push_subscriptions(user_id, endpoint, p256dh, auth) values ($1, 'https://push.contoh/x', 'k', 'a')`, [UX]);
  const at = (t) => `(('${d1}'::date + time '${t}') at time zone 'Asia/Jakarta')`;
  await asService();
  await one(`select public.fn_enqueue_notifications(${at('05:55')})`);
  await reset();
  // Rutin A diselesaikan sebelum jamnya → dilewati saat dispatch
  await db.query(`insert into public.routine_logs(user_id, routine_id, log_date, value, done) values ($1, $2, $3::date, 1, true)`, [UX, r1, d1]);
  await asService();
  const c1 = await q(`select * from public.fn_dispatch_candidates(${at('06:00')}) where user_id = '${UX}'`);
  assert.equal(c1.length, 1);
  assert.equal(c1[0].title, 'Rutin B');
  assert.equal(c1[0].subscriptions.length, 1);
  assert.equal(c1[0].attempts, 1);
  const again = await q(`select * from public.fn_dispatch_candidates(${at('06:01')}) where user_id = '${UX}'`);
  assert.equal(again.length, 0);                                       // sudah diklaim
  assert.equal(await one(`select public.fn_mark_notification($1, 'failed')`, [c1[0].id]), 'pending');
  const retry = await q(`select * from public.fn_dispatch_candidates(${at('06:02')}) where user_id = '${UX}'`);
  assert.equal(retry.length, 1);
  assert.equal(await one(`select public.fn_mark_notification($1, 'sent')`, [c1[0].id]), 'sent');
  await reset();
  const st = await q(`select title, status from public.scheduled_notifications where user_id = $1 order by title`, [UX]);
  assert.deepEqual(st, [{ title: 'Rutin A', status: 'skipped' }, { title: 'Rutin B', status: 'sent' }]);
  // service role boleh, authenticated tidak
  await as(UX);
  await rejects(db.query(`select * from public.fn_dispatch_candidates()`), /permission denied/);
  await rejects(db.query(`select public.fn_enqueue_notifications()`), /permission denied/);
});

await test('fn_skip_irrelevant: > 2 jam dilewati; sistem melebihi 6 terkirim per hari dilewati', async () => {
  const UO = await newUser('Lama');
  const base = `now() - interval '3 hours'`;
  await db.query(`insert into public.scheduled_notifications(user_id, category, kind, dedupe_key, fire_at, title, body)
                  values ($1, 'user', 'test', 'old:1', ${base}, 'x', 'y')`, [UO]);
  for (let i = 0; i < 6; i++) {
    await db.query(`insert into public.scheduled_notifications(user_id, category, kind, dedupe_key, fire_at, title, body, status, sent_at)
                    values ($1, 'system', 'backup', $2, now(), 'x', 'y', 'sent', now())`, [UO, `s:${i}`]);
  }
  await db.query(`insert into public.scheduled_notifications(user_id, category, kind, dedupe_key, fire_at, title, body)
                  values ($1, 'system', 'backup', 'over', now() - interval '1 minute', 'x', 'y')`, [UO]);
  const hour = await one(`select extract(hour from now() at time zone 'Asia/Jakarta')::int`);
  await asService();
  await one(`select public.fn_skip_irrelevant(now())`);
  await reset();
  assert.equal(await one(`select status from public.scheduled_notifications where user_id = $1 and dedupe_key = 'old:1'`, [UO]), 'skipped');
  if (hour >= 5 && hour < 23) {
    assert.equal(await one(`select status from public.scheduled_notifications where user_id = $1 and dedupe_key = 'over'`, [UO]), 'skipped');
  }
});

await test('fn_daily_maintenance: sekali per hari setelah 00:05; transaksi berulang otomatis tanpa XP; konfirmasi', async () => {
  const UR = await newUser('Berulang');
  const w = await one(`select id from public.wallets where user_id = $1`, [UR]);
  const cat = await one(`select id from public.categories where user_id = $1 and name = 'Kuota'`, [UR]);
  const d0 = await today();
  const yesterday = await addDays(d0, -1);
  await db.query(`insert into public.recurring_rules(user_id, template, freq, next_run, auto_post)
                  values ($1, $2, 'monthly', $3::date, true)`, [UR, JSON.stringify({ kind: 'expense', amount: 50000, wallet_id: w, category_id: cat }), yesterday]);
  await db.query(`insert into public.recurring_rules(user_id, template, freq, next_run, auto_post)
                  values ($1, $2, 'daily', $3::date, false)`, [UR, JSON.stringify({ kind: 'expense', amount: 15000, wallet_id: w, category_id: cat }), d0]);
  await asService();
  assert.equal(await one(`select public.fn_daily_maintenance((($1::date + time '00:01') at time zone 'Asia/Jakarta'))`, [d0]), null);
  await db.query(`delete from public.job_runs`);
  const res = await one(`select public.fn_daily_maintenance((($1::date + time '00:10') at time zone 'Asia/Jakarta'))`, [d0]);
  assert.ok(res);
  assert.equal(await one(`select public.fn_daily_maintenance((($1::date + time '00:11') at time zone 'Asia/Jakarta'))`, [d0]), null);
  await reset();
  assert.equal(num(await one(`select count(*) from public.transactions where user_id = $1 and recurring_rule_id is not null`, [UR])), 1);
  assert.equal(num(await one(`select count(*) from public.xp_events where user_id = $1 and kind = 'tx'`, [UR])), 0);
  const conf = await q(`select title, category from public.scheduled_notifications where user_id = $1 and kind = 'recurring'`, [UR]);
  assert.deepEqual(conf, [{ title: 'Konfirmasi Kuota', category: 'user' }]);
  assert.equal(await one(`select min(next_run)::text from public.recurring_rules where user_id = $1`, [UR]), await addDays(d0, 1));
  // purge: soft delete > 30 hari dihapus permanen
  await db.query(`insert into public.tasks(user_id, title, deleted_at) values ($1, 'lama', now() - interval '40 days')`, [UR]);
  await asService();
  const purge = await one(`select public.fn_purge_daily(now())`);
  await reset();
  assert.ok(purge.purged_rows >= 1);
  assert.ok(Array.isArray(purge.old_chat_files));
  assert.equal(num(await one(`select count(*) from public.tasks where user_id = $1`, [UR])), 0);
});

await test('fn_attendance_mark_for (notif-action "Tandai hadir") & rpc_log_test_notification', async () => {
  const UA = await newUser('Hadir');
  const sem = await one(`insert into public.semesters(user_id, number, label, start_date, end_date, is_active) values ($1, 1, 'G', '2026-01-01', '2027-12-31', true) returning id`, [UA]);
  const c = await one(`insert into public.courses(user_id, semester_id, name, credits) values ($1, $2, 'Pemrograman Web', 3) returning id`, [UA, sem]);
  await asService();
  await one(`select public.fn_attendance_mark_for($1, $2, public.wib_today(), 'hadir')`, [UA, c]);
  await rejects(db.query(`select public.fn_attendance_mark_for($1, $2, public.wib_today(), 'hadir')`, [U1, c]), /Mata kuliah tidak ditemukan/);
  await as(UA);
  assert.equal(await one(`select status from public.attendances`), 'hadir');
  const nid = await one(`select public.rpc_log_test_notification('Waktunya belajar 25 menit', 'Isi', null)`);
  assert.equal(await one(`select status from public.scheduled_notifications where id = $1`, [nid]), 'sent');
});

// =====================================================================================
console.log('\nRPC baca');

await test('rpc_home / rpc_tasks_overview / rpc_schedule_overview / rpc_learning_overview / rpc_week_summary / list', async () => {
  const UH = await newUser('Beranda');
  await as(UH);
  await db.query(`insert into public.tasks(title, priority, due_at) values ('Kuis', 4, now() - interval '1 hour'), ('Esai', 1, now() + interval '5 days'), ('Tanpa', 2, null)`);
  const t = await one(`select public.rpc_tasks_overview()`);
  assert.equal(t.overdue, 1);
  assert.equal(t.top[0].title, 'Kuis');
  assert.equal(t.top[0].score, 110);
  assert.equal(t.top[0].priority_label, 'Kritis');
  const h = await one(`select public.rpc_home()`);
  assert.equal(h.display_name, 'Beranda');
  assert.deepEqual(h.tasks_top.map((x) => x.title), ['Kuis', 'Tanpa']);
  assert.equal(h.level, 1);
  assert.equal(h.xp.need, 100);
  assert.equal(h.streak, 0);
  assert.equal(num(h.balance_total), 0);
  const s = await one(`select public.rpc_schedule_overview()`);
  assert.deepEqual(s.classes_today, []);
  const l = await one(`select public.rpc_learning_overview()`);
  assert.equal(l.minutes_today, 0);
  const w = await one(`select public.rpc_week_summary()`);
  assert.equal(w.tasks.overdue, 1);
  assert.ok(Array.isArray(w.garden.days));
  const up = await one(`select public.rpc_list_upcoming(14)`);
  assert.ok(up.items.length >= 1 && up.items.every((x) => x.type === 'task'));
  assert.ok(up.items.some((x) => x.title === 'Esai'));
  const names = await one(`select public.rpc_list_names('categories')`);
  assert.equal(names.names.length, 15);
  await rejects(db.query(`select public.rpc_list_names('rahasia')`), /Jenis tidak dikenal/);
  const fp = await one(`select public.rpc_finance_period(public.wib_today() - 6, public.wib_today())`);
  assert.equal(num(fp.expense), 0);
  const inv = await one(`select public.rpc_investments_overview()`);
  assert.deepEqual(inv.assets, []);
});

await test('#1/#21/#22 rpc_gpa_summary: IPS 3,56; IPS dibutuhkan; proyeksi', async () => {
  const UG = await newUser('Ipk');
  await as(UG);
  const s1 = await one(`insert into public.semesters(number, label, start_date, end_date) values (1, 'Ganjil', '2025-09-01', '2026-01-31') returning id`);
  await db.query(`insert into public.courses(semester_id, name, credits, final_grade) values ($1, 'A', 3, 'A'), ($1, 'B', 2, 'B'), ($1, 'C', 3, 'B+')`, [s1]);
  let g = await one(`select public.rpc_gpa_summary()`);
  assert.equal(Number(g.ipk), 3.56);
  assert.equal(g.credits_passed, 8);
  // semester aktif 4 SKS tanpa nilai, simulasi A; target 3,65
  await db.query(`update public.user_settings set target_gpa = 3.65`);
  const s2 = await one(`insert into public.semesters(number, label, start_date, end_date, is_active) values (2, 'Genap', '2026-02-01', '2026-07-31', true) returning id`);
  await db.query(`insert into public.courses(semester_id, name, credits, sim_grade) values ($1, 'D', 4, 'A')`, [s2]);
  g = await one(`select public.rpc_gpa_summary()`);
  // projected = (28,5 + 16) / 12 = 3,7083 → 3,71 ; required = (3,65×12 − 28,5)/4 = 3,825 → 3,83
  assert.equal(Number(g.projected), 3.71);
  assert.equal(Number(g.required.display), 3.83);
  assert.equal(g.required.unreachable, false);
  assert.equal(Number(g.ips_sim), 4);
});

await test('PRD §7.1 rpc_gpa_summary: matkul diulang → nilai terbaru menggantikan', async () => {
  const UR = await newUser('Ulang');
  await as(UR);
  const s1 = await one(`insert into public.semesters(number, label, start_date, end_date) values (1, 'S1', '2025-09-01', '2026-01-31') returning id`);
  const s2 = await one(`insert into public.semesters(number, label, start_date, end_date) values (2, 'S2', '2026-02-01', '2026-07-31') returning id`);
  await db.query(`insert into public.courses(semester_id, name, credits, final_grade) values ($1, 'Kalkulus', 3, 'C'), ($1, 'Fisika', 3, 'A')`, [s1]);
  await db.query(`insert into public.courses(semester_id, name, credits, final_grade) values ($1, 'kalkulus ', 3, 'B')`, [s2]);
  let g = await one(`select public.rpc_gpa_summary()`);
  assert.equal(g.credits_passed, 6);
  assert.equal(Number(g.ipk), 3.5);
  // diulang lagi di semester aktif (simulasi A): proyeksi & target tidak memakai nilai lama
  await db.query(`update public.user_settings set target_gpa = 3.9`);
  const s3 = await one(`insert into public.semesters(number, label, start_date, end_date, is_active) values (3, 'S3', '2026-08-01', '2027-01-31', true) returning id`);
  await db.query(`insert into public.courses(semester_id, name, credits, sim_grade) values ($1, 'Kalkulus', 3, 'A')`, [s3]);
  g = await one(`select public.rpc_gpa_summary()`);
  assert.equal(Number(g.ipk), 3.5);
  assert.equal(Number(g.projected), 4);
  assert.equal(Number(g.required.display), 3.8);
});

// =====================================================================================
console.log('\nHapus akun');

await test('hapus auth.users → semua data pengguna terhapus (cascade) tanpa error FK', async () => {
  const before = num(await one(`select count(*) from public.tasks where user_id = $1`, [U1]));
  assert.ok(before > 0);
  await db.query(`delete from auth.users where id = $1`, [U1]);
  for (const t of ['tasks', 'notes', 'wallets', 'categories', 'xp_events', 'user_settings', 'attendances', 'courses']) {
    assert.equal(num(await one(`select count(*) from public.${t} where user_id = $1`, [U1])), 0, t);
  }
  assert.equal(num(await one(`select count(*) from public.profiles where id = $1`, [U1])), 0);
});

// =====================================================================================
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} test SQL lulus${failed.length ? `, ${failed.length} GAGAL` : ''}.`);
await db.close();
process.exit(failed.length ? 1 : 0);
