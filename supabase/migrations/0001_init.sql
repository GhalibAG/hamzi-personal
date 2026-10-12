-- =====================================================================================
-- 0001_init.sql — Hamzi (M0.5)
-- TECH-SPEC §5.1: semua tabel inti + trigger WIB (occurred_on/started_on) + wib_today()
-- + trigger updated_at untuk setiap tabel yang memiliki kolom updated_at.
-- Konvensi: uang = bigint rupiah; waktu = timestamptz (UTC); hari WIB = date; 1 = Senin … 7 = Minggu.
-- JANGAN ubah migrasi yang sudah diterapkan; perubahan fungsi = migrasi baru (create or replace).
-- =====================================================================================

create extension if not exists pgcrypto;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create or replace function public.wib_today() returns date
language sql stable as $$ select (now() at time zone 'Asia/Jakarta')::date $$;

-- ===== Profil & pengaturan =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Teman' check (char_length(display_name) between 1 and 40),
  timezone text not null default 'Asia/Jakarta',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light','dark','system')),
  budget_cycle_day smallint not null default 1 check (budget_cycle_day between 1 and 28),
  quiet_start time not null default '23:00',
  quiet_end time not null default '05:00',
  hide_amounts boolean not null default false,
  minimal_mode boolean not null default false,
  eye_mirror boolean not null default false,
  curriculum_credits smallint not null default 144 check (curriculum_credits between 1 and 300),
  target_gpa numeric(3,2) check (target_gpa between 0 and 4),
  default_focus_min smallint not null default 25 check (default_focus_min between 5 and 120),
  water_from_tasks boolean not null default false,
  ai_enabled boolean not null default true,
  ai_chat_enabled boolean not null default true,
  chat_privacy_ack boolean not null default false,
  ai_share jsonb not null default '{
    "tasks":true,"task_titles":true,"courses":true,"learning":true,"routines":true,
    "finance":true,"finance_amounts":true,
    "goals":true,"goals_amounts":false,
    "investments":true,"investments_amounts":false}',
  grade_scale jsonb not null default '{"A":4,"B+":3.5,"B":3,"C+":2.5,"C":2,"D":1,"E":0}',
  grade_ranges jsonb not null default '[["A",85],["B+",80],["B",70],["C+",65],["C",55],["D",40],["E",0]]',
  system_notif jsonb not null default '{"class":true,"exam":true,"expense_nudge":true,"budget":true,
    "weekly_review":true,"goal":true,"backup":true,"valuation":true,"morning_brief":false}',
  last_backup_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ===== Rencana =====
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 1000),
  kind text not null default 'pribadi' check (kind in ('kuliah','pribadi','skill','lomba')),
  status text not null default 'aktif' check (status in ('aktif','ditunda','selesai')),
  color text, due_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  due_date date, status text not null default 'belum' check (status in ('belum','berjalan','selesai')),
  sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ===== Kuliah =====
create table public.semesters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  number smallint not null check (number between 1 and 20),
  label text not null,                        -- "Ganjil 2026/2027"
  start_date date not null, end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create unique index one_active_semester on public.semesters(user_id) where is_active and deleted_at is null;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semester_id uuid not null references public.semesters(id) on delete cascade,
  code text, name text not null check (char_length(name) between 1 and 120),
  credits smallint not null check (credits between 1 and 10),
  lecturer text,                              -- tidak dikirim di mode ringkasan otomatis
  room text, color text,
  target_grade text, min_attendance_pct smallint not null default 75,
  final_grade text,                           -- nilai resmi
  sim_grade text,                             -- pilihan simulasi (KUL-06)
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.course_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null, end_time time not null, room text,
  created_at timestamptz not null default now()
);

