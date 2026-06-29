// 사이트 전역 상수 — 브랜드/SEO 기본값
export const SITE = {
  name: 'Crama',
  title: '크라마(Crama) · 머니·재테크·AI 트렌드 인사이트 매거진',
  description:
    '크라마(Crama)는 주식·재테크와 AI 트렌드를 먼저 읽는 인사이트 매거진입니다. 매일 업데이트되는 원본 분석·가이드·계산기와 오디오 브리핑까지. (크림·크레마 아님)',
  url: 'https://crama.app',
  author: 'Crama 편집부',
  locale: 'ko_KR',
  tagline: '트렌드를 읽다',
} as const;

export type CategorySlug = 'money' | 'ai' | 'income';

export const CATEGORIES: Record<
  CategorySlug,
  { name: string; slug: CategorySlug; tagline: string; description: string }
> = {
  money: {
    name: '주식·재테크',
    slug: 'money',
    tagline: '돈의 흐름을 읽는 법',
    description:
      '국내·미국 주식, ETF와 배당, 절세와 연금까지 — 실전 투자에 바로 쓰는 깊이 있는 분석.',
  },
  ai: {
    name: 'AI 트렌드',
    slug: 'ai',
    tagline: '가장 빠른 AI 인사이트',
    description:
      '새 모델과 도구, 업무 자동화와 프롬프트, AI로 돈 버는 법까지 — 흐름을 놓치지 않는 안내서.',
  },
  income: {
    name: '부업·지원금',
    slug: 'income',
    tagline: '버는 힘을 키우다',
    description:
      '직장인 부업과 N잡, 정부지원금·정책까지 — 월급 밖에서 ‘부’를 키우는 실전 정보.',
  },
};

// 홈 '주목할 아티클' 랭킹 — 에디터 큐레이션(고가치·수익 글을 상단 노출). slug 순서 = 노출 순서.
// 주목할 아티클 랭킹 — 허브(필러)는 제외, 실제 개별 글만
export const EDITOR_PICKS = [
  'youth-future-savings-2026',
  'spacex-stock-buying-guide',
  'ai-trends-2026',
  'how-to-choose-brokerage',
  'credit-vs-check-card',
  'side-hustle-for-office-workers',
  'chatgpt-free-vs-paid',
] as const;

// 카테고리별 필러(허브) 가이드 — 글↔허브 양방향 링크 및 카테고리 상단 노출에 사용
export const PILLARS: Partial<Record<CategorySlug, string>> = {
  money: 'stock-investing-complete-guide',
  ai: 'ai-complete-guide',
  income: 'income-complete-guide',
};

// 가이드 섹션/목록에 함께 노출할 입문·완벽 가이드(필러 외, 순서 = 노출 순서)
export const GUIDE_EXTRA = [
  'us-stock-investment-beginners-guide',
  'personal-finance-beginners-guide',
  'isa-account-guide-2026',
  'free-ai-tools-guide',
  'ai-prompt-basics',
  'domestic-stock-beginners-guide',
] as const;

// Web Push 공개키(VAPID) — 클라이언트 구독용. 공개키라 커밋 안전(비밀키는 automation/.env)
export const VAPID_PUBLIC_KEY = 'BJXQcoA8xVdqQn6E5v_RqFZWZ6CokyEyaYQ_s3KnaYyIZg4GFRntAozu6LrGoB9Jp4Tfd17Zo4tDMNnHGH-WljQ';

// 헤더 내비게이션
export const NAV = [
  { label: '브리핑', href: '/briefing/' },
  { label: '주식·재테크', href: '/category/money/' },
  { label: 'AI 트렌드', href: '/category/ai/' },
  { label: '부업·지원금', href: '/category/income/' },
  { label: '쇼츠', href: '/shorts/' },
  { label: '칼럼', href: '/column/' },
  { label: '계산기', href: '/tools/' },
  { label: '소개', href: '/about/' },
] as const;

// 상단 공지/추천 배너 — 내용만 바꾸면 됨. key를 바꾸면 닫았던 사용자에게 다시 표시.
export const NOTICE = {
  enabled: true,
  key: '2026-06-coupon',
  text: '💸 민생회복 소비쿠폰 — 내 대상·금액(최대 60만원)·신청법 총정리 보기',
  href: '/blog/livelihood-coupon-2026/',
} as const;
