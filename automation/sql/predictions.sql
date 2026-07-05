-- 오르까 내리까 — 주간 금융 예측 게임
-- 라운드: open(예측 접수) → locked(금 15:30 기준가 기록) → settled(다음 금 종가로 판정·밀웜 지급)
-- 쓰기는 RPC(submit_prediction)로만 — 클라이언트 직접 insert/update 금지(락 이후 변경·score 조작 방지)

create table if not exists public.prediction_rounds (
  id text primary key,                       -- '2026-W28'
  opens_at timestamptz not null,
  locks_at timestamptz not null,             -- 예측 마감 + 기준가 시점
  settles_at timestamptz not null,           -- 판정(락 +7일)
  questions jsonb not null,                  -- [{key,label,emoji,unit,base?}]
  results jsonb,                             -- {kospi:{base,final,changePct,dir}}
  status text not null default 'open',       -- open | locked | settled
  created_at timestamptz default now()
);
alter table public.prediction_rounds enable row level security;
drop policy if exists "rounds read all" on public.prediction_rounds;
create policy "rounds read all" on public.prediction_rounds for select using (true);

create table if not exists public.prediction_picks (
  round_id text not null references public.prediction_rounds (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  picks jsonb not null,                      -- {kospi:'up'|'down', usd:..., btc:...}
  double_key text,                           -- 더블다운 문항(1개, 선택)
  score jsonb,                               -- 채점 후 {hits:[...], reward:n, perfect:bool, underdog:[...]}
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (round_id, user_id)
);
create index if not exists prediction_picks_round_idx on public.prediction_picks (round_id);
alter table public.prediction_picks enable row level security;
drop policy if exists "picks read own" on public.prediction_picks;
create policy "picks read own" on public.prediction_picks for select using (auth.uid() = user_id);

-- 제출/수정 RPC — 락 전까지만, picks 검증, score는 건드릴 수 없음
create or replace function public.submit_prediction(p_round text, p_picks jsonb, p_double text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  q jsonb;
  k text;
  v text;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;
  select * into r from prediction_rounds where id = p_round;
  if r is null or r.status <> 'open' or now() >= r.locks_at then
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;
  -- picks 키·값 검증(라운드 문항과 일치, up/down만)
  for q in select * from jsonb_array_elements(r.questions) loop
    k := q->>'key';
    v := p_picks->>k;
    if v is null or v not in ('up', 'down') then
      return jsonb_build_object('ok', false, 'error', 'bad_picks');
    end if;
  end loop;
  if p_double is not null and not (p_picks ? p_double) then
    return jsonb_build_object('ok', false, 'error', 'bad_double');
  end if;
  insert into prediction_picks (round_id, user_id, picks, double_key)
  values (p_round, auth.uid(), p_picks, p_double)
  on conflict (round_id, user_id)
  do update set picks = excluded.picks, double_key = excluded.double_key, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- 실시간 분포(익명 포함 조회 가능) — {total:n, dist:{kospi:{up:n,down:n},...}}
create or replace function public.prediction_stats(p_round text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total', (select count(*) from prediction_picks where round_id = p_round),
    'dist', coalesce((
      select jsonb_object_agg(k, d) from (
        select key as k, jsonb_object_agg(dir, cnt) as d from (
          select key, value #>> '{}' as dir, count(*) as cnt
          from prediction_picks, jsonb_each(picks)
          where round_id = p_round
          group by key, value #>> '{}'
        ) s group by key
      ) t
    ), '{}'::jsonb)
  );
$$;

-- 내 통산 성적(칭호용) — {rounds:n, hits:n, perfects:n, reward:n}
create or replace function public.my_prediction_record()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'rounds', count(*),
    'hits', coalesce(sum(jsonb_array_length(score->'hits')), 0),
    'perfects', count(*) filter (where (score->>'perfect')::boolean),
    'reward', coalesce(sum((score->>'reward')::int), 0)
  )
  from prediction_picks
  where user_id = auth.uid() and score is not null;
$$;
