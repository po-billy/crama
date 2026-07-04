-- 통합 관심 저장(saved_items) — 청년·복지·혜택 공용, 로그인 전용
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (1회)
-- RLS: 본인 행만 읽기/쓰기/삭제. 클라이언트는 익명 키 + 로그인 access_token으로 접근.

create table if not exists public.saved_items (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_type  text not null check (item_type in ('youth', 'welfare', 'benefit', 'exam', 'dday')),
  item_id    text not null,
  name       text not null,
  url        text,
  sub        text,
  deadline   date,
  created_at timestamptz not null default now(),
  primary key (user_id, item_type, item_id)
);

alter table public.saved_items enable row level security;

drop policy if exists "saved_items_select_own" on public.saved_items;
create policy "saved_items_select_own" on public.saved_items
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "saved_items_insert_own" on public.saved_items;
create policy "saved_items_insert_own" on public.saved_items
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "saved_items_update_own" on public.saved_items;
create policy "saved_items_update_own" on public.saved_items
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_items_delete_own" on public.saved_items;
create policy "saved_items_delete_own" on public.saved_items
  for delete to authenticated using (auth.uid() = user_id);

-- 마감 알림(P3) 발송 조회용 인덱스
create index if not exists saved_items_deadline_idx on public.saved_items (deadline) where deadline is not null;
