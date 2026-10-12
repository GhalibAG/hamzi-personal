-- =====================================================================================
-- 0009_goals.sql — Hamzi (M7.1)
-- TECH-SPEC §5.6: rpc_goals_overview, rpc_investments_overview, trigger XP target (goal_25/50/75/100, sekali per target).
-- Rumus setara common/calc/{goal,investment}.ts + features/goals/derive.ts (PRD §7.5, §7.7).
-- =====================================================================================

-- bulan_tersisa = max(1, ceil(hari / 30,4375))
create or replace function public.fn_months_left(p_days int) returns int language sql immutable as $$
  select greatest(1, ceil(greatest(p_days, 0) / 30.4375)::int) $$;

-- kebutuhan per bulan (dibulatkan ke atas); dengan return tahunan r%: P = (T − C(1+i)^n) / (((1+i)^n − 1)/i)
create or replace function public.fn_goal_monthly_needed(p_target bigint, p_saved bigint, p_months int, p_annual_pct numeric default 0)
returns bigint language plpgsql immutable as $$
declare v_n int := greatest(1, coalesce(p_months, 1)); v_i double precision; v_g double precision;
begin
  if p_target <= p_saved then return 0; end if;
  v_i := coalesce(p_annual_pct, 0)::double precision / 100 / 12;
  if v_i = 0 then return ceil((p_target - p_saved)::numeric / v_n)::bigint; end if;
  v_g := power(1 + v_i, v_n);
  return ceil((p_target - p_saved * v_g) / ((v_g - 1) / v_i))::bigint;
end $$;

create or replace function public.rpc_goals_overview()
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_today date := public.wib_today(); v_res jsonb;
begin
  with g as (
    select sg.*, coalesce((select sum(gc.amount) from public.goal_contributions gc
                           where gc.goal_id = sg.id and gc.deleted_at is null), 0)::bigint as saved
    from public.savings_goals sg where sg.user_id = v_uid and sg.deleted_at is null
  ), v as (
    select g.*,
      least(100, case when g.target_amount > 0 then public.fn_js_round(g.saved * 100.0 / g.target_amount) else 0 end)::int as pct,
      case when g.due_date is not null then public.fn_months_left(g.due_date - v_today) end as ml
    from g
  ), w as (
    select v.*,
      case when v.ml is not null then public.fn_goal_monthly_needed(v.target_amount, v.saved, v.ml, v.assumed_return_pct) end as monthly
    from v
  ), x as (
    select w.*,
      case when w.monthly is not null and w.monthly_plan is not null and w.monthly_plan > 0
           then w.monthly_plan >= w.monthly end as on_track
    from w
  )
  select jsonb_build_object(
    'goals', coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'name', x.name, 'kind', x.kind, 'status', x.status, 'priority', x.priority,
      'target_amount', x.target_amount, 'saved', x.saved, 'progress_pct', x.pct,
      'due_date', x.due_date, 'months_left', x.ml, 'monthly_needed', x.monthly, 'monthly_plan', x.monthly_plan,
      'plan_day', x.plan_day, 'on_track', x.on_track,
      'state', case when x.status = 'dibatalkan' then 'dibatalkan'
                    when x.status = 'selesai' or x.pct >= 100 then 'selesai'
                    when x.due_date is null then 'tanpa_tenggat'
                    when x.due_date < v_today or x.on_track = false then 'terlambat'
                    else 'di_jalur' end
    ) order by (x.status = 'aktif') desc, x.priority, x.created_at), '[]'::jsonb),
    'total_saved', coalesce(sum(x.saved) filter (where x.status = 'aktif'), 0),
    'total_target', coalesce(sum(x.target_amount) filter (where x.status = 'aktif'), 0)
  ) into v_res from x;
  return v_res;
end $$;

