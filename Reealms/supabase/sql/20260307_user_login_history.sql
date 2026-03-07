-- Setup table for login device history
create extension if not exists pgcrypto;

create table if not exists public.user_login_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  platform text not null,
  logged_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_login_history_user_logged_at_idx
  on public.user_login_history (user_id, logged_at desc);

alter table public.user_login_history enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_login_history'
      and policyname = 'user_login_history_select_own'
  ) then
    create policy user_login_history_select_own
      on public.user_login_history
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_login_history'
      and policyname = 'user_login_history_insert_own'
  ) then
    create policy user_login_history_insert_own
      on public.user_login_history
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;
