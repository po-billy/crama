-- Crama: 업적 배지 — 해금되면 영구 보존(지표가 내려가도 유지)
create table if not exists public.user_badges (
  user_id uuid not null references auth.users (id) on delete cascade,
  badge_id text not null,
  earned_at timestamptz default now(),
  primary key (user_id, badge_id)
);
alter table public.user_badges enable row level security;
drop policy if exists "badges read own" on public.user_badges;
create policy "badges read own" on public.user_badges for select using (auth.uid() = user_id);

-- 현재 지표를 임계값과 비교해 새로 달성한 배지를 해금하고, 보유 배지 전체를 반환(is_new = 이번에 해금됨)
create or replace function public.check_badges()
returns table (badge_id text, is_new boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_listen bigint;
  v_streak int;
  v_reads int;
  v_worms int;
begin
  if v_uid is null then return; end if;

  select coalesce(listen_seconds, 0) into v_listen from public.profiles where id = v_uid;
  select coalesce(count(distinct ref), 0) into v_reads from public.worm_ledger where user_id = v_uid and reason = 'read';
  select coalesce(sum(amount), 0) into v_worms from public.worm_ledger where user_id = v_uid and amount > 0;
  -- 연속 출석 '피크'(섬 묶기): 가장 긴 연속일 구간 길이
  select coalesce(max(c), 0) into v_streak from (
    select count(*) c from (
      select (day - (row_number() over (order by day))::int) g
      from (select distinct day from public.daily_stamps where user_id = v_uid) d
    ) s group by g
  ) r;

  return query
  with defs(badge_id, metric, threshold) as (
    values
      ('listen_1h', 'listen', 3600), ('listen_5h', 'listen', 18000), ('listen_20h', 'listen', 72000), ('listen_100h', 'listen', 360000),
      ('streak_7', 'streak', 7), ('streak_30', 'streak', 30), ('streak_100', 'streak', 100),
      ('read_10', 'reads', 10), ('read_50', 'reads', 50), ('read_200', 'reads', 200),
      ('worm_100', 'worms', 100), ('worm_1000', 'worms', 1000)
  ),
  earned as (
    select d.badge_id from defs d
    where (d.metric = 'listen' and v_listen >= d.threshold)
       or (d.metric = 'streak' and v_streak >= d.threshold)
       or (d.metric = 'reads'  and v_reads  >= d.threshold)
       or (d.metric = 'worms'  and v_worms  >= d.threshold)
  ),
  ins as (
    insert into public.user_badges (user_id, badge_id)
    select v_uid, e.badge_id from earned e
    on conflict (user_id, badge_id) do nothing
    returning user_badges.badge_id
  )
  select ub.badge_id, (ub.badge_id in (select i.badge_id from ins i)) as is_new
  from public.user_badges ub
  where ub.user_id = v_uid;
end;
$$;

grant execute on function public.check_badges() to authenticated;
