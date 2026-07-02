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
  'cost-of-a-good-question',
  'unclaimed-money-refunds-2026',
  'agentic-ai-workflow-automation-strategy',
  'employed-side-job-guide-risk-insurance-tax',
  'youth-rent-support-2026',
  'luck-surface-area',
  'household-ledger-real-money-leak',
  'first-stock-loss-one-principle',
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
export type NavItem = { label: string; href: string; icon?: string; children?: NavItem[] };
export const NAV: NavItem[] = [
  { label: 'Today 브리핑', href: '/briefing/' },
  { label: '돈·AI·부업', href: '/category/money/', children: [
    { label: '주식·재테크', href: '/category/money/', icon: 'money' },
    { label: 'AI 트렌드', href: '/category/ai/', icon: 'ai' },
    { label: '부업·지원금', href: '/category/income/', icon: 'income' },
  ]},
  { label: '혜택·진단', href: '/benefits/', children: [
    { label: '내 혜택 찾기', href: '/benefits/', icon: 'benefits' },
    { label: '재무 건강 체크업', href: '/checkup/', icon: 'checkup' },
    { label: '정책 캘린더', href: '/policy-calendar/', icon: 'calendar' },
    { label: '청년 정책', href: '/youth/', icon: 'youth' },
    { label: '금융 계산기', href: '/tools/', icon: 'calc' },
  ]},
  { label: '쇼츠·칼럼', href: '/shorts/', children: [
    { label: '쇼츠', href: '/shorts/', icon: 'shorts' },
    { label: '칼럼', href: '/column/', icon: 'column' },
    { label: '용어 사전', href: '/glossary/', icon: 'glossary' },
    { label: '가이드', href: '/guides/', icon: 'guide' },
    { label: '퀴즈', href: '/quiz/', icon: 'quiz' },
    { label: '빼꼼 투표', href: '/vote/', icon: 'vote' },
    { label: '앱 설치', href: '/install/', icon: 'start' },
    { label: '소개', href: '/about/', icon: 'start' },
  ]},
];

// 상단 공지/추천 배너 — 내용만 바꾸면 됨. key를 바꾸면 닫았던 사용자에게 다시 표시.
export const NOTICE = {
  enabled: true,
  key: '2026-07-benefits',
  text: '🗓️ 청년미래적금 자격조회 7/3 마감 · 재산세 7월 — 이달 챙길 돈 한눈에',
  href: '/blog/july-2026-money-calendar/',
} as const;
