-- =====================================================================================
-- 0003_tasks.sql — Hamzi (M2.1)
-- TECH-SPEC §5.5: fn_task_set_done_for / rpc_task_set_done + pembuatan SATU instance tugas berulang berikutnya.
-- Pola keamanan §5.5: fn_*_for(p_uid, …) = security definer, difilter user_id = p_uid, hanya service_role;
--                     rpc_*(…) = security definer, memanggil fn_*_for(auth.uid(), …), hanya authenticated.
-- Paritas perilaku: src/data/rpc-logic.ts (rpcTaskSetDone).
-- =====================================================================================

-- Konstanta & rumus kecil (setara supabase/functions/_shared/common/calc).
-- Math.round() JavaScript = floor(x + 0,5) (berbeda dengan round() Postgres untuk nilai negatif .5).
create or replace function public.fn_js_round(p numeric) returns bigint
language sql immutable as $$ select floor(p + 0.5)::bigint $$;

-- taskXp (PRD §7.8): 10 × (1 / 1,2 / 1,5 / 2) dibulatkan → 10 / 12 / 15 / 20.
create or replace function public.fn_task_xp(p_priority int) returns int
language sql immutable as $$
  select case p_priority when 1 then 10 when 2 then 12 when 3 then 15 when 4 then 20 else 12 end $$;

-- Tenggat instance berikutnya dari aturan recurrence (common/schemas.ts recurrenceSchema).
-- Dihitung pada jam dinding WIB (Asia/Jakarta, tanpa DST) agar hari-dalam-minggu (1=Senin…7=Minggu) benar.
create or replace function public.fn_next_due(p_due timestamptz, p_rec jsonb) returns timestamptz
language plpgsql stable set search_path = public as $$
declare
  v_freq text := coalesce(p_rec->>'freq', 'daily');
  v_n int := greatest(1, coalesce((p_rec->>'interval')::int, 1));
  v_local timestamp := p_due at time zone 'Asia/Jakarta';
  v_by int[];
  v_dom int := (p_rec->>'day_of_month')::int;
  v_c timestamp;
  v_last int;
begin
  if v_freq in ('daily', 'every_n_days') then
    v_local := v_local + make_interval(days => v_n);
  elsif v_freq = 'weekly' then
    select array_agg(x::int) into v_by
      from jsonb_array_elements_text(case when jsonb_typeof(p_rec->'by_day') = 'array' then p_rec->'by_day' else '[]'::jsonb end) x;
    if v_by is not null and array_length(v_by, 1) > 0 then
      for i in 1 .. 7 * v_n loop
        v_c := v_local + make_interval(days => i);
        if extract(isodow from v_c)::int = any (v_by) then
          return v_c at time zone 'Asia/Jakarta';
        end if;
      end loop;
    end if;
    v_local := v_local + make_interval(days => 7 * v_n);
  elsif v_freq = 'monthly' then
    v_local := v_local + make_interval(months => v_n);        -- 31 Jan + 1 bln = 28/29 Feb (dijepit)
    if v_dom is not null then
      v_last := extract(day from (date_trunc('month', v_local) + interval '1 month - 1 day'))::int;
      v_local := make_timestamp(extract(year from v_local)::int, extract(month from v_local)::int, least(v_dom, v_last),
                                extract(hour from v_local)::int, extract(minute from v_local)::int, 0);
    end if;
  else
    v_local := v_local + interval '1 day';
  end if;
  return v_local at time zone 'Asia/Jakarta';
end $$;

-- Centang/batal tugas (TECH-SPEC §5.5). Idempoten: memanggil dua kali dengan p_done sama tidak mengubah apa pun.
create or replace function public.fn_task_set_done_for(p_uid uuid, p_task_id uuid, p_done boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t public.tasks%rowtype;
  v_day date := public.wib_today();
  v_was boolean;
  v_xp int;
  v_water boolean := false;
  v_wft boolean;
  v_next uuid;
begin
  if p_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  select * into t from public.tasks where id = p_task_id and user_id = p_uid and deleted_at is null for update;
  if not found then raise exception 'Tugas tidak ditemukan' using errcode = 'P0002'; end if;

  v_was := t.status = 'selesai';
  v_xp := public.fn_task_xp(t.priority);

  if coalesce(p_done, false) and not v_was then
    update public.tasks set status = 'selesai', completed_at = now() where id = t.id;
    insert into public.xp_events(user_id, kind, ref_id, day, xp) values (p_uid, 'task', t.id, v_day, v_xp)
      on conflict (user_id, kind, ref_id, day) do nothing;
    -- "Tugas juga menyiram pohon" (default mati), maks 3 tetes/hari (TASK_WATER_MAX_PER_DAY).
    select water_from_tasks into v_wft from public.user_settings where user_id = p_uid;
    if coalesce(v_wft, false)
       and (select count(*) from public.water_events where user_id = p_uid and source = 'task' and day = v_day) < 3 then
      insert into public.water_events(user_id, source, ref_id, day) values (p_uid, 'task', t.id, v_day)
        on conflict (user_id, source, ref_id, day) do nothing;
      v_water := found;
    end if;
    -- Tugas berulang: buat SATU instance berikutnya (cek belum ada).
    if t.recurrence is not null and t.due_at is not null
       and not exists (select 1 from public.tasks x
                       where x.user_id = p_uid and x.recurrence_parent_id = t.id and x.deleted_at is null) then
      insert into public.tasks(user_id, title, notes, status, priority, source_tag, due_at, all_day, project_id, milestone_id,
                               course_id, course_task_kind, weight_pct, estimate_min, recurrence, recurrence_parent_id, remind_offsets)
      values (p_uid, t.title, t.notes, 'belum', t.priority, t.source_tag, public.fn_next_due(t.due_at, t.recurrence), t.all_day,
              t.project_id, t.milestone_id, t.course_id, t.course_task_kind, t.weight_pct, t.estimate_min, t.recurrence, t.id,
              t.remind_offsets)
      returning id into v_next;
    end if;
  elsif not coalesce(p_done, false) and v_was then
    update public.tasks set status = 'belum', completed_at = null where id = t.id;
    -- Urungkan: tarik XP & tetes air tugas ini.
    delete from public.xp_events where user_id = p_uid and kind = 'task' and ref_id = t.id;
    delete from public.water_events where user_id = p_uid and source = 'task' and ref_id = t.id;
  end if;

  return jsonb_build_object(
    'done', coalesce(p_done, false), 'xp', v_xp, 'water_awarded', v_water, 'next_task_id', v_next,
    'water_total', (select count(*) from public.water_events where user_id = p_uid));
end $$;
revoke execute on function public.fn_task_set_done_for(uuid, uuid, boolean) from public, anon, authenticated;
grant execute on function public.fn_task_set_done_for(uuid, uuid, boolean) to service_role;

create or replace function public.rpc_task_set_done(p_task_id uuid, p_done boolean)
returns jsonb language sql security definer set search_path = public as $$
  select public.fn_task_set_done_for(auth.uid(), p_task_id, p_done) $$;
revoke execute on function public.rpc_task_set_done(uuid, boolean) from public, anon;
grant execute on function public.rpc_task_set_done(uuid, boolean) to authenticated;
