-- Crama 회원 기능: 스크랩(북마크) · 연속출석 마일스톤 · 친구 초대(레퍼럴)

-- ===== 1) 스크랩(북마크) =====
create table if not exists public.bookmarks (
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  created_at timestamptz default now(),
  primary key (user_id, slug)
);
alter table public.bookmarks enable row level security;
drop policy if exists "bm read own" on public.bookmarks;
create policy "bm read own" on public.bookmarks for select using (auth.uid() = user_id);
drop policy if exists "bm insert own" on public.bookmarks;
create policy "bm insert own" on public.bookmarks for insert with check (auth.uid() = user_id);
drop policy if exists "bm delete own" on public.bookmarks;
create policy "bm delete own" on public.bookmarks for delete using (auth.uid() = user_id);

-- ===== 2) 연속출석 마일스톤 =====
create table if not exists public.streak_claims (
  user_id uuid not null references auth.users (id) on delete cascade,
  milestone int not null,
  claimed_at timestamptz default now(),
  primary key (user_id, milestone)
);
alter table public.streak_claims enable row level security;
drop policy if exists "sc read own" on public.streak_claims;
create policy "sc read own" on public.streak_claims for select using (auth.uid() = user_id);

-- 서버에서 streak 계산 후, 도달했지만 미수령한 마일스톤 보너스 지급
create or replace function public.claim_streak_milestone()
returns table (bonus int, reached int, balance int)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_check date := (now() at time zone 'utc')::date;
  v_streak int := 0;
  v_bonus int := 0;
  v_reached int := 0;
  m int;
  ms int[] := array[7,14,30,60,100];
  amt int;
begin
  if v_uid is null then return query select 0,0,0; return; end if;
  -- 오늘 미출석이면 어제부터
  if not exists (select 1 from daily_stamps where user_id=v_uid and day=v_check) then
    v_check := v_check - 1;
  end if;
  loop
    if exists (select 1 from daily_stamps where user_id=v_uid and day=v_check) then
      v_streak := v_streak + 1; v_check := v_check - 1;
    else exit; end if;
  end loop;

  foreach m in array ms loop
    if v_streak >= m and not exists (select 1 from streak_claims where user_id=v_uid and milestone=m) then
      amt := case m when 7 then 15 when 14 then 30 when 30 then 70 when 60 then 150 else 300 end;
      insert into streak_claims (user_id, milestone) values (v_uid, m);
      insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, amt, 'milestone', m::text);
      v_bonus := v_bonus + amt; v_reached := m;
    end if;
  end loop;
  return query select v_bonus, v_reached, public.worm_balance();
end;
$$;
grant execute on function public.claim_streak_milestone() to authenticated;

-- ===== 3) 친구 초대(레퍼럴) =====
alter table public.profiles add column if not exists referral_code text;
create unique index if not exists profiles_refcode_idx on public.profiles (referral_code);

-- 기존/신규 프로필에 6자리 코드 부여(uuid 파생 → 충돌 거의 없음)
update public.profiles set referral_code = upper(substr(replace(id::text,'-',''),1,6)) where referral_code is null;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nickname, referral_code)
  values (new.id, '크라미' || floor(random()*9000+1000)::int, upper(substr(replace(new.id::text,'-',''),1,6)))
  on conflict (id) do nothing;
  return new;
end; $$;

create table if not exists public.referrals (
  referee_id uuid primary key references auth.users (id) on delete cascade, -- 1인 1회만 추천받음
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz default now()
);
alter table public.referrals enable row level security;
drop policy if exists "ref read own" on public.referrals;
create policy "ref read own" on public.referrals for select using (auth.uid() = referee_id or auth.uid() = referrer_id);

-- 신규 유저가 추천코드로 보상 청구: 양쪽에 밀웜 지급(1회)
create or replace function public.claim_referral(p_code text)
returns table (ok boolean, message text, balance int)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid;
  v_bonus int := 20;
begin
  if v_uid is null then return query select false,'not_authenticated',0; return; end if;
  if exists (select 1 from referrals where referee_id=v_uid) then
    return query select false,'already_referred', public.worm_balance(); return;
  end if;
  select id into v_referrer from profiles where referral_code = upper(p_code);
  if v_referrer is null or v_referrer = v_uid then
    return query select false,'invalid_code', public.worm_balance(); return;
  end if;
  insert into referrals (referee_id, referrer_id) values (v_uid, v_referrer);
  insert into worm_ledger (user_id, amount, reason, ref) values
    (v_uid, v_bonus, 'referral', 'referee'),
    (v_referrer, v_bonus, 'referral', v_uid::text);
  return query select true,'ok', public.worm_balance();
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;
