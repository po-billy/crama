-- Crama 투표·여론 (피자스테이션류): 트렌드 이슈 투표 + 의견. 투표 시 밀웜 적립.

create table if not exists public.polls (
  id bigint generated always as identity primary key,
  question text not null,
  options jsonb not null,          -- ["합리적","과도해"]
  emoji text,                      -- 토픽 이모지(선택)
  context text,                    -- 한 줄 배경 설명(선택)
  source_slug text,                -- 연관 글 slug(선택)
  active boolean default true,
  created_at timestamptz default now()
);
alter table public.polls enable row level security;
drop policy if exists "polls public read" on public.polls;
create policy "polls public read" on public.polls for select using (true);

create table if not exists public.poll_votes (
  poll_id bigint not null references public.polls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  choice int not null,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);
alter table public.poll_votes enable row level security;
drop policy if exists "pv read own" on public.poll_votes;
create policy "pv read own" on public.poll_votes for select using (auth.uid() = user_id);

create table if not exists public.poll_opinions (
  id bigint generated always as identity primary key,
  poll_id bigint not null references public.polls (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text,
  choice int,
  text text not null,
  created_at timestamptz default now()
);
alter table public.poll_opinions enable row level security;
drop policy if exists "po public read" on public.poll_opinions;
create policy "po public read" on public.poll_opinions for select using (true);

-- 결과 집계(공개): {"0":120,"1":80,"total":200}
create or replace function public.poll_results(p_poll_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; t int;
begin
  select coalesce(jsonb_object_agg(choice::text, c), '{}'::jsonb), coalesce(sum(c), 0)
    into r, t
  from (select choice, count(*)::int c from poll_votes where poll_id = p_poll_id group by choice) x;
  return coalesce(r, '{}'::jsonb) || jsonb_build_object('total', coalesce(t, 0));
end; $$;
grant execute on function public.poll_results(bigint) to anon, authenticated;

-- 투표: 1인 1표, 밀웜 +3, 결과 반환
create or replace function public.vote_poll(p_poll_id bigint, p_choice int)
returns table (ok boolean, message text, counts jsonb, balance int, my_choice int)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_existing int; v_nopts int;
begin
  if v_uid is null then return query select false, 'not_authenticated', null::jsonb, 0, null::int; return; end if;
  select jsonb_array_length(options) into v_nopts from polls where id = p_poll_id and active;
  if v_nopts is null then return query select false, 'no_poll', null::jsonb, public.worm_balance(), null::int; return; end if;
  if p_choice < 0 or p_choice >= v_nopts then return query select false, 'bad_choice', null::jsonb, public.worm_balance(), null::int; return; end if;

  select choice into v_existing from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  if v_existing is not null then
    return query select true, 'already_voted', public.poll_results(p_poll_id), public.worm_balance(), v_existing; return;
  end if;

  insert into poll_votes (poll_id, user_id, choice) values (p_poll_id, v_uid, p_choice);
  insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 3, 'poll', p_poll_id::text);
  return query select true, 'ok', public.poll_results(p_poll_id), public.worm_balance(), p_choice;
end; $$;
grant execute on function public.vote_poll(bigint, int) to authenticated;

-- 의견 남기기: 닉네임·선택지 서버에서 채움
create or replace function public.add_opinion(p_poll_id bigint, p_text text)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_nick text; v_choice int;
begin
  if v_uid is null then return query select false, 'not_authenticated'; return; end if;
  if length(trim(coalesce(p_text, ''))) = 0 then return query select false, 'empty'; return; end if;
  select nickname into v_nick from profiles where id = v_uid;
  select choice into v_choice from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  insert into poll_opinions (poll_id, user_id, nickname, choice, text)
  values (p_poll_id, v_uid, coalesce(v_nick, '크라미'), v_choice, left(trim(p_text), 280));
  return query select true, 'ok';
end; $$;
grant execute on function public.add_opinion(bigint, text) to authenticated;
