-- =====================================================================================
-- 0004_home.sql — Hamzi (M2.5)
-- TECH-SPEC §5.6 RPC baca agregat: rpc_tasks_overview, rpc_schedule_overview, rpc_home (versi awal).
-- Semua RPC baca: security invoker + stable → RLS tetap berlaku. Dipakai UI dan alat AI (Edge Function).
-- =====================================================================================

-- ---------- Helper format (setara common/format.ts & features/tasks/derive.ts) ----------
create or replace function public.fn_hari(p_d date) returns text language sql immutable as $$
  select (array['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'])[extract(isodow from p_d)::int] $$;

-- "Selasa 20 Okt" (dayLabel)
create or replace function public.fn_day_label(p_d date) returns text language sql immutable as $$
  select public.fn_hari(p_d) || ' ' || extract(day from p_d)::int || ' ' ||
         (array['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'])[extract(month from p_d)::int] $$;

-- "Hari ini" / "Besok" / "Kemarin" / "Selasa 20 Okt" (relDay)
create or replace function public.fn_rel_day(p_d date, p_today date) returns text language sql immutable as $$
  select case p_d - p_today when 0 then 'Hari ini' when 1 then 'Besok' when -1 then 'Kemarin'
         else public.fn_day_label(p_d) end $$;

-- "Besok 19:00" / "Hari ini" (seharian) / "Tanpa tenggat" (dueLabel)
create or replace function public.fn_due_label(p_due timestamptz, p_all_day boolean, p_today date) returns text
language sql immutable as $$
  select case when p_due is null then 'Tanpa tenggat'
    when p_all_day then public.fn_rel_day((p_due at time zone 'Asia/Jakarta')::date, p_today)
    else public.fn_rel_day((p_due at time zone 'Asia/Jakarta')::date, p_today) || ' ' ||
         to_char(p_due at time zone 'Asia/Jakarta', 'HH24:MI') end $$;

-- pagi 04–10, siang 10–15, sore 15–18, malam (common/lines.id.ts partOfDay)
create or replace function public.fn_part_of_day(p_min int) returns text language sql immutable as $$
  select case when p_min >= 240 and p_min < 600 then 'pagi' when p_min >= 600 and p_min < 900 then 'siang'
              when p_min >= 900 and p_min < 1080 then 'sore' else 'malam' end $$;

create or replace function public.fn_wib_minutes(p_at timestamptz) returns int language sql immutable as $$
  select (extract(hour from p_at at time zone 'Asia/Jakarta') * 60 + extract(minute from p_at at time zone 'Asia/Jakarta'))::int $$;

-- Instan acuan untuk tanggal p_date: sekarang bila hari ini, selain itu 12:00 WIB tanggal itu.
create or replace function public.fn_ref_now(p_date date) returns timestamptz language sql stable as $$
  select case when p_date = public.wib_today() then now()
              else (p_date + time '12:00') at time zone 'Asia/Jakarta' end $$;

-- Skor prioritas tugas (PRD §7.9; common/calc/priority.ts).
create or replace function public.fn_priority_score(p_priority int, p_due timestamptz, p_now timestamptz, p_linked boolean)
returns int language sql immutable as $$
  select (case p_priority when 1 then 10 when 2 then 20 when 3 then 35 when 4 then 50 else 20 end)
    + case when p_due is null then 0
           when p_due < p_now then 60
           when p_due <= p_now + interval '24 hours' then 40
           when p_due <= p_now + interval '72 hours' then 20
           else 0 end
    + case when coalesce(p_linked, false) then 10 else 0 end $$;

create or replace function public.fn_priority_label(p_priority int) returns text language sql immutable as $$
  select (array['Rendah','Sedang','Tinggi','Kritis'])[greatest(1, least(4, p_priority))] $$;

create or replace function public.fn_exam_label(p_kind text) returns text language sql immutable as $$
  select case p_kind when 'kuis' then 'Kuis' when 'uts' then 'UTS' when 'uas' then 'UAS' when 'praktikum' then 'Praktikum'
         else 'Ujian' end $$;

-- Semester aktif (sama dengan features/courses/derive.ts activeSemester): is_active, selain itu nomor tertinggi.
create or replace function public.fn_active_semester(p_uid uuid) returns uuid
language sql stable set search_path = public as $$
  select id from public.semesters where user_id = p_uid and deleted_at is null
  order by is_active desc, number desc limit 1 $$;

-- ---------- rpc_tasks_overview ----------
create or replace function public.rpc_tasks_overview(p_date date default public.wib_today(), p_limit int default 5)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := public.fn_ref_now(p_date);
  v_res jsonb;
