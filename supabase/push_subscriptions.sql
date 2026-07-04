-- Web Push 구독 저장 (데일리 브리핑 알림)
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- RLS는 켜두되 직접 접근은 막고(정책 없음), 구독/해지는 SECURITY DEFINER 함수로만.
-- (PostgREST 필터형 DELETE/UPDATE는 SELECT 가시성을 요구 → SELECT 정책 열면 구독목록 노출.
--  RPC로 처리하면 RLS 우회 + 목록 비노출 + upsert 깔끔.)
alter table public.push_subscriptions enable row level security;
drop policy if exists "anyone can subscribe" on public.push_subscriptions;
drop policy if exists "unsubscribe by endpoint" on public.push_subscriptions;

-- 로그인 상태로 구독하면 user_id 기록 → 저장 항목 마감(D-day) 개인 알림에 사용
create or replace function public.subscribe_push(p_endpoint text, p_p256dh text, p_auth text)
returns void language sql security definer set search_path = public as $fn$
  insert into public.push_subscriptions (endpoint, p256dh, auth, user_id)
  values (p_endpoint, p_p256dh, p_auth, auth.uid())
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth,
        user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id);
$fn$;
grant execute on function public.subscribe_push(text, text, text) to anon, authenticated;

create or replace function public.unsubscribe_push(p_endpoint text)
returns void language sql security definer set search_path = public as $fn$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$fn$;
grant execute on function public.unsubscribe_push(text) to anon, authenticated;

-- 발송 성과 기록(발송 수). 클릭(CTR)은 UTM→GA4 로 집계. 클라이언트 접근 불가(RLS, 정책 없음).
create table if not exists public.push_sends (
  id uuid primary key default gen_random_uuid(),
  slug text, title text,
  sent int not null default 0,
  dead int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.push_sends enable row level security;
