-- =====================================================================================
-- 0005_growth.sql — Hamzi (M3.1–M3.2)
-- TECH-SPEC §5.5/§5.6: fn_level_from_xp + trigger user_stats, fn_routine_set_for/rpc_routine_set,
-- fn_study_finish_for/rpc_study_finish, rpc_unit_set_status, fn_tree_stage, fn_garden_level, fn_streak,
-- rpc_growth_overview, rpc_garden_month, rpc_learning_overview.
-- Versi SQL dari common/calc/{xp,growth}.ts — wajib lulus test vector §13 yang sama (tests/sql/run.mjs).
-- =====================================================================================

-- ---------- XP & level (PRD §7.8) ----------
create or replace function public.fn_level_from_xp(p_xp int) returns int language plpgsql immutable as $$
declare lvl int := 1; need int := 100; rest int := greatest(p_xp,0);
begin
  while rest >= need loop rest := rest - need; lvl := lvl + 1; need := 100 + 50*(lvl-1); end loop;
  return lvl;
end $$;

-- xpProgress: { level, into, need, pct }
create or replace function public.fn_xp_progress(p_xp int) returns jsonb language plpgsql immutable as $$
declare lvl int := 1; need int := 100; rest int := greatest(p_xp, 0);
begin
  while rest >= need loop rest := rest - need; lvl := lvl + 1; need := 100 + 50*(lvl-1); end loop;
  return jsonb_build_object('level', lvl, 'into', rest, 'need', need, 'pct', public.fn_js_round(rest * 100.0 / need));
end $$;

-- user_stats = Σ xp_events (trigger after insert/update/delete).
create or replace function public.trg_xp_events_stats() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := coalesce(new.user_id, old.user_id); v_total int;
begin
  select coalesce(sum(xp), 0)::int into v_total from public.xp_events where user_id = v_uid;
  if tg_op = 'DELETE' then
    -- hanya update: saat akun dihapus (cascade) baris user_stats/auth.users sudah tidak ada
    update public.user_stats set xp_total = v_total, level = public.fn_level_from_xp(v_total) where user_id = v_uid;
  else
    insert into public.user_stats(user_id, xp_total, level) values (v_uid, v_total, public.fn_level_from_xp(v_total))
    on conflict (user_id) do update set xp_total = excluded.xp_total, level = excluded.level;
  end if;
  if tg_op = 'UPDATE' and old.user_id is distinct from new.user_id then
    select coalesce(sum(xp), 0)::int into v_total from public.xp_events where user_id = old.user_id;
    update public.user_stats set xp_total = v_total, level = public.fn_level_from_xp(v_total) where user_id = old.user_id;
  end if;
  return null;
end $$;
revoke execute on function public.trg_xp_events_stats() from public, anon, authenticated;
create trigger trg_xp_events_stats after insert or update or delete on public.xp_events
  for each row execute function public.trg_xp_events_stats();

-- ---------- Pohon, kebun, streak (PRD §7.11–7.13) ----------
-- TREE_THRESHOLDS = [0,5,15,30,50,80]; TREE_NAMES = Biji, Tunas, Bibit, Pohon muda, Pohon rindang, Pohon berbuah
create or replace function public.fn_tree_stage(p_water int) returns jsonb language plpgsql immutable as $$
declare
  th int[] := array[0, 5, 15, 30, 50, 80];
  nm text[] := array['Biji','Tunas','Bibit','Pohon muda','Pohon rindang','Pohon berbuah'];
  w int := greatest(coalesce(p_water, 0), 0);
  i int := 1;
begin
  for k in 1 .. 6 loop if w >= th[k] then i := k; end if; end loop;
  if i = 6 then
    return jsonb_build_object('index', 5, 'name', nm[6], 'progress_pct', 100, 'to_next', 0, 'next_name', null, 'next_threshold', null);
  end if;
  return jsonb_build_object(
    'index', i - 1, 'name', nm[i],
    'progress_pct', public.fn_js_round((w - th[i]) * 100.0 / (th[i+1] - th[i])),
    'to_next', th[i+1] - w, 'next_name', nm[i+1], 'next_threshold', th[i+1]);
