-- =====================================================================================
-- 0007_finance.sql — Hamzi (M5.1)
-- TECH-SPEC §5.6/§5.7: v_wallet_balance (security_invoker), rpc_finance_daily, rpc_finance_period,
-- trigger XP transaksi (+2, maks 3/hari, ditarik saat soft delete), rpc_home (create or replace: lengkap).
-- Rumus setara common/calc/budget.ts (test vector §13 #7–#9, #26, #27, #35).
-- =====================================================================================

-- ---------- §5.7 Saldo dompet (dihitung, tidak disimpan) ----------
create or replace view public.v_wallet_balance with (security_invoker = true) as
select w.id as wallet_id, w.user_id, w.name, w.kind, w.icon, w.color, w.archived, w.is_default, w.sort, w.opening_balance,
  (w.opening_balance + coalesce((
     select sum(case
       when t.kind = 'transfer' and t.wallet_id = w.id and t.to_wallet_id = w.id then 0
       when t.kind = 'income' and t.wallet_id = w.id then t.amount
       when t.kind = 'expense' and t.wallet_id = w.id then -t.amount
       when t.kind = 'adjustment' and t.wallet_id = w.id then t.amount * t.direction
       when t.kind = 'transfer' and t.wallet_id = w.id then -t.amount
       when t.kind = 'transfer' and t.to_wallet_id = w.id then t.amount
       else 0 end)
     from public.transactions t
     where t.deleted_at is null and t.user_id = w.user_id and (t.wallet_id = w.id or t.to_wallet_id = w.id)), 0))::bigint as balance
from public.wallets w;
revoke all on public.v_wallet_balance from anon;
grant select on public.v_wallet_balance to authenticated, service_role;

-- ---------- Rumus anggaran (PRD §7.4) ----------
create or replace function public.fn_cycle_end(p_date date, p_cycle_day int) returns date language sql immutable as $$
  select ((public.fn_cycle_start(p_date, p_cycle_day) + interval '1 month')::date - 1) $$;

-- hari_tersisa termasuk hari ini (min 1)
create or replace function public.fn_days_left_in_cycle(p_date date, p_cycle_day int) returns int language sql immutable as $$
  select greatest(1, public.fn_cycle_end(p_date, p_cycle_day) - p_date + 1) $$;

create or replace function public.fn_budget_used_pct(p_spent bigint, p_budget bigint) returns int language sql immutable as $$
  select case when coalesce(p_budget, 0) <= 0 then 0 else public.fn_js_round(p_spent * 100.0 / p_budget)::int end $$;

-- aman_per_hari = floor(max(0, sisa) / hari_tersisa / 1000) × 1000
create or replace function public.fn_safe_daily_rounded(p_budget bigint, p_spent bigint, p_days_left int)
returns bigint language sql immutable as $$
  select (floor(greatest(0, coalesce(p_budget, 0) - coalesce(p_spent, 0))::numeric / greatest(1, p_days_left) / 1000) * 1000)::bigint $$;

-- (hari_ini − rata2) / rata2 dibulatkan; null bila rata-rata 0
create or replace function public.fn_pct_vs_avg(p_today bigint, p_avg bigint) returns int language sql immutable as $$
  select case when coalesce(p_avg, 0) <= 0 then null else public.fn_js_round((p_today - p_avg) * 100.0 / p_avg)::int end $$;

-- ---------- rpc_finance_daily (TECH-SPEC §5.6; nilai mentah + turunan) ----------
create or replace function public.rpc_finance_daily(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_cd int := coalesce((select budget_cycle_day from public.user_settings where user_id = auth.uid()), 1);
  v_cs date;
  v_ce date;
  v_today bigint;
  v_avg bigint;
  v_cycle bigint;
  v_income bigint;
  v_budget bigint;
  v_days int;
begin
  v_cs := public.fn_cycle_start(p_date, v_cd);
  v_ce := public.fn_cycle_end(p_date, v_cd);
  v_days := public.fn_days_left_in_cycle(p_date, v_cd);
  select coalesce(sum(amount), 0) into v_today from public.transactions
   where user_id = v_uid and kind = 'expense' and deleted_at is null and occurred_on = p_date;
  select public.fn_js_round(coalesce(sum(amount), 0) / 7.0) into v_avg from public.transactions
   where user_id = v_uid and kind = 'expense' and deleted_at is null and occurred_on between p_date - 7 and p_date - 1;
  select coalesce(sum(amount), 0) into v_cycle from public.transactions
   where user_id = v_uid and kind = 'expense' and deleted_at is null and occurred_on between v_cs and p_date;
  select coalesce(sum(amount), 0) into v_income from public.transactions
   where user_id = v_uid and kind = 'income' and deleted_at is null and occurred_on between v_cs and p_date;
  select amount into v_budget from public.budgets
   where user_id = v_uid and category_id is null and effective_from <= p_date order by effective_from desc limit 1;
  return jsonb_build_object(
    'date', p_date,
    'spent_today', v_today,
    'avg_daily_7d', v_avg,
    'spent_cycle', v_cycle,
    'income_cycle', v_income,
    'budget_total', v_budget,
    'cycle_start', v_cs,
    'cycle_end', v_ce,
    'days_left', v_days,
    'budget_used_pct', public.fn_budget_used_pct(v_cycle, v_budget),
    'safe_daily', case when coalesce(v_budget, 0) > 0 then public.fn_safe_daily_rounded(v_budget, v_cycle, v_days) else 0 end,
    'pct_vs_avg', public.fn_pct_vs_avg(v_today, v_avg),
    'top_category_today', (
      select coalesce(c.name, 'Lainnya') from public.transactions t
      left join public.categories c on c.id = t.category_id
      where t.user_id = v_uid and t.kind = 'expense' and t.deleted_at is null and t.occurred_on = p_date
      group by c.name order by sum(t.amount) desc, c.name limit 1),
    'balance_total', coalesce((select sum(balance) from public.v_wallet_balance where user_id = v_uid and not archived), 0)
  );
end $$;

-- ---------- rpc_finance_period: per kategori, masuk/keluar, banding periode sebelumnya ----------
create or replace function public.rpc_finance_period(p_from date, p_to date)
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_days int;
  v_pf date;
  v_pt date;
  v_exp bigint;
  v_inc bigint;
  v_pexp bigint;
  v_pinc bigint;
begin
  if p_from is null or p_to is null or p_to < p_from then raise exception 'Periode tidak valid' using errcode = '22023'; end if;
  if p_to - p_from > 400 then raise exception 'Periode terlalu panjang' using errcode = '22023'; end if;
  v_days := p_to - p_from + 1;
  v_pt := p_from - 1;
  v_pf := p_from - v_days;
  select coalesce(sum(amount) filter (where kind = 'expense'), 0), coalesce(sum(amount) filter (where kind = 'income'), 0)
    into v_exp, v_inc from public.transactions
   where user_id = v_uid and deleted_at is null and occurred_on between p_from and p_to;
  select coalesce(sum(amount) filter (where kind = 'expense'), 0), coalesce(sum(amount) filter (where kind = 'income'), 0)
    into v_pexp, v_pinc from public.transactions
   where user_id = v_uid and deleted_at is null and occurred_on between v_pf and v_pt;
  return jsonb_build_object(
    'from', p_from, 'to', p_to, 'days', v_days,
    'expense', v_exp, 'income', v_inc, 'net', v_inc - v_exp,
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', x.category_id, 'name', x.name, 'amount', x.amount,
                                          'pct', case when v_exp > 0 then public.fn_js_round(x.amount * 100.0 / v_exp) else 0 end)
                       order by x.amount desc, x.name)
      from (select t.category_id, coalesce(c.name, 'Lainnya') as name, sum(t.amount) as amount
            from public.transactions t left join public.categories c on c.id = t.category_id
            where t.user_id = v_uid and t.deleted_at is null and t.kind = 'expense' and t.occurred_on between p_from and p_to
            group by t.category_id, c.name) x), '[]'::jsonb),
    'income_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', x.category_id, 'name', x.name, 'amount', x.amount) order by x.amount desc)
      from (select t.category_id, coalesce(c.name, 'Lainnya') as name, sum(t.amount) as amount
            from public.transactions t left join public.categories c on c.id = t.category_id
            where t.user_id = v_uid and t.deleted_at is null and t.kind = 'income' and t.occurred_on between p_from and p_to
            group by t.category_id, c.name) x), '[]'::jsonb),
    'prev', jsonb_build_object('from', v_pf, 'to', v_pt, 'expense', v_pexp, 'income', v_pinc),
    'expense_change_pct', public.fn_pct_vs_avg(v_exp, v_pexp)
  );