create table public.grade_components (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null, weight_pct numeric(5,2) not null check (weight_pct > 0 and weight_pct <= 100),
  score numeric(6,2) check (score between 0 and 100),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  kind text not null check (kind in ('kuis','uts','uas','praktikum')),
  starts_at timestamptz not null, material text check (char_length(material) <= 300), room text,
  prep_status text not null default 'belum' check (prep_status in ('belum','berjalan','siap')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.attendances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  meeting_date date not null,
  status text not null check (status in ('hadir','izin','sakit','alpa')),
  note text check (char_length(note) <= 500),         -- tombol "Catatan" di kelas
  created_at timestamptz not null default now(),
  unique (course_id, meeting_date)
);

-- ===== Tugas =====
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  notes text check (char_length(notes) <= 2000),
  status text not null default 'belum' check (status in ('belum','dikerjakan','selesai','dibatalkan')),
  priority smallint not null default 2 check (priority between 1 and 4),
  source_tag text not null default 'pribadi' check (source_tag in ('kuliah','belajar','keuangan','pribadi','proyek')),
  due_at timestamptz, all_day boolean not null default false,
  project_id uuid references public.projects(id) on delete set null,
  milestone_id uuid references public.milestones(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  course_task_kind text check (course_task_kind in ('individu','kelompok','laporan','presentasi','praktikum')),
  weight_pct smallint check (weight_pct between 0 and 100),
  estimate_min int check (estimate_min between 0 and 1440),
  recurrence jsonb,            -- {"freq":"daily"|"weekly"|"monthly"|"every_n_days","interval":1,"by_day":[1,3],"day_of_month":15} (zod di common/schemas.ts)
  recurrence_parent_id uuid references public.tasks(id) on delete set null,
  remind_offsets int[] not null default '{60}',       -- menit sebelum due_at
  completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

create table public.subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null, done boolean not null default false, sort int not null default 0
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null, starts_at timestamptz not null, ends_at timestamptz, all_day boolean not null default false,
  notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);

-- ===== Rutinitas (RUT) =====
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'check' check (kind in ('check','count')),
  target_count smallint not null default 1 check (target_count between 1 and 50),
  is_required boolean not null default true,
  repeat_days smallint[] not null default '{1,2,3,4,5,6,7}',   -- {1..5}=Sen–Jum, {6,7}=Akhir pekan
  remind_at time, remind_enabled boolean not null default true,
  icon text, color text, sort int not null default 0, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (kind = 'count' or target_count = 1)
);
create table public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  log_date date not null, value smallint not null default 0 check (value >= 0),
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (routine_id, log_date)
);

-- ===== Belajar mandiri (BEL): Modul → Unit =====
create table public.learning_modules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  category text not null default 'lainnya'
    check (category in ('pemrograman','basis_data','statistik','bahasa','sertifikasi','kuliah','lainnya')),
  color_index smallint not null default 0,              -- 0..4 → palet modul DESIGN-SYSTEM §2.1
  weekly_target_min int not null default 120,
  remind_at time, remind_days smallint[] not null default '{1,2,3,4,5,6,7}', remind_enabled boolean not null default true,
  status text not null default 'aktif' check (status in ('aktif','ditunda','selesai')),
  template_key text, sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.learning_units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  module_id uuid not null references public.learning_modules(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'bacaan' check (kind in ('video','bacaan','latihan','proyek','kuis')),
  url text, est_min int not null default 30,
  status text not null default 'belum' check (status in ('belum','sedang','selesai')),
  notes text, completed_at timestamptz, sort int not null default 0
);
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),               -- dibuat klien
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null, duration_min int not null check (duration_min between 1 and 720),
  started_on date not null default public.wib_today(),        -- ditimpa trigger WIB
  module_id uuid references public.learning_modules(id) on delete set null,
  unit_id uuid references public.learning_units(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  source text not null default 'timer' check (source in ('timer','manual'))
);

-- ===== Pohon (TUM) & gamifikasi =====
create table public.water_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source text not null check (source in ('routine','study','task')),
  ref_id uuid not null, day date not null,
  created_at timestamptz not null default now(),
  unique (user_id, source, ref_id, day)
);
create table public.user_stats (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  xp_total int not null default 0, level int not null default 1,
  updated_at timestamptz not null default now()
);
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,          -- task|routine|all_required|study|tx|weekly_target|goal_25|goal_50|goal_75|goal_100
  ref_id uuid not null,        -- id objek; bila tidak ada objek pakai user_id
  day date not null, xp int not null,
  unique (user_id, kind, ref_id, day)
);

-- ===== Keuangan =====
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'cash' check (kind in ('cash','bank','ewallet','other')),
  icon text, color text, opening_balance bigint not null default 0,
  is_default boolean not null default false,
  archived boolean not null default false, sort int not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income')),
  name text not null check (char_length(name) between 1 and 24), icon text, color text, sort int not null default 0,
  archived boolean not null default false, is_default boolean not null default false
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('expense','income','transfer','adjustment')),
  amount bigint not null check (amount > 0),
  direction smallint not null default 1 check (direction in (-1,1)),   -- hanya bermakna untuk adjustment (+/−)
  wallet_id uuid not null references public.wallets(id),
  to_wallet_id uuid references public.wallets(id),
  category_id uuid references public.categories(id),
  occurred_at timestamptz not null default now(),
  occurred_on date not null default public.wib_today(),          -- ditimpa trigger WIB
  note text check (char_length(note) <= 140),
  recurring_rule_id uuid,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check ((kind = 'transfer') = (to_wallet_id is not null)),
  check (kind = 'adjustment' or direction = 1)
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete cascade,   -- null = total
  amount bigint not null check (amount >= 0),
  effective_from date not null
);
create unique index budgets_unique on public.budgets
  (user_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), effective_from);
