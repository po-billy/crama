-- 이메일 뉴스레터 구독 테이블
create table if not exists public.email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.email_subscriptions enable row level security;

-- 발송 기록
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  slug text,
  title text,
  sent int not null default 0,
  failed int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.email_sends enable row level security;

-- RPC: 이메일 구독 (클라이언트에서 호출)
create or replace function public.subscribe_email(p_email text)
returns void language plpgsql security definer as $$
begin
  insert into public.email_subscriptions (email)
  values (lower(trim(p_email)))
  on conflict (email) do nothing;
end;
$$;

grant execute on function public.subscribe_email(text) to anon, authenticated;

-- RPC: 이메일 구독 해지
create or replace function public.unsubscribe_email(p_email text)
returns void language plpgsql security definer as $$
begin
  delete from public.email_subscriptions where email = lower(trim(p_email));
end;
$$;

grant execute on function public.unsubscribe_email(text) to anon, authenticated;
