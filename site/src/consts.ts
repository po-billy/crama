// 사이트 전역 상수 — 브랜드/SEO 기본값
export const SITE = {
  name: 'Crama',
  title: 'Crama(크라마) — 트렌드를 읽다',
  description:
    '주식·재테크와 AI 트렌드를 깊이 있게 읽는 인사이트 매거진 크라마(Crama). 매일 업데이트되는 원본 분석과 가이드.',
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

// 헤더 내비게이션
export const NAV = [
  { label: '주식·재테크', href: '/category/money/' },
  { label: 'AI 트렌드', href: '/category/ai/' },
  { label: '부업·지원금', href: '/category/income/' },
  { label: '계산기', href: '/tools/' },
  { label: '소개', href: '/about/' },
] as const;

// 상단 공지/추천 배너 — 내용만 바꾸면 됨. key를 바꾸면 닫았던 사용자에게 다시 표시.
export const NOTICE = {
  enabled: true,
  key: '2026-06',
  text: '📈 새 글 — 스페이스X(SPCX) 주식 사는 법: 2026 나스닥 상장 후 가이드',
  href: '/blog/spacex-stock-buying-guide/',
} as const;
