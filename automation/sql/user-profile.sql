-- 내 정보(user_profile) — 프로필 허브: 나이·지역·연봉·차량 등(jsonb), 기능 프리필/등록 사이클용
-- 실행: Supabase SQL Editor (1회). RLS: 본인 행만.
-- 최소수집 원칙: 차량번호(번호판)는 저장하지 않는다(조회 기능 없음). 차량은 배기량·연식·전기차 여부만.

create table if not exists public.user_profile (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_profile enable row level security;

drop policy if exists "user_profile_select_own" on public.user_profile;
create policy "user_profile_select_own" on public.user_profile
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user_profile_upsert_own" on public.user_profile;
create policy "user_profile_upsert_own" on public.user_profile
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "user_profile_update_own" on public.user_profile;
create policy "user_profile_update_own" on public.user_profile
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_profile_delete_own" on public.user_profile;
create policy "user_profile_delete_own" on public.user_profile
  for delete to authenticated using (auth.uid() = user_id);
