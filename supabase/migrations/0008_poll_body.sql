-- 투표 상세용 에디토리얼 본문(배경 설명, 힙/트렌디) + 리스트용 teaser
alter table public.polls add column if not exists body text;     -- 상세 본문(여러 문단)
alter table public.polls add column if not exists teaser text;   -- 리스트 한 줄 후킹