end $$;

-- ---------- XP transaksi (PRD §7.8: +2, maks 3/hari; ditarik bila di-soft-delete) ----------
create or replace function public.trg_tx_xp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.kind not in ('expense', 'income') then return null; end if;
  if (tg_op = 'INSERT' and new.deleted_at is null)
     or (tg_op = 'UPDATE' and old.deleted_at is not null and new.deleted_at is null) then
    -- baris otomatis dari fn_run_recurring tidak memberi XP (bukan aksi pengguna)
    if coalesce(current_setting('hamzi.auto_post', true), 'off') <> 'on'
       and (select count(*) from public.xp_events where user_id = new.user_id and kind = 'tx' and day = new.occurred_on) < 3 then
      insert into public.xp_events(user_id, kind, ref_id, day, xp) values (new.user_id, 'tx', new.id, new.occurred_on, 2)
        on conflict (user_id, kind, ref_id, day) do nothing;
    end if;
  elsif tg_op = 'UPDATE' and old.deleted_at is null and new.deleted_at is not null then
    delete from public.xp_events where user_id = new.user_id and kind = 'tx' and ref_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function public.trg_tx_xp() from public, anon, authenticated;
create trigger trg_tx_xp after insert or update of deleted_at on public.transactions
  for each row execute function public.trg_tx_xp();

