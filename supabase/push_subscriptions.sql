-- Web Push 구독 저장 (익명 구독 허용 — 데일리 브리핑 알림)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- 누구나 구독 추가 가능(푸시 구독은 공개 동작). 읽기/삭제 정책 없음 → 발송 서버(DB 직결)만 접근.
drop policy if exists "anyone can subscribe" on public.push_subscriptions;
create policy "anyone can subscribe" on public.push_subscriptions
  for insert to anon, authenticated with check (true);
