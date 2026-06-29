-- 업적 배지 판정 — 지표(청취초/연속출석/완독수/누적밀웜) 대비 임계값으로 해금.
-- 단계 대폭 확장(초기 리텐션용으로 텀 촘촘). 기존 badge_id는 그대로 유지(이미 딴 배지 보존).
create or replace function public.check_badges()
returns table(badge_id text, is_new boolean)
language plpgsql security definer set search_path = public
as $bd$
#variable_conflict use_column
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
      ('listen_5m','listen',300),('listen_15m','listen',900),('listen_30m','listen',1800),
      ('listen_1h','listen',3600),('listen_5h','listen',18000),('listen_20h','listen',72000),
      ('listen_100h','listen',360000),('listen_300h','listen',1080000),('listen_1000h','listen',3600000),
      ('streak_1','streak',1),('streak_3','streak',3),('streak_7','streak',7),('streak_14','streak',14),
      ('streak_30','streak',30),('streak_60','streak',60),('streak_100','streak',100),
      ('streak_200','streak',200),('streak_365','streak',365),
      ('read_1','reads',1),('read_3','reads',3),('read_10','reads',10),('read_30','reads',30),
      ('read_50','reads',50),('read_100','reads',100),('read_200','reads',200),
      ('read_500','reads',500),('read_1000','reads',1000),
      ('worm_10','worms',10),('worm_50','worms',50),('worm_100','worms',100),('worm_300','worms',300),
      ('worm_1000','worms',1000),('worm_3000','worms',3000),('worm_10000','worms',10000)
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
$bd$;