end $$;

-- Level kebun harian 0..3: w = wajib terjadwal, s = terpenuhi, study_min = total menit belajar hari itu.
create or replace function public.fn_garden_level(w int, s int, study_min int) returns int language sql immutable as $$
  select case
    when coalesce(w, 0) = 0 then case when coalesce(study_min, 0) >= 10 then 3 else 0 end
    when coalesce(s, 0) <= 0 then 0
    when s >= w then 3
    when s * 2 >= w then 2
    else 1 end $$;

create or replace function public.fn_has_bloom(p_level int, p_study_min int) returns boolean language sql immutable as $$
  select p_level = 3 and coalesce(p_study_min, 0) >= 10 $$;

-- Ringkasan satu hari WIB untuk pengguna. Security invoker: dari klien, RLS membatasi ke baris sendiri.
-- W memakai rutinitas wajib aktif (tidak diarsip/dihapus) yang terjadwal di hari itu dan sudah dibuat pada hari itu.
create or replace function public.fn_day_growth(p_uid uuid, p_date date,
  out due int, out done int, out study_min int, out level int, out bloom boolean, out qualifies boolean)
language plpgsql stable set search_path = public as $$
begin
  select count(*)::int, count(l.routine_id)::int into due, done
  from public.routines r
  left join public.routine_logs l on l.routine_id = r.id and l.log_date = p_date and l.done
  where r.user_id = p_uid and r.is_required and not r.archived and r.deleted_at is null
    and extract(isodow from p_date)::int = any (r.repeat_days)
    and (r.created_at at time zone 'Asia/Jakarta')::date <= p_date;
  select coalesce(sum(s.duration_min), 0)::int into study_min
  from public.study_sessions s where s.user_id = p_uid and s.started_on = p_date;
  level := public.fn_garden_level(due, done, study_min);
  bloom := public.fn_has_bloom(level, study_min);
  qualifies := level = 3 or study_min >= 10;
end $$;

-- Streak (PRD §7.13): hari berturut-turut memenuhi syarat sampai kemarin, +1 bila hari ini memenuhi.
create or replace function public.fn_streak(p_date date default public.wib_today(), p_uid uuid default auth.uid())
returns int language plpgsql stable set search_path = public as $$
declare n int := 0; d date := p_date - 1;
begin
  if p_uid is null then return 0; end if;
  for i in 1 .. 400 loop
    exit when not (select g.qualifies from public.fn_day_growth(p_uid, d) g);
    n := n + 1; d := d - 1;
  end loop;
  if (select g.qualifies from public.fn_day_growth(p_uid, p_date) g) then n := n + 1; end if;
  return n;
end $$;

create or replace function public.fn_water_total(p_uid uuid) returns int language sql stable set search_path = public as $$
  select count(*)::int from public.water_events where user_id = p_uid $$;

