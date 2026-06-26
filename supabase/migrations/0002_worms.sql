-- Crama P3: 밀웜🐛 재화 엔진
-- 원장(worm_ledger) + 일별 스탬프(daily_stamps) + 액션 일일 횟수(earn_events)
-- 적립/차감은 RPC(서버 검증, 일일 캡)로만. 클라이언트 직접 insert 금지(RLS).

-- 1) 원장: 모든 적립/차감 기록. 잔액 = sum(amount)
create table if not exists public.worm_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  amount int not null,            -- +적립 / -차감
  reason text not null,           -- 'read' | 'audio' | 'quiz' | 'ad' | 'attend' | 'purchase'
  ref text,                       -- 글 slug / 아이템 id 등
  created_at timestamptz default now()
);
create index if not exists worm_ledger_user_idx on public.worm_ledger (user_id);

-- 2) 일별 스탬프: 그날 받은 밀웜 합계 + 활동 수 (캘린더 누적 스탬프용)
create table if not exists public.daily_stamps (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  worms_earned int not null default 0,
  activities int not null default 0,
  primary key (user_id, day)
);

-- 3) 액션 일일 횟수: 캡 관리 (예: 광고 3회/일, 완독 글당 1회)
create table if not exists public.earn_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  action text not null,
  ref text not null default '',   -- 글 slug 등 (완독 중복 방지)
  count int not null default 0,
  primary key (user_id, day, action, ref)
);

alter table public.worm_ledger enable row level security;
alter table public.daily_stamps enable row level security;
alter table public.earn_events enable row level security;

-- 읽기는 본인 것만. 쓰기는 RPC(security definer)로만 → insert/update 정책 없음.
drop policy if exists "ledger read own" on public.worm_ledger;
create policy "ledger read own" on public.worm_ledger for select using (auth.uid() = user_id);

drop policy if exists "stamps read own" on public.daily_stamps;
create policy "stamps read own" on public.daily_stamps for select using (auth.uid() = user_id);

drop policy if exists "events read own" on public.earn_events;
create policy "events read own" on public.earn_events for select using (auth.uid() = user_id);

-- 잔액 조회
create or replace function public.worm_balance()
returns int
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(amount), 0)::int from public.worm_ledger where user_id = auth.uid();
$$;

-- 적립 RPC: 액션별 일일 캡 검증 후 원장 + 일별스탬프 반영
-- daily_cap = 0 이면 무제한, ref 단위로 캡 적용(완독은 글당 1회).
create or replace function public.earn_worms(p_action text, p_ref text default '')
returns table (ok boolean, message text, balance int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := (now() at time zone 'utc')::date;
  v_amount int;
  v_cap int;
  v_used int;
begin
  if v_uid is null then
    return query select false, 'not_authenticated', 0; return;
  end if;

  -- 액션별 보상/캡 정의
  case p_action
    when 'read'   then v_amount := 1; v_cap := 1;  -- 글(ref)당 1회
    when 'audio'  then v_amount := 1; v_cap := 1;  -- 글(ref)당 1회
    when 'quiz'   then v_amount := 3; v_cap := 1;
    when 'ad'     then v_amount := 2; v_cap := 3;  -- 하루 3회
    when 'attend' then v_amount := 1; v_cap := 1;
    else
      return query select false, 'unknown_action', public.worm_balance(); return;
  end case;

  -- 현재 사용 횟수 (ref 단위)
  select coalesce(count, 0) into v_used
  from public.earn_events
  where user_id = v_uid and day = v_today and action = p_action and ref = coalesce(p_ref, '');

  if v_cap > 0 and v_used >= v_cap then
    return query select false, 'cap_reached', public.worm_balance(); return;
  end if;

  -- 횟수 +1
  insert into public.earn_events (user_id, day, action, ref, count)
  values (v_uid, v_today, p_action, coalesce(p_ref, ''), 1)
  on conflict (user_id, day, action, ref)
  do update set count = public.earn_events.count + 1;

  -- 원장 적립
  insert into public.worm_ledger (user_id, amount, reason, ref)
  values (v_uid, v_amount, p_action, coalesce(p_ref, ''));

  -- 일별 스탬프 누적
  insert into public.daily_stamps (user_id, day, worms_earned, activities)
  values (v_uid, v_today, v_amount, 1)
  on conflict (user_id, day)
  do update set worms_earned = public.daily_stamps.worms_earned + v_amount,
                activities = public.daily_stamps.activities + 1;

  return query select true, 'ok', public.worm_balance();
end;
$$;

grant execute on function public.worm_balance() to authenticated;
grant execute on function public.earn_worms(text, text) to authenticated;
