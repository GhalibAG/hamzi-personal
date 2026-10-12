-- =====================================================================================
-- 0006_scheduler.sql — Hamzi (M4.2–M4.3)
-- TECH-SPEC §5.9 + §6.1–§6.3: job_runs, rpc_ping, fn_enqueue_notifications(p_now), fn_skip_irrelevant,
-- fn_dispatch_candidates, fn_mark_notification, fn_attendance_mark_for (dipakai notif-action),
-- rpc_log_test_notification (push-test), fn_run_recurring, fn_purge_daily, fn_daily_maintenance.
-- Penjadwal = Cloudflare Worker tiap menit → Edge scheduler-tick (BUKAN pg_cron).
-- Fungsi fn_* di sini security definer dan HANYA untuk service_role.
-- =====================================================================================

-- ---------- §5.9 keep-alive & job harian ----------
create or replace function public.rpc_ping() returns int language sql stable as $$ select 1 $$;
grant execute on function public.rpc_ping() to anon;

create table public.job_runs (job text not null, day date not null, ran_at timestamptz not null default now(),
  primary key (job, day));
alter table public.job_runs enable row level security;   -- tanpa policy: hanya service role
revoke all on public.job_runs from anon, authenticated;
grant all on public.job_runs to service_role;

-- Kolom bantu penjadwal (tambahan teknis, bukan data pengguna):
--   ref_day       = hari WIB yang dirujuk pengingat (cek relevansi saat kirim; disalin ke notifikasi tunda)
--   claimed_until = klaim dispatch agar dua tick yang tumpang tindih tidak mengirim ganda
alter table public.scheduled_notifications
  add column ref_day date,
  add column claimed_until timestamptz;

-- ---------- Helper ----------
-- Jam tenang [start, end) yang boleh melewati tengah malam (common/calc/notify.ts inQuietHours).
create or replace function public.fn_in_quiet(p_t time, p_start time default '23:00', p_end time default '05:00')
returns boolean language sql immutable as $$
  select case when p_start <= p_end then p_t >= p_start and p_t < p_end else p_t >= p_start or p_t < p_end end $$;

-- Awal siklus anggaran (TECH-SPEC §5.6; common/calc/budget.ts cycleStart). Dipakai juga di 0007_finance.
create or replace function public.fn_cycle_start(p_date date, p_cycle_day int) returns date
language sql immutable as $$
  select case when extract(day from p_date) >= p_cycle_day
    then make_date(extract(year from p_date)::int, extract(month from p_date)::int, p_cycle_day)
    else (make_date(extract(year from p_date)::int, extract(month from p_date)::int, p_cycle_day) - interval '1 month')::date
  end $$;

-- Bank kalimat badan notifikasi — salinan common/notif-lines.id.ts (NOTIF_BODY). Tanpa nominal.
-- 'budget100' & 'recurring' adalah tambahan SQL (belum ada di bank TS).
create or replace function public.fn_notif_body(p_kind text, p_seed text default '') returns text
language plpgsql immutable as $$
declare arr text[];
begin
  arr := case p_kind
    when 'routine' then array['Pohonmu nunggu disiram. Cuma butuh sebentar.', 'Satu centang lagi buat pohonmu.']
    when 'module' then array['Waktunya belajar 25 menit. Aku jagain timernya.', 'Sesi singkat dulu yuk, pohonmu senang.']
    when 'task' then array['Tenggatnya sebentar lagi. Yuk dicicil.']
    when 'class' then array['Kelas mulai 30 menit lagi.']
    when 'exam' then array['Ujian makin dekat. Cicil materinya ya.']
    when 'expense_nudge' then array['Ada pengeluaran hari ini yang belum dicatat?']
    when 'budget' then array['Anggaran bulan ini hampir habis. Cek dulu yuk.']
    when 'budget100' then array['Anggaran bulan ini sudah habis. Cek dulu yuk.']
    when 'weekly_review' then array['Review mingguanmu siap. Lihat sebentar?']
    when 'goal' then array['Hari ini jadwal setor ke target tabungan.']
    when 'backup' then array['Sudah 14 hari sejak backup terakhir. Export dulu yuk.']
    when 'valuation' then array['Waktunya perbarui nilai investasi bulan ini.']
    when 'morning_brief' then array['Selamat pagi! Ringkasan harimu sudah siap.']
    when 'recurring' then array['Ada transaksi berulang yang perlu dikonfirmasi.']
    else array['Pohonmu nunggu disiram. Cuma butuh sebentar.'] end;
  return arr[1 + ((hashtext(coalesce(p_seed, ''))::bigint & 2147483647) % array_length(arr, 1))::int];
