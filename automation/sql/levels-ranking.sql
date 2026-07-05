-- 크라미 레벨(XP) + 주간 리더보드 (v2 — temp table 제거: anon 롤 TEMP 권한 없음)
-- XP = 평생 '획득' 밀웜 합(양수만). 레벨 곡선은 클라이언트(15n(n-1)).

create or replace function public.my_xp()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'xp', coalesce((select sum(amount) from worm_ledger where user_id = auth.uid() and amount > 0), 0),
    'week', coalesce((select sum(amount) from worm_ledger where user_id = auth.uid() and amount > 0 and created_at >= date_trunc('week', now())), 0)
  );
$$;
grant execute on function public.my_xp() to authenticated;

-- p_kind = 'worms_week' | 'predict' | 'challenge'
-- 반환: {top:[{nick,val,xp,me}...20], me:{rank,val,gap_next,next_nick}|null, total}
create or replace function public.leaderboard(p_kind text)
returns jsonb
language sql security definer set search_path = public
as $$
  with vals as (
    select user_id, sum(amount)::bigint as val from worm_ledger
      where p_kind = 'worms_week' and amount > 0 and created_at >= date_trunc('week', now())
      group by user_id
    union all
    select user_id, coalesce(sum(jsonb_array_length(score->'hits')), 0)::bigint from prediction_picks
      where p_kind = 'predict' and score is not null group by user_id
    union all
    select user_id, count(*)::bigint from challenges
      where p_kind = 'challenge' and status = 'done' group by user_id
  ),
  v2 as (select user_id, val from vals where val > 0),
  ranked as (
    select v.user_id, v.val,
      coalesce(nullif(trim(p.nickname), ''), '미어캣#' || right(v.user_id::text, 4)) as nick,
      coalesce((select sum(amount) from worm_ledger w where w.user_id = v.user_id and w.amount > 0), 0) as xp
    from v2 v left join profiles p on p.id = v.user_id
  ),
  mine as (select val from v2 where user_id = auth.uid())
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('nick', nick, 'val', val, 'xp', xp, 'me', user_id = auth.uid()) order by val desc, nick)
      from (select * from ranked order by val desc, nick limit 20) t20
    ), '[]'::jsonb),
    'total', (select count(*) from v2),
    'me', case when exists (select 1 from mine) then jsonb_build_object(
      'rank', (select count(*) + 1 from v2 where val > (select val from mine)),
      'val', (select val from mine),
      'gap_next', (select min(val) - (select val from mine) from v2 where val > (select val from mine)),
      'next_nick', (select nick from ranked where val > (select val from mine) order by val asc limit 1)
    ) else null end
  );
$$;
grant execute on function public.leaderboard(text) to authenticated, anon;
