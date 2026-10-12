-- =====================================================================================
-- 0008_courses.sql — Hamzi (M6.1–M6.3)
-- TECH-SPEC §5.5/§5.6: rpc_attendance_mark (→ fn_attendance_mark_for di 0006), rpc_gpa_summary.
-- Rumus setara common/calc/gpa.ts + features/courses/derive.ts gpaSummary (PRD §7.1–§7.3).
-- =====================================================================================

create or replace function public.rpc_attendance_mark(p_course_id uuid, p_date date, p_status text, p_note text default null)
returns jsonb language sql security definer set search_path = public as $$
  select public.fn_attendance_mark_for(auth.uid(), p_course_id, p_date, p_status, p_note) $$;
revoke execute on function public.rpc_attendance_mark(uuid, date, text, text) from public, anon;
grant execute on function public.rpc_attendance_mark(uuid, date, text, text) to authenticated;

-- Normalisasi nama (setara normName di common/match.ts): huruf kecil, & → dan, non-alfanumerik → spasi, spasi rapat.
create or replace function public.fn_norm_name(p text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(lower(replace(coalesce(p, ''), '&', 'dan')), '[^[:alnum:]]+', ' ', 'g'), '\s+', ' ', 'g')) $$;

-- Bobot huruf dari skala pengguna (null bila huruf tidak dikenal).
create or replace function public.fn_grade_weight(p_scale jsonb, p_grade text) returns numeric language sql immutable as $$
  select case when p_grade is null or not (p_scale ? p_grade) then null else (p_scale->>p_grade)::numeric end $$;

-- ceil2: dibulatkan ke atas 2 desimal (nilai minimal yang dibutuhkan, PRD §7.1)
create or replace function public.fn_ceil2(p numeric) returns numeric language sql immutable as $$
  select ceil(p * 100 - 0.000000001) / 100 $$;

-- roundHalfUp2: half-up 2 desimal (3,5625 → 3,56; 3,565 → 3,57)
create or replace function public.fn_round_half_up2(p numeric) returns numeric language sql immutable as $$
  select floor(p * 100 + 0.5 + 0.000000001) / 100 $$;

create or replace function public.rpc_gpa_summary()
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_scale jsonb;
  v_curr int;
  v_target numeric;
  v_sem_id uuid; v_sem_number smallint; v_sem_label text;
  v_p numeric; v_c int;            -- poin & SKS bernilai resmi (semua semester, percobaan terbaru)
  v_bp numeric; v_bc int;          -- idem tanpa matkul yang sedang diulang semester ini (dasar proyeksi & target)
  v_sp numeric; v_sc int;          -- poin & SKS simulasi (matkul semester aktif tanpa nilai resmi)
  v_op numeric; v_oc int;          -- nilai resmi semester aktif
  v_semcred int;                   -- SKS semester aktif yang belum bernilai resmi
  v_required jsonb := null;
  v_req numeric;
  v_present int; v_held int;