end $$;

-- Tombol aksi (maks 2) — salinan NOTIF_ACTIONS.
create or replace function public.fn_notif_actions(p_kind text) returns jsonb language sql immutable as $$
  select case p_kind
    when 'routine' then '[{"action":"done","title":"Tandai selesai"},{"action":"snooze10","title":"Tunda 10 mnt"}]'::jsonb
    when 'test' then '[{"action":"done","title":"Tandai selesai"},{"action":"snooze10","title":"Tunda 10 mnt"}]'::jsonb
    when 'module' then '[{"action":"start","title":"Mulai sekarang"},{"action":"snooze10","title":"Tunda 10 mnt"}]'::jsonb
    when 'task' then '[{"action":"done","title":"Selesai"},{"action":"snooze60","title":"Tunda 1 jam"}]'::jsonb
    when 'class' then '[{"action":"attend","title":"Tandai hadir"}]'::jsonb
    when 'expense_nudge' then '[{"action":"log","title":"Catat"}]'::jsonb
    else '[]'::jsonb end $$;

-- ---------- Enqueue (TECH-SPEC §6.1 langkah 1) ----------
-- Jendela [p_now, p_now + 10 mnt). insert … on conflict (user_id, dedupe_key) do nothing → idempoten tiap menit.
-- dedupe_key rutinitas/modul/kelas diberi akhiran jam (HHMM) agar perubahan jam pada hari yang sama tetap diingatkan;
-- antrean lama dengan jam usang dilewati di fn_skip_irrelevant.
-- Pengingat pengguna (category 'user') selalu dikirim. Sistem: hormati system_notif, jam tenang, maks 6/hari.
create or replace function public.fn_enqueue_notifications(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare
  v_end timestamptz := p_now + interval '10 minutes';
  v_d0 date := (p_now at time zone 'Asia/Jakarta')::date;
  v_n int := 0;
  v_k int;
  s record;
  c record;
  v_day date;
begin
  -- 1a. Rutinitas: remind_at di jendela, hari ∈ repeat_days, belum done hari itu.
  insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                             title, body, url, actions)
  select r.user_id, 'user', 'routine', 'routine', r.id, dd.d,
         'routine:' || r.id || ':' || dd.d || ':' || to_char(r.remind_at, 'HH24MI'),
         (dd.d + r.remind_at) at time zone 'Asia/Jakarta',
         r.name, public.fn_notif_body('routine', r.id || ':' || dd.d), '/tumbuh', public.fn_notif_actions('routine')
  from public.routines r
  cross join (values (v_d0), (v_d0 + 1)) as dd(d)
  where r.deleted_at is null and not r.archived and r.remind_enabled and r.remind_at is not null
    and extract(isodow from dd.d)::int = any (r.repeat_days)
    and (dd.d + r.remind_at) at time zone 'Asia/Jakarta' >= p_now
    and (dd.d + r.remind_at) at time zone 'Asia/Jakarta' < v_end
    and not exists (select 1 from public.routine_logs l where l.routine_id = r.id and l.log_date = dd.d and l.done)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  -- 1b. Modul belajar: hari ∈ remind_days, belum ada sesi ≥ 10 mnt untuk modul itu hari itu.
  insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                             title, body, url, actions)
  select m.user_id, 'user', 'module', 'learning_module', m.id, dd.d,
         'module:' || m.id || ':' || dd.d || ':' || to_char(m.remind_at, 'HH24MI'),
         (dd.d + m.remind_at) at time zone 'Asia/Jakarta',
         m.title, public.fn_notif_body('module', m.id || ':' || dd.d), '/tumbuh/sesi?modul=' || m.id,
         public.fn_notif_actions('module')
  from public.learning_modules m
  cross join (values (v_d0), (v_d0 + 1)) as dd(d)
  where m.deleted_at is null and m.status = 'aktif' and m.remind_enabled and m.remind_at is not null
    and extract(isodow from dd.d)::int = any (m.remind_days)
    and (dd.d + m.remind_at) at time zone 'Asia/Jakarta' >= p_now
    and (dd.d + m.remind_at) at time zone 'Asia/Jakarta' < v_end
    and not exists (select 1 from public.study_sessions ss
                    where ss.module_id = m.id and ss.started_on = dd.d and ss.duration_min >= 10)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  -- 1c. Tugas: due_at − offset di jendela, belum selesai.
  insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                             title, body, url, actions)
  select t.user_id, 'user', 'task', 'task', t.id, (t.due_at at time zone 'Asia/Jakarta')::date,
         'task:' || t.id || ':' || o.off || ':' || to_char(t.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI'),
         t.due_at - make_interval(mins => o.off),
         t.title, public.fn_notif_body('task', t.id::text), '/rencana', public.fn_notif_actions('task')
  from public.tasks t
  cross join lateral unnest(t.remind_offsets) as o(off)
  where t.deleted_at is null and t.status not in ('selesai', 'dibatalkan') and t.due_at is not null and o.off >= 0
    and t.due_at - make_interval(mins => o.off) >= p_now
    and t.due_at - make_interval(mins => o.off) < v_end
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  -- 2. Pengingat sistem per pengguna.
  for s in
    select us.user_id, us.system_notif as sn, us.quiet_start as qs, us.quiet_end as qe, us.budget_cycle_day as cd,
           coalesce(us.last_backup_at, p.created_at) as backup_base
    from public.user_settings us join public.profiles p on p.id = us.user_id
  loop
    for c in
      select * from (
        -- kelas: mulai − 30 mnt (semester aktif, belum ditandai hadir)
        select 'class'::text as kind, 'course_schedule'::text as ref_type, cs.id::uuid as ref_id, dd.d::date as ref_day,
               ('class:' || cs.id || ':' || dd.d || ':' || to_char(cs.start_time, 'HH24MI'))::text as dedupe_key,
               ((dd.d + cs.start_time) at time zone 'Asia/Jakarta') - interval '30 minutes' as fire_at,
               co.name::text as title, '/kuliah'::text as url
        from public.course_schedules cs
        join public.courses co on co.id = cs.course_id and co.deleted_at is null
        cross join (values (v_d0), (v_d0 + 1)) as dd(d)
        where cs.user_id = s.user_id and cs.weekday = extract(isodow from dd.d)::int
          and co.semester_id = public.fn_active_semester(s.user_id)
          and not exists (select 1 from public.attendances a where a.course_id = co.id and a.meeting_date = dd.d)
        union all
        -- ujian: H-3 & H-1 pukul 19:00
        select 'exam', 'exam', e.id, (e.starts_at at time zone 'Asia/Jakarta')::date,
               'exam:' || e.id || ':h' || h.h,
               ((((e.starts_at at time zone 'Asia/Jakarta')::date - h.h) + time '19:00') at time zone 'Asia/Jakarta'),
               public.fn_exam_label(e.kind) || ' ' || co.name, '/kuliah'
        from public.exams e
        join public.courses co on co.id = e.course_id and co.deleted_at is null
        cross join (values (3), (1)) as h(h)
        where e.user_id = s.user_id and e.deleted_at is null and e.starts_at > p_now
        union all
        -- "Catat pengeluaran hari ini?" 21:00 bila belum ada pengeluaran hari itu
        select 'expense_nudge', null, null, dd.d, 'expense_nudge:' || dd.d,
               (dd.d + time '21:00') at time zone 'Asia/Jakarta', 'Catat pengeluaran hari ini?', '/keuangan?quick=expense'
        from (values (v_d0), (v_d0 + 1)) as dd(d)
        where not exists (select 1 from public.transactions t where t.user_id = s.user_id and t.kind = 'expense'
                            and t.deleted_at is null and t.occurred_on = dd.d)
        union all
        -- review mingguan: Minggu 19:00
        select 'weekly_review', null, null, dd.d, 'weekly_review:' || dd.d,
               (dd.d + time '19:00') at time zone 'Asia/Jakarta', 'Review mingguanmu siap', '/chat?review=minggu'
        from (values (v_d0), (v_d0 + 1)) as dd(d)
        where extract(isodow from dd.d) = 7
        union all
        -- setoran target: tanggal rencana (plan_day) 09:00
        select 'goal', 'savings_goal', g.id, dd.d, 'goal:' || g.id || ':' || dd.d,
               (dd.d + time '09:00') at time zone 'Asia/Jakarta', g.name, '/keuangan/target/' || g.id
        from public.savings_goals g
        cross join (values (v_d0), (v_d0 + 1)) as dd(d)
        where g.user_id = s.user_id and g.deleted_at is null and g.status = 'aktif'
          and g.plan_day = extract(day from dd.d)::int
        union all
        -- backup: 14 hari sejak backup terakhir, lalu tiap 7 hari, 20:00
        select 'backup', null, null, dd.d, 'backup:' || dd.d,
               (dd.d + time '20:00') at time zone 'Asia/Jakarta', 'Saatnya backup data', '/pengaturan'
        from (values (v_d0), (v_d0 + 1)) as dd(d)
        where dd.d - (s.backup_base at time zone 'Asia/Jakarta')::date >= 14
          and (dd.d - (s.backup_base at time zone 'Asia/Jakarta')::date - 14) % 7 = 0
        union all
        -- valuasi investasi: tanggal 1, 09:00, bila ada aset aktif
        select 'valuation', null, null, dd.d, 'valuation:' || to_char(dd.d, 'YYYY-MM'),
               (dd.d + time '09:00') at time zone 'Asia/Jakarta', 'Perbarui nilai investasi', '/keuangan/investasi'
        from (values (v_d0), (v_d0 + 1)) as dd(d)
        where extract(day from dd.d) = 1
          and exists (select 1 from public.assets a where a.user_id = s.user_id and not a.archived)
        union all
        -- ringkasan pagi 07:00 (default mati)
        select 'morning_brief', null, null, dd.d, 'morning_brief:' || dd.d,
               (dd.d + time '07:00') at time zone 'Asia/Jakarta', 'Ringkasan pagi', '/'
        from (values (v_d0), (v_d0 + 1)) as dd(d)
        union all
        -- anggaran 80% / 100%: sekali per siklus, dikirim segera (fire_at = p_now)
        select 'budget', null, null, b.cs,
               case when b.spent >= b.amount then 'budget100:' else 'budget80:' end || b.cs,
               p_now, case when b.spent >= b.amount then 'Anggaran sudah habis' else 'Anggaran hampir habis' end,
               '/keuangan/anggaran'
        from (
          select cyc.cs,
                 (select bu.amount from public.budgets bu where bu.user_id = s.user_id and bu.category_id is null
                    and bu.effective_from <= v_d0 order by bu.effective_from desc limit 1) as amount,
                 (select coalesce(sum(t.amount), 0) from public.transactions t where t.user_id = s.user_id
                    and t.kind = 'expense' and t.deleted_at is null and t.occurred_on between cyc.cs and v_d0) as spent
          from (select public.fn_cycle_start(v_d0, s.cd) as cs) cyc
        ) b
        where b.amount > 0 and b.spent * 100 >= b.amount * 80
          and not exists (select 1 from public.scheduled_notifications x
                          where x.user_id = s.user_id and x.dedupe_key = 'budget100:' || b.cs)
      ) cand
      where cand.fire_at >= p_now and cand.fire_at < v_end
        and coalesce((s.sn ->> cand.kind)::boolean, false)
      order by cand.fire_at, cand.dedupe_key
    loop
      -- jam tenang (hanya sistem)
      if public.fn_in_quiet((c.fire_at at time zone 'Asia/Jakarta')::time, s.qs, s.qe) then continue; end if;
      -- maks 6 notifikasi sistem per hari WIB (pending + terkirim)
      v_day := (c.fire_at at time zone 'Asia/Jakarta')::date;
      if (select count(*) from public.scheduled_notifications n
          where n.user_id = s.user_id and n.category = 'system' and n.status in ('pending', 'sent')
            and (n.fire_at at time zone 'Asia/Jakarta')::date = v_day
            and n.dedupe_key <> c.dedupe_key) >= 6 then
        continue;
      end if;
      insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                                 title, body, url, actions)
      values (s.user_id, 'system', c.kind, c.ref_type, c.ref_id, c.ref_day, c.dedupe_key, c.fire_at, left(c.title, 200),
              public.fn_notif_body(case when c.dedupe_key like 'budget100:%' then 'budget100' else c.kind end, c.dedupe_key),
              c.url, public.fn_notif_actions(c.kind))
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end loop;
  end loop;

  return v_n;
