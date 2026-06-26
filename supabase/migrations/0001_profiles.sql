-- Crama P2: 회원 프로필
-- Supabase SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  interests text[] default '{}',
  theme_pref text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 본인 행만 읽기/생성/수정
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

-- 가입 시 프로필 자동 생성 (이메일 앞부분을 기본 닉네임으로)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(coalesce(new.email, 'meerkat'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