begin
  with open_t as (
    select t.*, (t.due_at at time zone 'Asia/Jakarta')::date as due_day
    from public.tasks t
    where t.user_id = v_uid and t.deleted_at is null and t.status not in ('selesai', 'dibatalkan')
  ),
  exam_courses as (
    select distinct e.course_id from public.exams e
    where e.user_id = v_uid and e.deleted_at is null and e.starts_at >= v_now and e.starts_at <= v_now + interval '7 days'
  ),
  proj_soon as (
    select p.id from public.projects p
    where p.user_id = v_uid and p.deleted_at is null and p.due_date between p_date and p_date + 7
  ),
  scored as (
    select o.*,
      public.fn_priority_score(o.priority, o.due_at, v_now,
        (o.course_id is not null and o.course_id in (select course_id from exam_courses))
        or (o.project_id is not null and o.project_id in (select id from proj_soon))) as score,
      (o.due_at is not null and case when o.all_day then o.due_day < p_date else o.due_at < v_now end) as is_overdue
    from open_t o
  ),
  top as (
    select s.*, row_number() over (order by s.score desc, s.due_at asc nulls last, s.created_at asc) as rn
    from scored s
  )
  select jsonb_build_object(
    'date', p_date,
    'due_today', (select count(*) from scored where due_day = p_date),
    'overdue', (select count(*) from scored where is_overdue),
    'done_today', (select count(*) from public.tasks x where x.user_id = v_uid and x.deleted_at is null
                     and x.status = 'selesai' and (x.completed_at at time zone 'Asia/Jakarta')::date = p_date),
    'open_total', (select count(*) from scored),
    'top', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'title', t.title, 'priority', t.priority, 'priority_label', public.fn_priority_label(t.priority),
        'due_at', t.due_at, 'all_day', t.all_day, 'due_date', t.due_day,
        'due_label', public.fn_due_label(t.due_at, t.all_day, p_date),
        'est_min', t.estimate_min, 'score', t.score, 'overdue', t.is_overdue, 'source_tag', t.source_tag,
        'course', (select c.name from public.courses c where c.id = t.course_id and c.deleted_at is null),
        'project', (select p.name from public.projects p where p.id = t.project_id and p.deleted_at is null)
      ) order by t.rn)
      from top t where t.rn <= greatest(1, least(coalesce(p_limit, 5), 20))), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

-- ---------- rpc_schedule_overview ----------
create or replace function public.rpc_schedule_overview(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_sem uuid := public.fn_active_semester(auth.uid());
  v_res jsonb;
begin
  select jsonb_build_object(
    'date', p_date,
    'weekday', public.fn_hari(p_date),
    'classes_today', coalesce((
      select jsonb_agg(jsonb_build_object(
        'schedule_id', cs.id, 'course_id', c.id, 'name', c.name, 'code', c.code,
        'start', to_char(cs.start_time, 'HH24:MI'), 'end', to_char(cs.end_time, 'HH24:MI'),
        'room', coalesce(cs.room, c.room),
        'attendance', (select a.status from public.attendances a where a.course_id = c.id and a.meeting_date = p_date)
      ) order by cs.start_time)
      from public.course_schedules cs
      join public.courses c on c.id = cs.course_id and c.deleted_at is null
      where cs.user_id = v_uid and cs.weekday = extract(isodow from p_date)::int
        and (v_sem is null or c.semester_id = v_sem)), '[]'::jsonb),
    'exams_next_7d', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'course_id', e.course_id, 'course', c.name, 'kind', e.kind, 'kind_label', public.fn_exam_label(e.kind),
        'starts_at', e.starts_at, 'date', (e.starts_at at time zone 'Asia/Jakarta')::date,
        'time', to_char(e.starts_at at time zone 'Asia/Jakarta', 'HH24:MI'),
        'in_days', (e.starts_at at time zone 'Asia/Jakarta')::date - p_date, 'prep_status', e.prep_status
      ) order by e.starts_at)
      from public.exams e
      join public.courses c on c.id = e.course_id and c.deleted_at is null
      where e.user_id = v_uid and e.deleted_at is null
        and (e.starts_at at time zone 'Asia/Jakarta')::date between p_date and p_date + 7), '[]'::jsonb)
  ) into v_res;
  return v_res;
end $$;

-- ---------- rpc_home (versi awal; diganti lengkap di 0007_finance.sql) ----------
create or replace function public.rpc_home(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_now timestamptz := public.fn_ref_now(p_date);
  v_min int := public.fn_wib_minutes(public.fn_ref_now(p_date));
  v_sched jsonb := public.rpc_schedule_overview(p_date);
  v_tasks jsonb := public.rpc_tasks_overview(p_date, 20);
  v_next jsonb;
begin
  select c into v_next from jsonb_array_elements(v_sched->'classes_today') c
  where p_date <> public.wib_today()
     or v_min < (split_part(c->>'end', ':', 1)::int * 60 + split_part(c->>'end', ':', 2)::int)
  limit 1;
  if v_next is not null and p_date = public.wib_today() then
    v_next := v_next || jsonb_build_object('minutes_until',
      (split_part(v_next->>'start', ':', 1)::int * 60 + split_part(v_next->>'start', ':', 2)::int) - v_min);
  end if;
  return jsonb_build_object(
    'date', p_date,
    'weekday', public.fn_hari(p_date),
    'part_of_day', public.fn_part_of_day(v_min),
    'display_name', (select display_name from public.profiles where id = v_uid),
    'next_class', v_next,
    -- 3 tugas teratas Beranda: tugas terbuka berskor tertinggi yang tenggatnya ≤ besok atau tanpa tenggat
    'tasks_top', coalesce((
      select jsonb_agg(t order by ord) from (
        select t, ord from jsonb_array_elements(v_tasks->'top') with ordinality as x(t, ord)
        where t->>'due_date' is null or (t->>'due_date')::date <= p_date + 1
        order by ord limit 3) s), '[]'::jsonb),
    'tasks', jsonb_build_object('due_today', v_tasks->'due_today', 'overdue', v_tasks->'overdue', 'done_today', v_tasks->'done_today'),
    'level', coalesce((select level from public.user_stats where user_id = v_uid), 1),
    'xp_total', coalesce((select xp_total from public.user_stats where user_id = v_uid), 0),
    'unread_notifications', (select count(*) from public.scheduled_notifications
                             where user_id = v_uid and status = 'sent' and read_at is null)
  );
end $$;

revoke execute on function public.rpc_tasks_overview(date, int) from public, anon;
revoke execute on function public.rpc_schedule_overview(date) from public, anon;
revoke execute on function public.rpc_home(date) from public, anon;
grant execute on function public.rpc_tasks_overview(date, int) to authenticated, service_role;
grant execute on function public.rpc_schedule_overview(date) to authenticated, service_role;
grant execute on function public.rpc_home(date) to authenticated, service_role;