end $$;

-- ---------- Dispatch (TECH-SPEC §6.1 langkah 2) ----------
-- Tandai 'skipped': lebih tua dari 2 jam, tidak relevan lagi (sudah selesai/dihapus/dimatikan),
-- sistem di jam tenang atau jenisnya dimatikan, dan sistem melebihi 6 terkirim per hari.
create or replace function public.fn_skip_irrelevant(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = public as $$
declare v_a int; v_b int;
begin
  update public.scheduled_notifications n set status = 'skipped', claimed_until = null
  where n.status = 'pending' and n.fire_at <= p_now and (
       n.fire_at <= p_now - interval '2 hours'
    or (n.kind = 'routine' and (
          not exists (select 1 from public.routines r where r.id = n.ref_id and r.deleted_at is null
                        and not r.archived and r.remind_enabled)
          or exists (select 1 from public.routine_logs l where l.routine_id = n.ref_id
                       and l.log_date = coalesce(n.ref_day, (n.fire_at at time zone 'Asia/Jakarta')::date) and l.done)))
    or (n.kind = 'module' and (
          not exists (select 1 from public.learning_modules m where m.id = n.ref_id and m.deleted_at is null
                        and m.status = 'aktif' and m.remind_enabled)
          or exists (select 1 from public.study_sessions ss where ss.module_id = n.ref_id and ss.duration_min >= 10
                       and ss.started_on = coalesce(n.ref_day, (n.fire_at at time zone 'Asia/Jakarta')::date))))
    or (n.kind = 'task' and not exists (select 1 from public.tasks t where t.id = n.ref_id and t.deleted_at is null
                                          and t.status not in ('selesai', 'dibatalkan')))
    -- jadwal berubah setelah masuk antrean (bukan salinan tunda 'snooze:…') → antrean lama usang
    or (n.dedupe_key like 'routine:%' and not exists (
          select 1 from public.routines r where r.id = n.ref_id and r.remind_at is not null
            and (n.ref_day + r.remind_at) at time zone 'Asia/Jakarta' = n.fire_at))
    or (n.dedupe_key like 'module:%' and not exists (
          select 1 from public.learning_modules m where m.id = n.ref_id and m.remind_at is not null
            and (n.ref_day + m.remind_at) at time zone 'Asia/Jakarta' = n.fire_at))
    or (n.dedupe_key like 'task:%' and not exists (
          select 1 from public.tasks t where t.id = n.ref_id
            and t.due_at = n.fire_at + make_interval(mins => split_part(n.dedupe_key, ':', 3)::int)))
    or (n.dedupe_key like 'class:%' and not exists (
          select 1 from public.course_schedules cs where cs.id = n.ref_id
            and ((n.ref_day + cs.start_time) at time zone 'Asia/Jakarta') - interval '30 minutes' = n.fire_at))
    or (n.kind = 'class' and exists (select 1 from public.course_schedules cs
                                       join public.attendances a on a.course_id = cs.course_id and a.meeting_date = n.ref_day
                                       where cs.id = n.ref_id))
    or (n.kind = 'exam' and not exists (select 1 from public.exams e where e.id = n.ref_id and e.deleted_at is null))
    or (n.kind = 'expense_nudge' and exists (select 1 from public.transactions t where t.user_id = n.user_id
                                               and t.kind = 'expense' and t.deleted_at is null and t.occurred_on = n.ref_day))
    or (n.kind = 'goal' and not exists (select 1 from public.savings_goals g where g.id = n.ref_id
                                          and g.deleted_at is null and g.status = 'aktif'))
    or (n.category = 'system' and exists (
          select 1 from public.user_settings us where us.user_id = n.user_id and (
            public.fn_in_quiet((p_now at time zone 'Asia/Jakarta')::time, us.quiet_start, us.quiet_end)
            or not coalesce((us.system_notif ->> n.kind)::boolean, false))))
  );
  get diagnostics v_a = row_count;

  -- batas 6 notifikasi sistem terkirim per hari WIB (termasuk antrean yang jatuh tempo bersamaan)
  with ranked as (
    select p.id,
           row_number() over (partition by p.user_id, (p.fire_at at time zone 'Asia/Jakarta')::date
                              order by p.fire_at, p.created_at, p.id) as rn,
           (select count(*) from public.scheduled_notifications x
             where x.user_id = p.user_id and x.category = 'system' and x.status = 'sent'
               and (x.sent_at at time zone 'Asia/Jakarta')::date = (p.fire_at at time zone 'Asia/Jakarta')::date) as sent_cnt
    from public.scheduled_notifications p
    where p.status = 'pending' and p.category = 'system' and p.fire_at <= p_now
  )
  update public.scheduled_notifications n set status = 'skipped', claimed_until = null
  from ranked where n.id = ranked.id and ranked.rn + ranked.sent_cnt > 6;
  get diagnostics v_b = row_count;

  return v_a + v_b;
end $$;

-- Ambil & klaim notifikasi jatuh tempo (fire_at ≤ now, > now − 2 jam) beserta subscription pengguna.
create or replace function public.fn_dispatch_candidates(p_now timestamptz default now())
returns table (id uuid, user_id uuid, category text, kind text, ref_type text, ref_id uuid, ref_day date, dedupe_key text,
               title text, body text, url text, actions jsonb, attempts int, fire_at timestamptz, subscriptions jsonb)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.fn_skip_irrelevant(p_now);
  return query
  with cand as (
    select n.id from public.scheduled_notifications n
    where n.status = 'pending' and n.fire_at <= p_now and n.fire_at > p_now - interval '2 hours'
      and (n.claimed_until is null or n.claimed_until < p_now)
    order by n.fire_at
    limit 200
    for update skip locked
  ), claimed as (
    update public.scheduled_notifications n
       set claimed_until = p_now + interval '3 minutes', attempts = n.attempts + 1
      from cand where n.id = cand.id
    returning n.*
  )
  select c.id, c.user_id, c.category, c.kind, c.ref_type, c.ref_id, c.ref_day, c.dedupe_key, c.title, c.body, c.url,
         c.actions, c.attempts::int, c.fire_at,
         coalesce((select jsonb_agg(jsonb_build_object('id', ps.id, 'endpoint', ps.endpoint, 'p256dh', ps.p256dh, 'auth', ps.auth))
                   from public.push_subscriptions ps where ps.user_id = c.user_id), '[]'::jsonb)
  from claimed c
  order by c.fire_at;
end $$;

-- Status akhir setelah percobaan kirim. 'failed' → kembali 'pending' sampai 3 percobaan, lalu 'failed'.
create or replace function public.fn_mark_notification(p_id uuid, p_status text)
returns text language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if p_status = 'sent' then
    update public.scheduled_notifications set status = 'sent', sent_at = now(), claimed_until = null
     where id = p_id returning status into v_status;
  elsif p_status = 'failed' then
    update public.scheduled_notifications
       set status = case when attempts >= 3 then 'failed' else 'pending' end, claimed_until = null
     where id = p_id returning status into v_status;
  elsif p_status = 'skipped' then
    update public.scheduled_notifications set status = 'skipped', claimed_until = null
     where id = p_id returning status into v_status;
  else
    raise exception 'Status tidak valid' using errcode = '22023';
  end if;
  return v_status;
end $$;

-- ---------- Push uji (dipanggil push-test sebagai pengguna; tanpa service role) ----------
create or replace function public.rpc_log_test_notification(p_title text, p_body text, p_ref_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  if (select count(*) from public.scheduled_notifications where user_id = v_uid and kind = 'test'
        and created_at > now() - interval '1 day') >= 30 then
    raise exception 'Terlalu banyak uji pengingat hari ini' using errcode = '54000';
  end if;
  if p_ref_id is not null and not exists (select 1 from public.routines where id = p_ref_id and user_id = v_uid) then
    p_ref_id := null;
  end if;
  insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                             title, body, url, actions, status, sent_at)
  values (v_uid, 'user', 'test', case when p_ref_id is null then null else 'routine' end, p_ref_id, public.wib_today(),
          'test:' || gen_random_uuid(), now(), left(coalesce(nullif(p_title, ''), 'Hamzi'), 120),
          left(coalesce(p_body, ''), 200), '/tumbuh', public.fn_notif_actions('test'), 'sent', now())
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.rpc_log_test_notification(text, text, uuid) from public, anon;
grant execute on function public.rpc_log_test_notification(text, text, uuid) to authenticated;

-- ---------- Kehadiran (dipakai notif-action "Tandai hadir" dan rpc_attendance_mark di 0008) ----------
create or replace function public.fn_attendance_mark_for(p_uid uuid, p_course_id uuid, p_date date, p_status text,
  p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_uid is null then raise exception 'Belum masuk' using errcode = '28000'; end if;
  if p_status not in ('hadir', 'izin', 'sakit', 'alpa') then raise exception 'Status tidak valid' using errcode = '22023'; end if;
  if p_date is null then raise exception 'Tanggal tidak valid' using errcode = '22023'; end if;
  if not exists (select 1 from public.courses where id = p_course_id and user_id = p_uid and deleted_at is null) then
    raise exception 'Mata kuliah tidak ditemukan' using errcode = 'P0002';
  end if;
  insert into public.attendances(user_id, course_id, meeting_date, status, note)
  values (p_uid, p_course_id, p_date, p_status, left(p_note, 500))
  on conflict (course_id, meeting_date) do update
    set status = excluded.status, note = coalesce(excluded.note, public.attendances.note)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'status', p_status);
end $$;

-- ---------- Transaksi berulang (TECH-SPEC §6.1 langkah 3) ----------
create or replace function public.fn_next_run(p_d date, p_freq text, p_n int, p_by_day smallint[], p_dom smallint)
returns date language plpgsql immutable as $$
declare v_n int := greatest(1, coalesce(p_n, 1)); v date; v_last int;
begin
  if p_freq = 'weekly' then
    if p_by_day is not null and array_length(p_by_day, 1) > 0 then
      for i in 1 .. 7 * v_n loop
        if extract(isodow from p_d + i)::int = any (p_by_day) then return p_d + i; end if;
      end loop;
    end if;
    return p_d + 7 * v_n;
  elsif p_freq = 'monthly' then
    v := (p_d + make_interval(months => v_n))::date;
    if p_dom is not null then
      v_last := extract(day from (date_trunc('month', v) + interval '1 month - 1 day'))::int;
      v := make_date(extract(year from v)::int, extract(month from v)::int, least(p_dom::int, v_last));
    end if;
    return v;
  end if;
  return p_d + v_n;   -- daily
end $$;

-- auto_post → insert transaksi (id deterministik md5(rule:tanggal) → tidak ganda); selain itu notifikasi konfirmasi.
create or replace function public.fn_run_recurring(p_today date default public.wib_today())
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_d date;
  v_last date;
  v_runs int;
  v_k int;
  v_n int := 0;
  v_kind text;
  v_wallet uuid;
  v_cat uuid;
  v_title text;
begin
  for r in select * from public.recurring_rules where active and next_run <= p_today order by next_run for update loop
    v_d := r.next_run; v_last := null; v_runs := 0;
    v_kind := r.template->>'kind';
    v_wallet := case when (r.template->>'wallet_id') ~* '^[0-9a-f-]{36}$' then (r.template->>'wallet_id')::uuid end;
    v_cat := case when (r.template->>'category_id') ~* '^[0-9a-f-]{36}$' then (r.template->>'category_id')::uuid end;
    if v_cat is not null and not exists (select 1 from public.categories where id = v_cat and user_id = r.user_id) then
      v_cat := null;
    end if;
    while v_d <= p_today and v_runs < 62 loop
      if r.auto_post and v_kind in ('expense', 'income') and (r.template->>'amount') ~ '^[0-9]{1,13}$'
         and (r.template->>'amount')::bigint > 0
         and exists (select 1 from public.wallets w where w.id = v_wallet and w.user_id = r.user_id) then
        perform set_config('hamzi.auto_post', 'on', true);       -- trigger XP transaksi melewati baris otomatis
        insert into public.transactions(id, user_id, kind, amount, wallet_id, category_id, occurred_at, note, recurring_rule_id)
        values (md5(r.id::text || ':' || v_d)::uuid, r.user_id, v_kind, (r.template->>'amount')::bigint, v_wallet, v_cat,
                (v_d + time '08:00') at time zone 'Asia/Jakarta', left(r.template->>'note', 140), r.id)
        on conflict (id) do nothing;
        get diagnostics v_k = row_count; v_n := v_n + v_k;
        perform set_config('hamzi.auto_post', 'off', true);
      end if;
      v_last := v_d;
      v_d := public.fn_next_run(v_d, r.freq, r.interval_n, r.by_day, r.day_of_month);
      v_runs := v_runs + 1;
    end loop;
    if not r.auto_post and v_last is not null then
      v_title := 'Konfirmasi ' || coalesce(nullif(btrim(r.template->>'name'), ''),
                                           (select c.name from public.categories c where c.id = v_cat), 'transaksi berulang');
      insert into public.scheduled_notifications(user_id, category, kind, ref_type, ref_id, ref_day, dedupe_key, fire_at,
                                                 title, body, url, actions)
      values (r.user_id, 'user', 'recurring', 'recurring_rule', r.id, v_last, 'recurring:' || r.id || ':' || v_last,
              greatest(now(), (p_today + time '08:00') at time zone 'Asia/Jakarta'), left(v_title, 120),
              public.fn_notif_body('recurring', r.id::text), '/keuangan/transaksi', '[]'::jsonb)
      on conflict (user_id, dedupe_key) do nothing;
      get diagnostics v_k = row_count; v_n := v_n + v_k;
    end if;
    update public.recurring_rules set next_run = v_d where id = r.id;
  end loop;
  return v_n;
end $$;

-- ---------- Pembersihan harian ----------
-- Purge soft delete > 30 hari, notifikasi > 30 hari. (0011 menambah chat: pesan > 30 hari, file > 7 hari.)
create or replace function public.fn_purge_daily(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t text;
  v_k int;
  v_total int := 0;
  v_notif int;
begin
  foreach t in array array['goal_contributions','savings_goals','transactions','exams','tasks','events','milestones','projects',
                           'routines','learning_modules','courses','semesters'] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < $1', t)
      using p_now - interval '30 days';
    get diagnostics v_k = row_count; v_total := v_total + v_k;
  end loop;
  delete from public.scheduled_notifications where created_at < p_now - interval '30 days' and status <> 'pending';
  get diagnostics v_notif = row_count;
  delete from public.job_runs where day < (p_now at time zone 'Asia/Jakarta')::date - 60;
  return jsonb_build_object('purged_rows', v_total, 'purged_notifications', v_notif);
end $$;

-- Job harian: jalan sekali per hari WIB setelah 00:05 (baris job_runs disisipkan dulu → idempoten).
-- Mengembalikan null bila belum waktunya / sudah jalan.
create or replace function public.fn_daily_maintenance(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_today date := (p_now at time zone 'Asia/Jakarta')::date; v_k int; v_rec int;
begin
  if (p_now at time zone 'Asia/Jakarta')::time < time '00:05' then return null; end if;
  insert into public.job_runs(job, day) values ('daily', v_today) on conflict do nothing;
  get diagnostics v_k = row_count;
  if v_k = 0 then return null; end if;
  v_rec := public.fn_run_recurring(v_today);
  return jsonb_build_object('day', v_today, 'recurring', v_rec) || public.fn_purge_daily(p_now);
end $$;

-- ---------- Hak akses: fungsi penjadwal hanya untuk service_role ----------
revoke execute on function public.fn_enqueue_notifications(timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_skip_irrelevant(timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_dispatch_candidates(timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_mark_notification(uuid, text) from public, anon, authenticated;
revoke execute on function public.fn_attendance_mark_for(uuid, uuid, date, text, text) from public, anon, authenticated;
revoke execute on function public.fn_run_recurring(date) from public, anon, authenticated;
revoke execute on function public.fn_purge_daily(timestamptz) from public, anon, authenticated;
revoke execute on function public.fn_daily_maintenance(timestamptz) from public, anon, authenticated;
grant execute on function public.fn_enqueue_notifications(timestamptz) to service_role;
grant execute on function public.fn_skip_irrelevant(timestamptz) to service_role;
grant execute on function public.fn_dispatch_candidates(timestamptz) to service_role;
grant execute on function public.fn_mark_notification(uuid, text) to service_role;
grant execute on function public.fn_attendance_mark_for(uuid, uuid, date, text, text) to service_role;
grant execute on function public.fn_run_recurring(date) to service_role;
grant execute on function public.fn_purge_daily(timestamptz) to service_role;
grant execute on function public.fn_daily_maintenance(timestamptz) to service_role;