begin
  select grade_scale, curriculum_credits, target_gpa into v_scale, v_curr, v_target
    from public.user_settings where user_id = v_uid;
  v_scale := coalesce(v_scale, '{"A":4,"B+":3.5,"B":3,"C+":2.5,"C":2,"D":1,"E":0}'::jsonb);
  select id, number, label into v_sem_id, v_sem_number, v_sem_label from public.semesters
   where user_id = v_uid and deleted_at is null order by is_active desc, number desc limit 1;

  -- Matkul diulang → nilai terbaru menggantikan (PRD §7.1; setara latestAttempts di common/calc/gpa.ts).
  -- Key = nama ternormalisasi (setara normName di common/match.ts), urutan = nomor semester.
  with att as (
    select c.credits, c.final_grade, public.fn_norm_name(c.name) as k, s.number as ord
      from public.courses c join public.semesters s on s.id = c.semester_id
     where c.user_id = v_uid and c.deleted_at is null and c.final_grade is not null
  ), latest as (select distinct on (k) * from att order by k, ord desc)
  select coalesce(sum(public.fn_grade_weight(v_scale, final_grade) * credits), 0),
         coalesce(sum(credits) filter (where public.fn_grade_weight(v_scale, final_grade) is not null), 0),
         coalesce(sum(public.fn_grade_weight(v_scale, final_grade) * credits) filter (where k not in (
           select public.fn_norm_name(name) from public.courses
            where user_id = v_uid and deleted_at is null and semester_id = v_sem_id and final_grade is null)), 0),
         coalesce(sum(credits) filter (where public.fn_grade_weight(v_scale, final_grade) is not null and k not in (
           select public.fn_norm_name(name) from public.courses
            where user_id = v_uid and deleted_at is null and semester_id = v_sem_id and final_grade is null)), 0)
    into v_p, v_c, v_bp, v_bc
    from latest;

  select coalesce(sum(public.fn_grade_weight(v_scale, coalesce(sim_grade, target_grade)) * credits), 0),
         coalesce(sum(credits) filter (where public.fn_grade_weight(v_scale, coalesce(sim_grade, target_grade)) is not null), 0),
         coalesce(sum(credits), 0)
    into v_sp, v_sc, v_semcred
    from public.courses where user_id = v_uid and deleted_at is null and semester_id = v_sem_id and final_grade is null;

  select coalesce(sum(public.fn_grade_weight(v_scale, final_grade) * credits), 0),
         coalesce(sum(credits) filter (where public.fn_grade_weight(v_scale, final_grade) is not null), 0)
    into v_op, v_oc
    from public.courses where user_id = v_uid and deleted_at is null and semester_id = v_sem_id and final_grade is not null;

  if v_target is not null and v_semcred > 0 then
    v_req := (v_target * (v_bc + v_semcred) - v_bp) / v_semcred;
    v_required := jsonb_build_object('value', round(v_req, 4), 'display', public.fn_ceil2(greatest(0, v_req)),
                                     'unreachable', v_req > 4.000000001);
  end if;

  select count(*) filter (where a.status = 'hadir'), count(*) into v_present, v_held
    from public.attendances a join public.courses c on c.id = a.course_id
   where a.user_id = v_uid and c.deleted_at is null and c.semester_id = v_sem_id;

  return jsonb_build_object(
    'active_semester', case when v_sem_id is null then null
                            else jsonb_build_object('id', v_sem_id, 'number', v_sem_number, 'label', v_sem_label) end,
    'ipk', case when v_c > 0 then public.fn_round_half_up2(v_p / v_c) end,
    'ipk_raw', case when v_c > 0 then round(v_p / v_c, 4) end,
    'credits_passed', v_c,
    'points_passed', v_p,
    'curriculum_credits', coalesce(v_curr, 144),
    'target_gpa', v_target,
    'semester_credits', v_semcred,
    'ips_official', case when v_oc > 0 then public.fn_round_half_up2(v_op / v_oc) end,
    'ips_sim', case when v_sc > 0 then public.fn_round_half_up2(v_sp / v_sc) end,
    'projected', case when v_bc + v_sc > 0 then public.fn_round_half_up2((v_bp + v_sp) / (v_bc + v_sc)) end,
    'projected_raw', case when v_bc + v_sc > 0 then round((v_bp + v_sp) / (v_bc + v_sc), 4) end,
    'required', v_required,
    'attendance_pct', case when v_held > 0 then public.fn_js_round(public.fn_round_half_up2(v_present * 100.0 / v_held)) end,
    'attendance_avg_pct', (
      select public.fn_js_round(avg(x.pct)) from (
        select public.fn_round_half_up2(count(*) filter (where a.status = 'hadir') * 100.0 / count(*)) as pct
        from public.attendances a join public.courses c on c.id = a.course_id
        where a.user_id = v_uid and c.deleted_at is null and c.semester_id = v_sem_id
        group by a.course_id) x),
    'courses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.name, 'code', c.code, 'credits', c.credits,
        'final_grade', c.final_grade, 'sim_grade', c.sim_grade, 'target_grade', c.target_grade,
        'min_attendance_pct', c.min_attendance_pct,
        'attendance', (select jsonb_build_object('present', count(*) filter (where a.status = 'hadir'), 'held', count(*))
                       from public.attendances a where a.course_id = c.id)
      ) order by c.name)
      from public.courses c where c.user_id = v_uid and c.deleted_at is null and c.semester_id = v_sem_id), '[]'::jsonb)
  );
end $$;
revoke execute on function public.rpc_gpa_summary() from public, anon;
grant execute on function public.rpc_gpa_summary() to authenticated, service_role;