-- Investasi: modal_bersih = Σbeli+setor − Σjual+tarik; UL = nilai − modal; UL% (1 desimal); alokasi %.
create or replace function public.rpc_investments_overview()
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare v_uid uuid := auth.uid(); v_res jsonb;
begin
  with a as (
    select s.id, s.name, s.asset_class, s.platform_label,
      coalesce((select sum(case when t.kind in ('beli', 'setor') then t.amount else -t.amount end)
                from public.asset_transactions t where t.asset_id = s.id), 0)::bigint as capital,
      lv.value, lv.valued_on
    from public.assets s
    left join lateral (select v.value, v.valued_on from public.asset_valuations v where v.asset_id = s.id
                       order by v.valued_on desc limit 1) lv on true
    where s.user_id = v_uid and not s.archived
  ), t as (
    select coalesce(sum(coalesce(a.value, a.capital)), 0)::bigint as total_value,
           coalesce(sum(a.capital), 0)::bigint as total_capital
    from a
  )
  select jsonb_build_object(
    'assets', coalesce((select jsonb_agg(jsonb_build_object(
        'id', a.id, 'name', a.name, 'asset_class', a.asset_class,
        'capital', a.capital, 'value', a.value, 'valued_on', a.valued_on,
        'days_since_valuation', case when a.valued_on is not null then public.wib_today() - a.valued_on end,
        'pl', case when a.value is not null then a.value - a.capital end,
        'pl_pct', case when a.value is not null and a.capital > 0
                       then public.fn_js_round((a.value - a.capital) * 1000.0 / a.capital) / 10.0 end,
        'alloc_pct', case when t.total_value > 0
                          then public.fn_js_round(coalesce(a.value, a.capital) * 1000.0 / t.total_value) / 10.0 else 0 end
      ) order by coalesce(a.value, a.capital) desc) from a), '[]'::jsonb),
    'by_class', coalesce((select jsonb_agg(jsonb_build_object('asset_class', c.asset_class, 'alloc_pct', c.pct) order by c.pct desc)
      from (select a.asset_class,
                   case when t.total_value > 0
                        then public.fn_js_round(sum(coalesce(a.value, a.capital)) * 1000.0 / t.total_value) / 10.0 else 0 end as pct
            from a group by a.asset_class) c), '[]'::jsonb),
    'total_capital', t.total_capital,
    'total_value', t.total_value,
    'total_pl', t.total_value - t.total_capital,
    'total_pl_pct', case when t.total_capital > 0
                         then public.fn_js_round((t.total_value - t.total_capital) * 1000.0 / t.total_capital) / 10.0 end
  ) into v_res from t;
  return v_res;
end $$;

-- XP target tabungan (PRD §7.8): 25/50/75/100% = 20/30/40/100, sekali per target.
-- Turun di bawah ambang pada hari yang sama (Urungkan) → XP hari itu ditarik.
create or replace function public.trg_goal_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_goal uuid := coalesce(new.goal_id, old.goal_id);
  v_uid uuid;
  v_target bigint;
  v_saved bigint;
  m int;
begin
  select user_id, target_amount into v_uid, v_target from public.savings_goals where id = v_goal;
  if v_uid is null or coalesce(v_target, 0) <= 0 then return null; end if;
  select coalesce(sum(amount), 0) into v_saved from public.goal_contributions where goal_id = v_goal and deleted_at is null;
  foreach m in array array[25, 50, 75, 100] loop
    if v_saved * 100 >= v_target * m then
      if not exists (select 1 from public.xp_events where user_id = v_uid and kind = 'goal_' || m and ref_id = v_goal) then
        insert into public.xp_events(user_id, kind, ref_id, day, xp)
        values (v_uid, 'goal_' || m, v_goal, public.wib_today(), case m when 25 then 20 when 50 then 30 when 75 then 40 else 100 end)
        on conflict (user_id, kind, ref_id, day) do nothing;
      end if;
    else
      delete from public.xp_events where user_id = v_uid and kind = 'goal_' || m and ref_id = v_goal and day = public.wib_today();
    end if;
  end loop;
  return null;
end $$;
revoke execute on function public.trg_goal_xp() from public, anon, authenticated;
create trigger trg_goal_xp after insert or update or delete on public.goal_contributions
  for each row execute function public.trg_goal_xp();

revoke execute on function public.rpc_goals_overview() from public, anon;
revoke execute on function public.rpc_investments_overview() from public, anon;
grant execute on function public.rpc_goals_overview() to authenticated, service_role;
grant execute on function public.rpc_investments_overview() to authenticated, service_role;
