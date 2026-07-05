-- 밀웜 뽑기(가챠 v2) — 15밀웜/회, 일 3회, 미보유만 추첨(중복 없음)
-- ① 꽝 22%: 빈 캡슐 + 부스러기 +2밀웜 위로 보상
-- ② 아이템 확률 ∝ price^-1.8 (비쌀수록 극악 — 20밀웜 대비 100밀웜 ≈ 1/18)
-- ③ 전부 보유(컬렉션 완성) 시 잭팟 +30밀웜
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
  v_dud numeric := 0.22;
  v_bal int;
  v_spins int;
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

  -- 차감 + 횟수 기록(꽝 포함 모든 스핀에 적용)
  insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, -v_cost, 'gacha', 'spin');
  insert into earn_events (user_id, day, action, ref, count) values (v_uid, current_date, 'gacha', '', 1)
  on conflict (user_id, day, action, ref) do update set count = earn_events.count + 1;

  -- ① 꽝
  if random() < v_dud then
    insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 2, 'gacha_dust', '');
    return jsonb_build_object('ok', true, 'dud', true, 'dust', 2, 'balance', worm_balance(), 'spins_left', v_cap - v_spins - 1);
  end if;

  -- ② 가격 반비례 가중 추첨(지수 경주법): -ln(u)/w, w = price^-1.8 → 정렬키 -ln(u)*price^1.8
  select w.* into v_item from wardrobe_items w
   where not exists (select 1 from user_inventory i where i.user_id = v_uid and i.item_id = w.id)
   order by -ln(random()) * power(greatest(w.price_worms, 1), 1.8) asc
   limit 1;

  if v_item is null then
    -- ③ 컬렉션 완성 — 잭팟
    insert into worm_ledger (user_id, amount, reason, ref) values (v_uid, 30, 'gacha_jackpot', '');
    return jsonb_build_object('ok', true, 'jackpot', true, 'balance', worm_balance(), 'spins_left', v_cap - v_spins - 1);
  end if;

  insert into user_inventory (user_id, item_id) values (v_uid, v_item.id) on conflict do nothing;
  return jsonb_build_object(
    'ok', true,
    'item', jsonb_build_object('id', v_item.id, 'name', v_item.name, 'slot', v_item.slot, 'rarity', v_item.rarity, 'price', v_item.price_worms, 'asset_url', v_item.asset_url),
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