create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  template jsonb not null, freq text not null check (freq in ('daily','weekly','monthly')),
  interval_n smallint not null default 1, by_day smallint[], day_of_month smallint,
  next_run date not null, auto_post boolean not null default false, active boolean not null default true
);

-- ===== Target & investasi =====
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null, kind text not null default 'lainnya'
    check (kind in ('dana_darurat','barang','pendidikan','investasi','lainnya')),
  target_amount bigint not null check (target_amount > 0), due_date date,
  icon text, color text, priority smallint not null default 2,
  assumed_return_pct numeric(5,2) not null default 0,
  status text not null default 'aktif' check (status in ('aktif','selesai','dibatalkan')),
  emergency_months smallint, monthly_plan bigint, plan_day smallint check (plan_day between 1 and 28),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz
);
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  amount bigint not null check (amount <> 0), contributed_at date not null default public.wib_today(),
  note text check (char_length(note) <= 140), deleted_at timestamptz
);
create table public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  asset_class text not null check (asset_class in
    ('rd_pasar_uang','rd_obligasi','rd_campuran','rd_saham','emas','saham','kripto','deposito','lainnya')),
  platform_label text, archived boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.asset_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  kind text not null check (kind in ('beli','jual','setor','tarik')),
  amount bigint not null check (amount > 0), occurred_on date not null default public.wib_today()
);
create table public.asset_valuations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  valued_on date not null, value bigint not null check (value >= 0),
  unique (asset_id, valued_on)
);

-- ===== Notifikasi =====
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth text not null,
  user_agent text, created_at timestamptz not null default now()
);
create table public.scheduled_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('user','system')),
  kind text not null,          -- routine|module|task|class|exam|expense_nudge|budget|weekly_review|goal|backup|valuation|morning_brief|test
  ref_type text,               -- routine|learning_module|task|course_schedule|exam|savings_goal|null
  ref_id uuid,
  dedupe_key text not null,    -- mis. 'routine:{id}:2026-10-12', 'expense_nudge:2026-10-12', 'budget80:2026-10-01', 'snooze:{nid}'
  fire_at timestamptz not null,
  title text not null, body text not null, url text not null default '/',
  actions jsonb not null default '[]',        -- [{"action":"done","title":"Tandai selesai"}, ...] maks 2
  status text not null default 'pending' check (status in ('pending','sent','failed','skipped')),
  attempts smallint not null default 0, sent_at timestamptz, read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

-- ===== AI =====
create table public.ai_requests (                -- ringkasan otomatis (Kata Hamzi, review)
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null, cache_key text not null,
  payload jsonb not null, response jsonb, provider text, model text,
  tokens_in int, tokens_out int,
  status text not null check (status in ('ok','cached','error','fallback')),
  error text, feedback smallint check (feedback in (-1,1)),
  created_at timestamptz not null default now(),
  unique (user_id, cache_key)
);

-- =====================================================================================
-- Trigger WIB (TECH-SPEC §5.1 lanjutan)
-- =====================================================================================
create or replace function public.set_occurred_on() returns trigger language plpgsql as $$
begin new.occurred_on := (new.occurred_at at time zone 'Asia/Jakarta')::date; return new; end $$;
create trigger trg_tx_on before insert or update of occurred_at on public.transactions
  for each row execute function public.set_occurred_on();

create or replace function public.set_started_on() returns trigger language plpgsql as $$
begin new.started_on := (new.started_at at time zone 'Asia/Jakarta')::date; return new; end $$;
create trigger trg_ss_on before insert or update of started_at on public.study_sessions
  for each row execute function public.set_started_on();

-- updated_at: trigger set_updated_at untuk SETIAP tabel public yang memiliki kolom updated_at.
-- (Tabel chat di 0011 menambahkan trigger-nya sendiri.)
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format('create trigger trg_%s_updated_at before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;
