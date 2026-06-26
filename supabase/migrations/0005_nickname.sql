-- 기본 닉네임을 '크라미+난수'로 (이메일 앞부분 대신). 변경은 앱에서 가능.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, '크라미' || floor(random() * 9000 + 1000)::int)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 기존 사용자 중 닉네임이 비었거나 이메일 앞부분(기본값)인 경우 → 크라미+난수로 교체
update public.profiles p
set nickname = '크라미' || floor(random() * 9000 + 1000)::int
from auth.users u
where u.id = p.id
  and (p.nickname is null or p.nickname = split_part(coalesce(u.email, ''), '@', 1));
