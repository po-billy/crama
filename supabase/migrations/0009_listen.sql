-- Crama: 누적 오디오 청취 시간(초) — /me 표기 + (이후) 업적 배지
alter table public.profiles add column if not exists listen_seconds bigint not null default 0;

-- 클라이언트가 모은 청취 delta(초)를 합산. 한 호출당 1시간 캡(어뷰징 방지).
create or replace function public.add_listen_seconds(secs int)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_add int := least(greatest(coalesce(secs, 0), 0), 3600);
  v_total bigint;
begin
  if v_uid is null then return null; end if;
  insert into public.profiles (id, listen_seconds)
    values (v_uid, v_add)
    on conflict (id) do update set listen_seconds = public.profiles.listen_seconds + v_add
    returning listen_seconds into v_total;
  return v_total;
end;
$$;

grant execute on function public.add_listen_seconds(int) to authenticated;
