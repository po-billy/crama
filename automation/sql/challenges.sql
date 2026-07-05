-- 7일 무지출 챌린지 — 하루 1회 셀프 체크인(성공/실패), 목숨 2개, 7일 성공 시 완주
-- 보상: 성공 체크인 +2밀웜, 완주 +20밀웜(원장). 쓰기는 RPC로만.
create table if not exists public.challenges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'no-spend-7',
  started_on date not null default current_date,
  checkins jsonb not null default '{}'::jsonb,   -- {'2026-07-06': true|false}
  lives int not null default 2,
  status text not null default 'active',         -- active | done | failed
  finished_on date,
  created_at timestamptz default now()
);
create unique index if not exists challenges_one_active on public.challenges (user_id) where status = 'active';
alter table public.challenges enable row level security;
drop policy if exists "challenges read own" on public.challenges;
create policy "challenges read own" on public.challenges for select using (auth.uid() = user_id);

create or replace function public.start_challenge()
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_row challenges;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  if exists (select 1 from challenges where user_id = v_uid and status = 'active') then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;
  insert into challenges (user_id) values (v_uid) returning * into v_row;
  return jsonb_build_object('ok', true, 'challenge', to_jsonb(v_row));
end;
$$;
grant execute on function public.start_challenge() to authenticated;

create or replace function public.checkin_challenge(p_date date, p_success boolean)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_row challenges;
  v_succ int; v_fail int;
  v_reward int := 0;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'login'); end if;
  select * into v_row from challenges where user_id = v_uid and status = 'active';
  if v_row is null then return jsonb_build_object('ok', false, 'error', 'no_active'); end if;
  -- 오늘 또는 어제만, 시작일 이후, 중복 불가
  if p_date > current_date or p_date < current_date - 1 or p_date < v_row.started_on then
    return jsonb_build_object('ok', false, 'error', 'bad_date');
  end if;
  if v_row.checkins ? p_date::text then
    return jsonb_build_object('ok', false, 'error', 'already');
  end if;

  v_row.checkins := v_row.checkins || jsonb_build_object(p_date::text, p_success);
  v_succ := (select count(*) from jsonb_each(v_row.checkins) where value = 'true'::jsonb);
  v_fail := (select count(*) from jsonb_each(v_row.checkins) where value = 'false'::jsonb);

  if p_success then
    v_reward := 2;
    insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 2, 'challenge', p_date::text);
  end if;

  if v_succ >= 7 then
    v_row.status := 'done'; v_row.finished_on := current_date;
    v_reward := v_reward + 20;
    insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 20, 'challenge_done', v_row.id::text);
  elsif v_fail > v_row.lives then
    v_row.status := 'failed'; v_row.finished_on := current_date;
  end if;

  update challenges set checkins = v_row.checkins, status = v_row.status, finished_on = v_row.finished_on where id = v_row.id;
  return jsonb_build_object('ok', true, 'challenge', to_jsonb(v_row), 'reward', v_reward, 'balance', worm_balance());
end;
$$;
grant execute on function public.checkin_challenge(date, boolean) to authenticated;

create or replace function public.my_challenge()
returns jsonb
language sql security definer set search_path = public
as $$
  select jsonb_build_object(
    'active', (select to_jsonb(c) from challenges c where c.user_id = auth.uid() and c.status = 'active'),
    'last', (select to_jsonb(c) from challenges c where c.user_id = auth.uid() and c.status <> 'active' order by c.created_at desc limit 1),
    'dones', (select count(*) from challenges where user_id = auth.uid() and status = 'done')
  );
$$;
grant execute on function public.my_challenge() to authenticated;
