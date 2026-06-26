-- ============ Crama 전체 스키마 (0001+0002+0003) ============
-- Supabase 대시보드 → SQL Editor → New query 에 전체 붙여넣고 Run

-- Crama P2: 회원 프로필
-- Supabase SQL Editor 에 붙여넣고 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text,
  interests text[] default '{}',
  theme_pref text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 본인 행만 읽기/생성/수정
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

-- 가입 시 프로필 자동 생성 (이메일 앞부분을 기본 닉네임으로)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(coalesce(new.email, 'meerkat'), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


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


-- Crama P4: 옷장 (파츠 카탈로그 + 보유 + 장착)
-- 슬롯: hat / glasses / scarf / outfit / floor / wallpaper
-- 구매/장착은 RPC(서버 검증, 밀웜 차감)로만. asset_url 은 더미 단계에선 색상 hex.

create table if not exists public.wardrobe_items (
  id text primary key,
  name text not null,
  slot text not null check (slot in ('hat','glasses','scarf','outfit','floor','wallpaper')),
  price_worms int not null default 0,
  rarity text default 'common',
  asset_url text,            -- 더미: 색상 hex / 추후: 파츠 PNG URL
  sort int default 0
);

create table if not exists public.user_inventory (
  user_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null references public.wardrobe_items (id) on delete cascade,
  acquired_at timestamptz default now(),
  primary key (user_id, item_id)
);

create table if not exists public.user_equipped (
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null,
  item_id text references public.wardrobe_items (id) on delete set null,
  primary key (user_id, slot)
);

alter table public.wardrobe_items enable row level security;
alter table public.user_inventory enable row level security;
alter table public.user_equipped enable row level security;

-- 카탈로그는 모두 읽기 가능
drop policy if exists "items public read" on public.wardrobe_items;
create policy "items public read" on public.wardrobe_items for select using (true);

drop policy if exists "inv read own" on public.user_inventory;
create policy "inv read own" on public.user_inventory for select using (auth.uid() = user_id);

drop policy if exists "equip read own" on public.user_equipped;
create policy "equip read own" on public.user_equipped for select using (auth.uid() = user_id);

-- 구매: 밀웜 차감 + 보유 등록
create or replace function public.buy_item(p_item_id text)
returns table (ok boolean, message text, balance int)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_price int;
  v_bal int;
begin
  if v_uid is null then return query select false, 'not_authenticated', 0; return; end if;

  select price_worms into v_price from public.wardrobe_items where id = p_item_id;
  if v_price is null then return query select false, 'unknown_item', public.worm_balance(); return; end if;

  if exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    return query select false, 'already_owned', public.worm_balance(); return;
  end if;

  v_bal := public.worm_balance();
  if v_bal < v_price then
    return query select false, 'insufficient', v_bal; return;
  end if;

  insert into public.worm_ledger (user_id, amount, reason, ref)
  values (v_uid, -v_price, 'purchase', p_item_id);

  insert into public.user_inventory (user_id, item_id) values (v_uid, p_item_id)
  on conflict do nothing;

  return query select true, 'ok', public.worm_balance();
end;
$$;

-- 장착: 슬롯당 1개 (보유한 아이템만)
create or replace function public.equip_item(p_item_id text)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_slot text;
begin
  if v_uid is null then return query select false, 'not_authenticated'; return; end if;
  select slot into v_slot from public.wardrobe_items where id = p_item_id;
  if v_slot is null then return query select false, 'unknown_item'; return; end if;
  if not exists (select 1 from public.user_inventory where user_id = v_uid and item_id = p_item_id) then
    return query select false, 'not_owned'; return;
  end if;

  insert into public.user_equipped (user_id, slot, item_id)
  values (v_uid, v_slot, p_item_id)
  on conflict (user_id, slot) do update set item_id = excluded.item_id;

  return query select true, 'ok';
end;
$$;

-- 해제
create or replace function public.unequip_slot(p_slot text)
returns table (ok boolean, message text)
language plpgsql security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return query select false, 'not_authenticated'; return; end if;
  delete from public.user_equipped where user_id = v_uid and slot = p_slot;
  return query select true, 'ok';
end;
$$;

grant execute on function public.buy_item(text) to authenticated;
grant execute on function public.equip_item(text) to authenticated;
grant execute on function public.unequip_slot(text) to authenticated;

-- 카탈로그 시드 (asset_url = 파츠 webp 경로). 라이브 DB와 동기화된 상태.
insert into public.wardrobe_items (id, name, slot, price_worms, rarity, asset_url, sort) values
  ('flr_wood','우드 바닥','floor',20,'common','/img/wardrobe/flr_wood.webp',1),
  ('flr_grass','잔디 바닥','floor',20,'common','/img/wardrobe/flr_grass.webp',2),
  ('flr_tile','체크 타일','floor',25,'common','/img/wardrobe/flr_tile.webp',3),
  ('flr_carpet','카펫','floor',30,'common','/img/wardrobe/flr_carpet.webp',4),
  ('flr_sand','모래사장','floor',25,'common','/img/wardrobe/flr_sand.webp',5),
  ('flr_marble','대리석','floor',50,'rare','/img/wardrobe/flr_marble.webp',6),
  ('flr_cloud','구름 바닥','floor',40,'rare','/img/wardrobe/flr_cloud.webp',7),
  ('gls_round','동그란 안경','glasses',15,'common','/img/wardrobe/gls_round.webp',1),
  ('gls_sun','선글라스','glasses',25,'common','/img/wardrobe/gls_sun.webp',2),
  ('gls_heart','하트 선글라스','glasses',30,'common','/img/wardrobe/gls_heart.webp',3),
  ('gls_3d','3D 안경','glasses',25,'common','/img/wardrobe/gls_3d.webp',4),
  ('gls_star','별 선글라스','glasses',30,'common','/img/wardrobe/gls_star.webp',5),
  ('hat_beanie','니트 비니','hat',20,'common','/img/wardrobe/hat_beanie.webp',1),
  ('hat_cap','볼캡','hat',30,'common','/img/wardrobe/hat_cap.webp',2),
  ('hat_crown','왕관','hat',120,'rare','/img/wardrobe/hat_crown.webp',3),
  ('hat_cowboy','카우보이 모자','hat',40,'common','/img/wardrobe/hat_cowboy.webp',4),
  ('hat_party','파티 고깔','hat',20,'common','/img/wardrobe/hat_party.webp',5),
  ('hat_chef','셰프 모자','hat',35,'common','/img/wardrobe/hat_chef.webp',6),
  ('out_diaper','기저귀','outfit',15,'common','/img/wardrobe/out_diaper.webp',10),
  ('out_overalls','멜빵','outfit',30,'common','/img/wardrobe/out_overalls.webp',11),
  ('out_patient','환자복','outfit',25,'common','/img/wardrobe/out_patient.webp',12),
  ('out_prison','죄수복','outfit',35,'common','/img/wardrobe/out_prison.webp',13),
  ('out_clown','삐에로 옷','outfit',45,'rare','/img/wardrobe/out_clown.webp',14),
  ('out_alpha','알파메일 정장','outfit',70,'rare','/img/wardrobe/out_alpha.webp',15),
  ('scf_terra','테라코타 스카프','scarf',10,'common','/img/wardrobe/scf_terra.webp',1),
  ('scf_blue','블루 머플러','scarf',20,'common','/img/wardrobe/scf_blue.webp',2),
  ('wal_cream','크림 벽지','wallpaper',30,'common','/img/wardrobe/wal_cream.webp',1),
  ('wal_night','나이트 벽지','wallpaper',40,'common','/img/wardrobe/wal_night.webp',2),
  ('wal_sky','하늘 벽지','wallpaper',30,'common','/img/wardrobe/wal_sky.webp',3),
  ('wal_pink','핑크 하트','wallpaper',30,'common','/img/wardrobe/wal_pink.webp',4),
  ('wal_mint','민트 스트라이프','wallpaper',30,'common','/img/wardrobe/wal_mint.webp',5),
  ('wal_forest','숲 벽지','wallpaper',35,'common','/img/wardrobe/wal_forest.webp',6),
  ('wal_space','우주 벽지','wallpaper',50,'rare','/img/wardrobe/wal_space.webp',7)
on conflict (id) do update set
  name = excluded.name, slot = excluded.slot, price_worms = excluded.price_worms,
  rarity = excluded.rarity, asset_url = excluded.asset_url, sort = excluded.sort;