-- ---------- RPC tulis: rutinitas (TECH-SPEC §5.5) ----------
create or replace function public.fn_routine_set_for(p_uid uuid, p_routine_id uuid, p_date date, p_value int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r public.routines%rowtype;
  v_value int;
  v_done boolean;
  v_was boolean;
  v_g record;
  v_water int;
begin
  if p_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  if p_date is null or p_date > public.wib_today() + 1 then
    raise exception 'Tanggal tidak valid' using errcode = '22023';
  end if;
  select * into r from public.routines where id = p_routine_id and user_id = p_uid and deleted_at is null;
  if not found then raise exception 'Rutinitas tidak ditemukan' using errcode = 'P0002'; end if;

  v_value := greatest(0, least(coalesce(p_value, 0), r.target_count));
  v_done := v_value >= r.target_count;

  select l.done into v_was from public.routine_logs l where l.routine_id = r.id and l.log_date = p_date for update;
  v_was := coalesce(v_was, false);

  insert into public.routine_logs(user_id, routine_id, log_date, value, done)
  values (p_uid, r.id, p_date, v_value, v_done)
  on conflict (routine_id, log_date) do update set value = excluded.value, done = excluded.done;

  if v_done and not v_was then
    insert into public.water_events(user_id, source, ref_id, day) values (p_uid, 'routine', r.id, p_date)
      on conflict (user_id, source, ref_id, day) do nothing;
    insert into public.xp_events(user_id, kind, ref_id, day, xp) values (p_uid, 'routine', r.id, p_date, 5)
      on conflict (user_id, kind, ref_id, day) do nothing;
  elsif not v_done and v_was then
    delete from public.water_events where user_id = p_uid and source = 'routine' and ref_id = r.id and day = p_date;
    delete from public.xp_events where user_id = p_uid and kind = 'routine' and ref_id = r.id and day = p_date;
  end if;

  -- Bonus semua rutinitas wajib hari itu selesai (+10, ref = user_id), ditarik bila kembali tidak lengkap.
  select * into v_g from public.fn_day_growth(p_uid, p_date);
  if v_g.due > 0 and v_g.done = v_g.due then
    insert into public.xp_events(user_id, kind, ref_id, day, xp) values (p_uid, 'all_required', p_uid, p_date, 10)
      on conflict (user_id, kind, ref_id, day) do nothing;
  else
    delete from public.xp_events where user_id = p_uid and kind = 'all_required' and ref_id = p_uid and day = p_date;
  end if;

  v_water := public.fn_water_total(p_uid);
  return jsonb_build_object(
    'done', v_done, 'value', v_value, 'water_total', v_water,
    'stage', public.fn_tree_stage(v_water)->>'name', 'stage_index', (public.fn_tree_stage(v_water)->>'index')::int,
    'garden_level_today', v_g.level, 'all_required', v_g.due > 0 and v_g.done = v_g.due);
end $$;
revoke execute on function public.fn_routine_set_for(uuid, uuid, date, int) from public, anon, authenticated;
grant execute on function public.fn_routine_set_for(uuid, uuid, date, int) to service_role;

create or replace function public.rpc_routine_set(p_routine_id uuid, p_date date, p_value int)
returns jsonb language sql security definer set search_path = public as $$
  select public.fn_routine_set_for(auth.uid(), p_routine_id, p_date, p_value) $$;
revoke execute on function public.rpc_routine_set(uuid, date, int) from public, anon;
grant execute on function public.rpc_routine_set(uuid, date, int) to authenticated;

-- ---------- RPC tulis: sesi belajar (TECH-SPEC §5.5) ----------
create or replace function public.fn_study_finish_for(p_uid uuid, p_id uuid, p_started_at timestamptz, p_duration_min int,
  p_module_id uuid default null, p_unit_id uuid default null, p_source text default 'timer')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
  v_dur int := greatest(1, least(coalesce(p_duration_min, 0), 720));
  v_day date;
  v_awarded boolean := false;
  v_xp_today int;
  v_xp int;
  v_ws date;
  v_week_min int;
  v_target int;
  v_water int;
begin
  if p_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  if p_id is null or p_started_at is null then raise exception 'Sesi tidak valid' using errcode = '22023'; end if;
  if p_module_id is not null and not exists (select 1 from public.learning_modules where id = p_module_id and user_id = p_uid) then
    raise exception 'Modul tidak ditemukan' using errcode = 'P0002';
  end if;
  if p_unit_id is not null and not exists (select 1 from public.learning_units where id = p_unit_id and user_id = p_uid) then
    raise exception 'Unit tidak ditemukan' using errcode = 'P0002';
  end if;

  select user_id into v_owner from public.study_sessions where id = p_id;
  if v_owner is not null and v_owner <> p_uid then raise exception 'Sesi tidak valid' using errcode = '42501'; end if;

  insert into public.study_sessions(id, user_id, started_at, duration_min, module_id, unit_id, source)
  values (p_id, p_uid, p_started_at, v_dur, p_module_id, p_unit_id,
          case when p_source = 'manual' then 'manual' else 'timer' end)
  on conflict (id) do nothing;                         -- idempoten (outbox mengirim ulang)
  select started_on, duration_min into v_day, v_dur from public.study_sessions where id = p_id;

  -- Tetes air: setiap sesi ≥ 10 menit, maks 3 per hari (STUDY_WATER_MIN / STUDY_WATER_MAX_PER_DAY).
  if v_dur >= 10 and (select count(*) from public.water_events
                      where user_id = p_uid and source = 'study' and day = v_day and ref_id <> p_id) < 3 then
    insert into public.water_events(user_id, source, ref_id, day) values (p_uid, 'study', p_id, v_day)
      on conflict (user_id, source, ref_id, day) do nothing;
    v_awarded := found;
  end if;

  -- XP: 1 per 5 menit, maks 60 per hari.
  select coalesce(sum(xp), 0)::int into v_xp_today from public.xp_events
  where user_id = p_uid and kind = 'study' and day = v_day and ref_id <> p_id;
  v_xp := least(v_dur / 5, 60 - v_xp_today);
  if v_xp > 0 then
    insert into public.xp_events(user_id, kind, ref_id, day, xp) values (p_uid, 'study', p_id, v_day, v_xp)
      on conflict (user_id, kind, ref_id, day) do nothing;
  end if;

  -- Target belajar mingguan (+50, ref = user_id, day = Senin minggu itu).
  v_ws := v_day - (extract(isodow from v_day)::int - 1);
  select coalesce(sum(duration_min), 0)::int into v_week_min from public.study_sessions
  where user_id = p_uid and started_on between v_ws and v_ws + 6;
  select coalesce(sum(weekly_target_min), 0)::int into v_target from public.learning_modules
  where user_id = p_uid and status = 'aktif' and deleted_at is null;
  if v_target > 0 and v_week_min >= v_target then
    insert into public.xp_events(user_id, kind, ref_id, day, xp) values (p_uid, 'weekly_target', p_uid, v_ws, 50)
      on conflict (user_id, kind, ref_id, day) do nothing;
  end if;

  v_water := public.fn_water_total(p_uid);
  return jsonb_build_object(
    'water_awarded', v_awarded, 'water_total', v_water, 'xp', greatest(v_xp, 0),
    'stage', public.fn_tree_stage(v_water)->>'name', 'stage_index', (public.fn_tree_stage(v_water)->>'index')::int);
end $$;
revoke execute on function public.fn_study_finish_for(uuid, uuid, timestamptz, int, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_study_finish_for(uuid, uuid, timestamptz, int, uuid, uuid, text) to service_role;

create or replace function public.rpc_study_finish(p_id uuid, p_started_at timestamptz, p_duration_min int,
  p_module_id uuid default null, p_unit_id uuid default null, p_source text default 'timer')
returns jsonb language sql security definer set search_path = public as $$
  select public.fn_study_finish_for(auth.uid(), p_id, p_started_at, p_duration_min, p_module_id, p_unit_id, p_source) $$;
revoke execute on function public.rpc_study_finish(uuid, timestamptz, int, uuid, uuid, text) from public, anon;
grant execute on function public.rpc_study_finish(uuid, timestamptz, int, uuid, uuid, text) to authenticated;

-- ---------- RPC tulis: status unit belajar ----------
create or replace function public.fn_unit_set_status_for(p_uid uuid, p_unit_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  if p_status not in ('belum', 'sedang', 'selesai') then raise exception 'Status tidak valid' using errcode = '22023'; end if;
  update public.learning_units
     set status = p_status,
         completed_at = case when p_status = 'selesai' then coalesce(completed_at, now()) else null end
   where id = p_unit_id and user_id = p_uid;
  if not found then raise exception 'Unit tidak ditemukan' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;
revoke execute on function public.fn_unit_set_status_for(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.fn_unit_set_status_for(uuid, uuid, text) to service_role;

create or replace function public.rpc_unit_set_status(p_unit_id uuid, p_status text)
returns jsonb language sql security definer set search_path = public as $$
  select public.fn_unit_set_status_for(auth.uid(), p_unit_id, p_status) $$;
revoke execute on function public.rpc_unit_set_status(uuid, text) from public, anon;
grant execute on function public.rpc_unit_set_status(uuid, text) to authenticated;

-- ---------- RPC baca ----------
create or replace function public.rpc_growth_overview(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_water int := public.fn_water_total(auth.uid());
  v_stage jsonb := public.fn_tree_stage(public.fn_water_total(auth.uid()));
  v_g record;
begin
  select * into v_g from public.fn_day_growth(v_uid, p_date);
  return jsonb_build_object(
    'date', p_date,
    'water_total', v_water,
    'stage_index', (v_stage->>'index')::int, 'stage_name', v_stage->>'name',
    'progress_pct', (v_stage->>'progress_pct')::int, 'to_next', (v_stage->>'to_next')::int,
    'next_name', v_stage->'next_name', 'next_threshold', v_stage->'next_threshold',
    'required_due', v_g.due, 'required_done', v_g.done,
    'garden_level_today', v_g.level, 'bloom_today', v_g.bloom, 'study_min_today', v_g.study_min,
    'streak', public.fn_streak(p_date, v_uid));
end $$;

-- Kebun satu bulan: level −1 untuk hari setelah hari ini; tree_count = hari level 3.
create or replace function public.rpc_garden_month(p_month date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_first date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
  v_today date := public.wib_today();
  v_days jsonb := '[]'::jsonb;
  v_trees int := 0;
  v_g record;
  d date;
begin
  d := v_first;
  while d <= v_last loop
    if d > v_today then
      v_days := v_days || jsonb_build_object('day', d, 'level', -1, 'bloom', false);
    else
      select * into v_g from public.fn_day_growth(v_uid, d);
      v_days := v_days || jsonb_build_object('day', d, 'level', v_g.level, 'bloom', v_g.bloom);
      if v_g.level = 3 then v_trees := v_trees + 1; end if;
    end if;
    d := d + 1;
  end loop;
  return jsonb_build_object('month', to_char(v_first, 'YYYY-MM'), 'days', v_days, 'tree_count', v_trees);
end $$;

create or replace function public.rpc_learning_overview(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ws date := p_date - (extract(isodow from p_date)::int - 1);
  v_res jsonb;
begin
  select jsonb_build_object(
    'date', p_date, 'week_start', v_ws,
    'minutes_today', coalesce((select sum(duration_min) from public.study_sessions where user_id = v_uid and started_on = p_date), 0),
    'minutes_week', coalesce((select sum(duration_min) from public.study_sessions
                              where user_id = v_uid and started_on between v_ws and v_ws + 6), 0),
    'weekly_target_min', coalesce((select sum(weekly_target_min) from public.learning_modules
                                   where user_id = v_uid and status = 'aktif' and deleted_at is null), 0),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'category', m.category, 'color_index', m.color_index,
        'weekly_target_min', m.weekly_target_min,
        'remind_at', to_char(m.remind_at, 'HH24:MI'), 'remind_enabled', m.remind_enabled,
        'done', (select count(*) from public.learning_units u where u.module_id = m.id and u.status = 'selesai'),
        'total', (select count(*) from public.learning_units u where u.module_id = m.id),
        'minutes_week', coalesce((select sum(s.duration_min) from public.study_sessions s
                                  where s.module_id = m.id and s.started_on between v_ws and v_ws + 6), 0),
        'studied_today', exists (select 1 from public.study_sessions s where s.module_id = m.id and s.started_on = p_date),
        'next_unit', (select u.title from public.learning_units u where u.module_id = m.id and u.status <> 'selesai'
                      order by u.sort, u.title limit 1)
      ) order by m.sort, m.created_at)
      from public.learning_modules m
      where m.user_id = v_uid and m.status = 'aktif' and m.deleted_at is null), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

revoke execute on function public.rpc_growth_overview(date) from public, anon;
revoke execute on function public.rpc_garden_month(date) from public, anon;
revoke execute on function public.rpc_learning_overview(date) from public, anon;
grant execute on function public.rpc_growth_overview(date) to authenticated, service_role;
grant execute on function public.rpc_garden_month(date) to authenticated, service_role;
grant execute on function public.rpc_learning_overview(date) to authenticated, service_role;
