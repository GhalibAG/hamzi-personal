-- =====================================================================================
-- 0012_notes.sql — Hamzi: Catatan pribadi bebas ("catatan hidup")
-- Tanggal, judul opsional (<= 120), isi bebas (<= 20000), sematan, soft delete.
-- Catatan tidak boleh kosong total (judul terisi atau isi terisi).
-- =====================================================================================

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text,
  body text not null default '',
  note_date date not null default public.wib_today(),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check (title is null or char_length(title) <= 120),
  check (char_length(body) <= 20000),
  check (
    (title is not null and btrim(title) <> '') or
    (btrim(body) <> '')
  )
);

create index on public.notes (user_id, note_date desc, created_at desc) where deleted_at is null;

create trigger trg_notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

-- RLS "own rows" (mengikuti pola 0011_chat.sql baris 46-58)
alter table public.notes enable row level security;
create policy "own rows" on public.notes for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.notes to authenticated;
grant all on public.notes to service_role;
revoke all on public.notes from anon;
