-- 밀웜 뽑기(가챠) — 15밀웜/회, 일 3회, 미보유 아이템만 추첨(중복 없음 = 컬렉션 동기)
-- rare 12% / common 88%, 해당 등급 소진 시 폴백, 전부 보유 시 잭팟 +30밀웜
create or replace function public.spin_gacha()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_cost int := 15;
  v_cap int := 3;
  v_bal int;
  v_spins int;
  v_rarity text;
  v_item record;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'login');
  end if;

  select coalesce(count, 0) into v_spins from earn_events
   where user_id = v_uid and day = current_date and action = 'gacha' and ref = '';
  v_spins := coalesce(v_spins, 0);
  if v_spins >= v_cap then
    return jsonb_build_object('ok', false, 'error', 'cap', 'spins_left', 0);
  end if;

  v_bal := worm_balance();
  if v_bal < v_cost then
    return jsonb_build_object('ok', false, 'error', 'insufficient', 'balance', v_bal);
  end if;

  -- 등급 추첨 후 미보유 후보에서 랜덤(소진 시 반대 등급 폴백)
  v_rarity := case when random() < 0.12 then 'rare' else 'common' end;
  select w.* into v_item from wardrobe_items w
   where w.rarity = v_rarity
     and not exists (select 1 from user_inventory i where i.user_id = v_uid and i.item_id = w.id)
   order by random() limit 1;
  if v_item is null then
    select w.* into v_item from wardrobe_items w
     where not exists (select 1 from user_inventory i where i.user_id = v_uid and i.item_id = w.id)
     order by random() limit 1;
  end if;

  -- 차감 + 횟수 기록
  insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, -v_cost, 'gacha', coalesce(v_item.id, 'jackpot'));
  insert into earn_events (user_id, day, action, ref, count) values (v_uid, current_date, 'gacha', '', 1)
  on conflict (user_id, day, action, ref) do update set count = earn_events.count + 1;

  if v_item is null then
    -- 컬렉션 완성 — 잭팟
    insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 30, 'gacha_jackpot', '');
    return jsonb_build_object('ok', true, 'jackpot', true, 'balance', worm_balance(), 'spins_left', v_cap - v_spins - 1);
  end if;

  insert into user_inventory (user_id, item_id) values (v_uid, v_item.id) on conflict do nothing;
  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object('id', v_item.id, 'name', v_item.name, 'slot', v_item.slot, 'rarity', v_item.rarity, 'asset_url', v_item.asset_url),
    'balance', worm_balance(),
    'spins_left', v_cap - v_spins - 1
  );
end;
$$;
grant execute on function public.spin_gacha() to authenticated;

-- 내 뽑기 현황(남은 횟수·컬렉션 진행)
create or replace function public.gacha_status()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'spins_left', greatest(0, 3 - coalesce((select count from earn_events where user_id = auth.uid() and day = current_date and action = 'gacha' and ref = ''), 0)),
    'owned', (select count(*) from user_inventory where user_id = auth.uid()),
    'total', (select count(*) from wardrobe_items),
    'balance', worm_balance()
  );
$$;
grant execute on function public.gacha_status() to authenticated;
