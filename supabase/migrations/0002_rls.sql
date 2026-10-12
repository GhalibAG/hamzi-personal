-- =====================================================================================
-- 0002_rls.sql — Hamzi (M0.5)
-- TECH-SPEC §5.3 RLS "own rows" di setiap tabel + §5.4 indeks + §5.2 handle_new_user (seed pendaftaran).
-- =====================================================================================

-- ---------- §5.3 RLS ----------
do $$
declare t text;
begin
  foreach t in array array[
    'user_settings','projects','milestones','semesters','courses','course_schedules','grade_components','exams',
    'attendances','tasks','subtasks','events','routines','routine_logs','learning_modules','learning_units',
    'study_sessions','water_events','user_stats','xp_events','wallets','categories','transactions','budgets',
    'recurring_rules','savings_goals','goal_contributions','assets','asset_transactions','asset_valuations',
    'push_subscriptions','ai_requests'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Hak tabel eksplisit (setara default Supabase; RLS tetap membatasi baris milik sendiri).
-- anon tidak membutuhkan akses tabel apa pun (rpc_ping adalah fungsi).
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
revoke all on all tables in schema public from anon;
-- Buku besar gamifikasi hanya berubah lewat RPC atomik / trigger (TECH-SPEC §5.5, ADR #12): klien hanya membaca.
revoke insert, update, delete on public.water_events, public.xp_events, public.user_stats from authenticated;

alter table public.scheduled_notifications enable row level security;
create policy "read own" on public.scheduled_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mark read own" on public.scheduled_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- insert/delete hanya oleh service role (Edge Function).
-- Pengetatan: klien hanya boleh mengubah kolom read_at (kotak notifikasi /notifikasi).
revoke insert, update, delete on public.scheduled_notifications from anon, authenticated;
grant update (read_at) on public.scheduled_notifications to authenticated;

-- Pengaman: tabel tanpa RLS = bug. Gagal keras bila ada tabel public tanpa RLS saat migrasi ini.
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'Tabel public.% belum memakai RLS', t;
  end loop;
end $$;

-- ---------- §5.4 Indeks ----------
create index on public.tasks (user_id, status, due_at) where deleted_at is null;
create index on public.tasks (user_id, course_id) where deleted_at is null;
create index on public.tasks (recurrence_parent_id) where recurrence_parent_id is not null;
create index on public.transactions (user_id, occurred_on desc) where deleted_at is null;
create index on public.transactions (user_id, category_id, occurred_on) where deleted_at is null;
create index on public.study_sessions (user_id, started_on);
create index on public.routine_logs (user_id, log_date);
create index on public.water_events (user_id, day);
create index on public.xp_events (user_id, kind, day);
create index on public.scheduled_notifications (status, fire_at) where status = 'pending';
create index on public.scheduled_notifications (user_id, sent_at desc) where status = 'sent';
create index on public.exams (user_id, starts_at) where deleted_at is null;
create index on public.goal_contributions (goal_id, contributed_at);
create index on public.asset_valuations (asset_id, valued_on desc);

-- ---------- §5.2 Seed saat pendaftaran ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, left(coalesce(nullif(btrim(new.raw_user_meta_data->>'name'), ''), 'Teman'), 40));
  insert into public.user_settings(user_id) values (new.id);
  insert into public.user_stats(user_id) values (new.id);
  insert into public.wallets(user_id, name, kind, icon, color, sort, is_default)
    values (new.id,'Tunai','cash','wallet','#12B76A',0,true);
  insert into public.categories(user_id, kind, name, icon, color, sort, is_default)
  select new.id, v.k, v.n, v.i, v.c, v.s, true from (values
    ('expense','Makan','utensils','#12B76A',1),
    ('expense','Transport','bus','#2E90FA',2),
    ('expense','Kuota','wifi','#7A5AF8',3),
    ('expense','Belanja','bag','#EE46BC',4),
    ('expense','Kos & Tagihan','home','#F79009',5),
    ('expense','Pendidikan','cap','#6938EF',6),
    ('expense','Kesehatan','heart','#F04438',7),
    ('expense','Hiburan','play','#06AED4',8),
    ('expense','Sosial','hand','#039855',9),
    ('expense','Lainnya','dots','#98A5A0',10),
    ('income','Kiriman','gift','#12B76A',1),
    ('income','Gaji','banknote','#039855',2),
    ('income','Usaha','store','#F79009',3),
    ('income','Bonus','star','#EE46BC',4),
    ('income','Lainnya','dots','#98A5A0',5)
  ) as v(k,n,i,c,s);
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