-- ---------- rpc_home (lengkap) ----------
create or replace function public.rpc_home(p_date date default public.wib_today())
returns jsonb language plpgsql stable security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_min int := public.fn_wib_minutes(public.fn_ref_now(p_date));
  v_sched jsonb := public.rpc_schedule_overview(p_date);
  v_tasks jsonb := public.rpc_tasks_overview(p_date, 20);
  v_fin jsonb := public.rpc_finance_daily(p_date);
  v_growth jsonb := public.rpc_growth_overview(p_date);
  v_xp int := coalesce((select xp_total from public.user_stats where user_id = auth.uid()), 0);
  v_next jsonb;
  v_goal jsonb;
begin
  select c into v_next from jsonb_array_elements(v_sched->'classes_today') c
  where p_date <> public.wib_today()
     or v_min < (split_part(c->>'end', ':', 1)::int * 60 + split_part(c->>'end', ':', 2)::int)
  limit 1;
  if v_next is not null and p_date = public.wib_today() then
    v_next := v_next || jsonb_build_object('minutes_until',
      (split_part(v_next->>'start', ':', 1)::int * 60 + split_part(v_next->>'start', ':', 2)::int) - v_min);
  end if;

  -- target teratas: aktif, prioritas terkecil = terpenting
  select jsonb_build_object('id', g.id, 'name', g.name, 'kind', g.kind, 'target_amount', g.target_amount,
                            'saved', s.saved,
                            'progress_pct', least(100, case when g.target_amount > 0
                                                       then public.fn_js_round(s.saved * 100.0 / g.target_amount) else 0 end))
    into v_goal
  from public.savings_goals g
  cross join lateral (select coalesce(sum(amount), 0) as saved from public.goal_contributions gc
                      where gc.goal_id = g.id and gc.deleted_at is null) s
  where g.user_id = v_uid and g.deleted_at is null and g.status = 'aktif'
  order by g.priority, g.created_at limit 1;

  return jsonb_build_object(
    'date', p_date,
    'weekday', public.fn_hari(p_date),
    'part_of_day', public.fn_part_of_day(v_min),
    'display_name', (select display_name from public.profiles where id = v_uid),
    -- keuangan (nilai sama dengan rpc_finance_daily)
    'spent_today', v_fin->'spent_today',
    'avg_daily_7d', v_fin->'avg_daily_7d',
    'pct_vs_avg', v_fin->'pct_vs_avg',
    'budget_used_pct', v_fin->'budget_used_pct',
    'safe_daily', v_fin->'safe_daily',
    'balance_total', v_fin->'balance_total',
    'days_left', v_fin->'days_left',
    'next_class', v_next,
    'tasks_top', coalesce((
      select jsonb_agg(t order by ord) from (
        select t, ord from jsonb_array_elements(v_tasks->'top') with ordinality as x(t, ord)
        where t->>'due_date' is null or (t->>'due_date')::date <= p_date + 1
        order by ord limit 3) s), '[]'::jsonb),
    'tasks', jsonb_build_object('due_today', v_tasks->'due_today', 'overdue', v_tasks->'overdue', 'done_today', v_tasks->'done_today'),
    'top_goal', v_goal,
    'streak', v_growth->'streak',
    'growth', jsonb_build_object('water_total', v_growth->'water_total', 'stage_name', v_growth->'stage_name',
                                 'garden_level_today', v_growth->'garden_level_today', 'bloom_today', v_growth->'bloom_today',
                                 'required_due', v_growth->'required_due', 'required_done', v_growth->'required_done'),
    'level', public.fn_level_from_xp(v_xp),
    'xp_total', v_xp,
    'xp', public.fn_xp_progress(v_xp),
    'unread_notifications', (select count(*) from public.scheduled_notifications
                             where user_id = v_uid and status = 'sent' and read_at is null)
  );
end $$;

revoke execute on function public.rpc_finance_daily(date) from public, anon;
revoke execute on function public.rpc_finance_period(date, date) from public, anon;
revoke execute on function public.rpc_home(date) from public, anon;
grant execute on function public.rpc_finance_daily(date) to authenticated, service_role;
grant execute on function public.rpc_finance_period(date, date) to authenticated, service_role;
grant execute on function public.rpc_home(date) to authenticated, service_role;
