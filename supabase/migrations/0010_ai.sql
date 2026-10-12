-- =====================================================================================
-- 0010_ai.sql — Hamzi (M9.2)
-- TECH-SPEC §5.6 + §7.2/§7.8.2: rpc_week_summary + RPC baca untuk alat chat (rpc_list_upcoming, rpc_list_names).
-- Semua security invoker (RLS berlaku). Edge Function memanggilnya sebagai pengguna, lalu menyaring sesuai ai_share.
-- =====================================================================================

-- Penghitung kuota ringkasan AI per hari WIB (AI_DAILY_LIMIT). Baris ai_requests di-upsert per cache_key,
-- jadi jumlah panggilan disimpan terpisah: calls (hari calls_day).
alter table public.ai_requests
  add column calls int not null default 0,
  add column calls_day date;

-- ---------- rpc_week_summary(p_week_start) ----------
create or replace function public.rpc_week_summary(p_week_start date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ws date := p_week_start - (extract(isodow from p_week_start)::int - 1);   -- dinormalkan ke Senin
  v_we date;
  v_today date := public.wib_today();
  v_last date;
  v_now timestamptz := now();
  v_days jsonb := '[]'::jsonb;
  v_trees int := 0;
  v_g record;
  v_spent bigint;
  v_held int; v_present int;
  d date;
begin
  v_we := v_ws + 6;
  v_last := least(v_we, v_today);
  d := v_ws;
  while d <= v_last loop
    select * into v_g from public.fn_day_growth(v_uid, d);
    v_days := v_days || jsonb_build_object('day', d, 'level', v_g.level, 'study_min', v_g.study_min,
                                           'required_due', v_g.due, 'required_done', v_g.done);
    if v_g.level = 3 then v_trees := v_trees + 1; end if;
    d := d + 1;
  end loop;

  select coalesce(sum(amount), 0) into v_spent from public.transactions
   where user_id = v_uid and kind = 'expense' and deleted_at is null and occurred_on between v_ws and v_we;
  select count(*), count(*) filter (where a.status = 'hadir') into v_held, v_present
    from public.attendances a where a.user_id = v_uid and a.meeting_date between v_ws and v_we;

  return jsonb_build_object(
    'week_start', v_ws, 'week_end', v_we,
    'tasks', jsonb_build_object(
      'done', (select count(*) from public.tasks t where t.user_id = v_uid and t.deleted_at is null and t.status = 'selesai'
                 and (t.completed_at at time zone 'Asia/Jakarta')::date between v_ws and v_we),
      'overdue', (select count(*) from public.tasks t where t.user_id = v_uid and t.deleted_at is null
                    and t.status not in ('selesai', 'dibatalkan') and t.due_at is not null
                    and case when t.all_day then (t.due_at at time zone 'Asia/Jakarta')::date < v_today else t.due_at < v_now end),
      'due_this_week', (select count(*) from public.tasks t where t.user_id = v_uid and t.deleted_at is null
                          and t.status <> 'dibatalkan' and (t.due_at at time zone 'Asia/Jakarta')::date between v_ws and v_we)),
    'learning', jsonb_build_object(
      'minutes', coalesce((select sum(duration_min) from public.study_sessions
                           where user_id = v_uid and started_on between v_ws and v_we), 0),
      'sessions', (select count(*) from public.study_sessions where user_id = v_uid and started_on between v_ws and v_we),
      'target', coalesce((select sum(weekly_target_min) from public.learning_modules
                          where user_id = v_uid and status = 'aktif' and deleted_at is null), 0)),
    'garden', jsonb_build_object('trees', v_trees, 'days', v_days),
    'garden_trees', v_trees,
    'finance', jsonb_build_object(
      'spent', v_spent,
      'income', coalesce((select sum(amount) from public.transactions where user_id = v_uid and kind = 'income'
                            and deleted_at is null and occurred_on between v_ws and v_we), 0),
      'top_category', (select coalesce(c.name, 'Lainnya') from public.transactions t
                         left join public.categories c on c.id = t.category_id
                        where t.user_id = v_uid and t.kind = 'expense' and t.deleted_at is null
                          and t.occurred_on between v_ws and v_we
                        group by c.name order by sum(t.amount) desc, c.name limit 1),
      'top_categories', coalesce((
        select jsonb_agg(jsonb_build_object('name', x.name, 'amount', x.amount,
                                            'pct', case when v_spent > 0 then public.fn_js_round(x.amount * 100.0 / v_spent) else 0 end)
                         order by x.amount desc)
        from (select coalesce(c.name, 'Lainnya') as name, sum(t.amount) as amount
              from public.transactions t left join public.categories c on c.id = t.category_id
              where t.user_id = v_uid and t.kind = 'expense' and t.deleted_at is null and t.occurred_on between v_ws and v_we
              group by c.name order by sum(t.amount) desc limit 3) x), '[]'::jsonb),
      'budget_used_pct', (public.rpc_finance_daily(v_last)->>'budget_used_pct')::int),
    'attendance', jsonb_build_object('held', v_held, 'present', v_present,
                                     'pct', case when v_held > 0 then public.fn_js_round(v_present * 100.0 / v_held) end),
    'attendance_pct', case when v_held > 0 then public.fn_js_round(v_present * 100.0 / v_held) end
  );
end $$;

-- ---------- rpc_list_upcoming(p_days ≤ 14): tugas, ujian, event, kelas (judul, tanggal, jam) ----------
create or replace function public.rpc_list_upcoming(p_days int default 7)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_from date := public.wib_today();
  v_to date := public.wib_today() + greatest(0, least(coalesce(p_days, 7), 14));
  v_sem uuid := public.fn_active_semester(auth.uid());
  v_res jsonb;
begin
  with items as (
    select 'task'::text as type, t.title::text as title, (t.due_at at time zone 'Asia/Jakarta')::date as date,
           case when t.all_day then null else to_char(t.due_at at time zone 'Asia/Jakarta', 'HH24:MI') end as time,
           null::text as end_time, public.fn_priority_label(t.priority) as detail
    from public.tasks t
    where t.user_id = v_uid and t.deleted_at is null and t.status not in ('selesai', 'dibatalkan')
      and (t.due_at at time zone 'Asia/Jakarta')::date between v_from and v_to
    union all
    select 'exam', public.fn_exam_label(e.kind) || ' ' || c.name, (e.starts_at at time zone 'Asia/Jakarta')::date,
           to_char(e.starts_at at time zone 'Asia/Jakarta', 'HH24:MI'), null, null
    from public.exams e join public.courses c on c.id = e.course_id and c.deleted_at is null
    where e.user_id = v_uid and e.deleted_at is null
      and (e.starts_at at time zone 'Asia/Jakarta')::date between v_from and v_to
    union all
    select 'event', ev.title, greatest((ev.starts_at at time zone 'Asia/Jakarta')::date, v_from),
           case when ev.all_day then null else to_char(ev.starts_at at time zone 'Asia/Jakarta', 'HH24:MI') end,
           case when ev.all_day or ev.ends_at is null then null else to_char(ev.ends_at at time zone 'Asia/Jakarta', 'HH24:MI') end,
           null
    from public.events ev
    where ev.user_id = v_uid and ev.deleted_at is null
      and (ev.starts_at at time zone 'Asia/Jakarta')::date <= v_to
      and coalesce((ev.ends_at at time zone 'Asia/Jakarta')::date, (ev.starts_at at time zone 'Asia/Jakarta')::date) >= v_from
    union all
    select 'class', c.name, dd.d::date, to_char(cs.start_time, 'HH24:MI'), to_char(cs.end_time, 'HH24:MI'), null
    from public.course_schedules cs
    join public.courses c on c.id = cs.course_id and c.deleted_at is null and (v_sem is null or c.semester_id = v_sem)
    cross join generate_series(v_from, v_to, interval '1 day') as dd(d)
    where cs.user_id = v_uid and cs.weekday = extract(isodow from dd.d)::int
  )
  select jsonb_build_object('from', v_from, 'to', v_to, 'items', coalesce(jsonb_agg(jsonb_build_object(
           'type', i.type, 'title', i.title, 'date', i.date, 'day_label', public.fn_rel_day(i.date, v_from),
           'time', i.time, 'end_time', i.end_time, 'detail', i.detail) order by i.date, i.time nulls first, i.type, i.title), '[]'::jsonb))
    into v_res
  from (select * from items limit 300) i;
  return v_res;
end $$;

-- ---------- rpc_list_names(p_type): nama untuk pencocokan (course_name, category_name, goal_name, …) ----------
create or replace function public.rpc_list_names(p_type text)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  if p_type = 'courses' then
    select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'credits', c.credits) order by c.name), '[]'::jsonb) into v_res
      from public.courses c where c.user_id = v_uid and c.deleted_at is null
       and c.semester_id = public.fn_active_semester(v_uid);
  elsif p_type = 'categories' then
    select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'kind', c.kind) order by c.kind, c.sort), '[]'::jsonb) into v_res
      from public.categories c where c.user_id = v_uid and not c.archived;
  elsif p_type = 'goals' then
    select coalesce(jsonb_agg(jsonb_build_object('name', g.name, 'kind', g.kind) order by g.priority), '[]'::jsonb) into v_res
      from public.savings_goals g where g.user_id = v_uid and g.deleted_at is null and g.status = 'aktif';
  elsif p_type = 'modules' then
    select coalesce(jsonb_agg(jsonb_build_object('name', m.title, 'category', m.category) order by m.sort), '[]'::jsonb) into v_res
      from public.learning_modules m where m.user_id = v_uid and m.deleted_at is null and m.status = 'aktif';
  elsif p_type = 'routines' then
    select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'is_required', r.is_required) order by r.sort), '[]'::jsonb) into v_res
      from public.routines r where r.user_id = v_uid and r.deleted_at is null and not r.archived;
  elsif p_type = 'projects' then
    select coalesce(jsonb_agg(jsonb_build_object('name', p.name) order by p.name), '[]'::jsonb) into v_res
      from public.projects p where p.user_id = v_uid and p.deleted_at is null and p.status <> 'selesai';
  else
    raise exception 'Jenis tidak dikenal' using errcode = '22023';
  end if;
  return jsonb_build_object('type', p_type, 'names', v_res);
end $$;

revoke execute on function public.rpc_week_summary(date) from public, anon;
revoke execute on function public.rpc_list_upcoming(int) from public, anon;
revoke execute on function public.rpc_list_names(text) from public, anon;
grant execute on function public.rpc_week_summary(date) to authenticated, service_role;
grant execute on function public.rpc_list_upcoming(int) to authenticated, service_role;
grant execute on function public.rpc_list_names(text) to authenticated, service_role;
