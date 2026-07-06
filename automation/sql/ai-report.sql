-- AI 정밀 재무 진단(/ai-report) — 일일 사용 게이트
-- 쓰기는 이 RPC로만(earn_events 'ai_report', 일 3회 캡). 적용: pgConn 또는 Supabase SQL Editor.

create or replace function public.use_ai_report()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_used int;
  v_cap int := 3;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'auth'); end if;
  insert into earn_events (user_id, day, action, ref, count) values (v_uid, current_date, 'ai_report', '', 1)
  on conflict (user_id, day, action, ref) do update set count = earn_events.count + 1
  returning count into v_used;
  if v_used > v_cap then
    update earn_events set count = count - 1 where user_id = v_uid and day = current_date and action = 'ai_report' and ref = '';
    return jsonb_build_object('ok', false, 'error', 'cap', 'left', 0);
  end if;
  return jsonb_build_object('ok', true, 'used', v_used, 'left', v_cap - v_used);
end $$;

grant execute on function public.use_ai_report() to authenticated;
revoke execute on function public.use_ai_report() from anon;
