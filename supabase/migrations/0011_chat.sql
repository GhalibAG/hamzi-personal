-- =====================================================================================
-- 0011_chat.sql — Hamzi (M9.4)
-- TECH-SPEC §5.8: tabel chat (ai_conversations, ai_messages, ai_actions) + RLS "own rows" + Storage bucket privat
-- chat-uploads dengan kebijakan per folder pengguna. Pembersihan harian diperluas: pesan > 30 hari, file > 7 hari.
-- =====================================================================================

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '' check (char_length(content) <= 8000),
  attachments jsonb not null default '[]',   -- [{path,mime,name,size,pages}]
  proposals jsonb,                           -- lihat §7.8.5
  tools_used jsonb not null default '[]',    -- [{name,args,result_summary}] untuk Riwayat AI
  sent_payload jsonb,                        -- persis yang dikirim ke penyedia (tanpa base64 file)
  provider text, model text, tokens_in int, tokens_out int,
  status text not null default 'ok' check (status in ('ok','error','fallback','limited')),
  created_at timestamptz not null default now()
);
create table public.ai_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message_id uuid not null references public.ai_messages(id) on delete cascade,
  state text not null default 'pending' check (state in ('pending','applied','cancelled','undone')),
  applied_refs jsonb not null default '[]',  -- [{table,id}]
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index on public.ai_messages (conversation_id, created_at);
create index on public.ai_messages (user_id, created_at) where role = 'user';
create index on public.ai_actions (message_id);
create index on public.ai_conversations (user_id, updated_at desc) where deleted_at is null;

create trigger trg_ai_conversations_updated_at before update on public.ai_conversations
  for each row execute function public.set_updated_at();
create trigger trg_ai_actions_updated_at before update on public.ai_actions
  for each row execute function public.set_updated_at();

-- RLS "own rows" (salinan blok §5.3)
do $$
declare t text;
begin
  foreach t in array array['ai_conversations','ai_messages','ai_actions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
      using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

grant select, insert, update, delete on public.ai_conversations, public.ai_messages, public.ai_actions to authenticated;
grant all on public.ai_conversations, public.ai_messages, public.ai_actions to service_role;
revoke all on public.ai_conversations, public.ai_messages, public.ai_actions from anon;

-- Pesan & usulan hanya dibuat oleh Edge Function ai-chat (sebagai pengguna); klien boleh membaca, mengubah state
-- ai_actions (applied/cancelled/undone) & applied_refs, serta menyimpan hasil review mingguan sebagai pesan asisten.
-- (Tidak ada pelonggaran: semua tetap dibatasi RLS milik sendiri.)

-- Storage: bucket privat, ≤ 10 MB, MIME terbatas; path {user_id}/{yyyy-mm-dd}/{uuid}-{nama-aman}
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-uploads','chat-uploads', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "own chat uploads" on storage.objects for all to authenticated
  using (bucket_id = 'chat-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'chat-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Pengaman: semua tabel public wajib RLS.
do $$
declare t text;
begin
  for t in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity loop
    raise exception 'Tabel public.% belum memakai RLS', t;
  end loop;
end $$;

-- ---------- Pembersihan harian (create or replace dari 0006) ----------
-- + percakapan dihapus > 30 hari, pesan chat > 30 hari (CHAT-08), daftar file chat-uploads > 7 hari.
-- File TIDAK dihapus lewat SQL (Supabase melarang delete langsung di storage.objects): scheduler-tick menghapusnya
-- lewat Storage API memakai daftar 'old_chat_files'.
create or replace function public.fn_purge_daily(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  t text;
  v_k int;
  v_total int := 0;
  v_notif int;
  v_msgs int;
  v_files jsonb;
begin
  foreach t in array array['goal_contributions','savings_goals','transactions','exams','tasks','events','milestones','projects',
                           'routines','learning_modules','courses','semesters','ai_conversations'] loop
    execute format('delete from public.%I where deleted_at is not null and deleted_at < $1', t)
      using p_now - interval '30 days';
    get diagnostics v_k = row_count; v_total := v_total + v_k;
  end loop;
  delete from public.scheduled_notifications where created_at < p_now - interval '30 days' and status <> 'pending';
  get diagnostics v_notif = row_count;
  delete from public.ai_messages where created_at < p_now - interval '30 days';
  get diagnostics v_msgs = row_count;
  delete from public.ai_conversations c where c.created_at < p_now - interval '30 days'
    and not exists (select 1 from public.ai_messages m where m.conversation_id = c.id);
  delete from public.job_runs where day < (p_now at time zone 'Asia/Jakarta')::date - 60;
  select coalesce(jsonb_agg(o.name), '[]'::jsonb) into v_files
    from (select name from storage.objects where bucket_id = 'chat-uploads' and created_at < p_now - interval '7 days'
          order by created_at limit 1000) o;
  return jsonb_build_object('purged_rows', v_total, 'purged_notifications', v_notif, 'purged_messages', v_msgs,
                            'old_chat_files', v_files);
end $$;
revoke execute on function public.fn_purge_daily(timestamptz) from public, anon, authenticated;
grant execute on function public.fn_purge_daily(timestamptz) to service_role;
