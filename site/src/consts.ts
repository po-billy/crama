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

// ── 회원 UI 스위치 ──
// false: 로그인·마이·밀웜·옷장·뽑기·랭킹·투표·예측게임·AI 진단으로 가는 진입점과 로그인 잠금을 모두 숨긴다.
//        (코드·페이지는 그대로 남아 있고 URL 직접 접근만 가능, noindex + 사이트맵 제외)
//        관심함·내 정보는 계정 없이 이 기기(localStorage)에 저장된다.
// true : 예전처럼 회원 기능 전체 노출. astro.config.mjs 의 MEMBER_UI 도 함께 바꿀 것.
export const MEMBER_UI = false;
// 회원 전용(숨김 대상) 경로 — BaseHead noindex · 사이트맵 제외에 사용
export const MEMBER_PATHS = /^\/(login|me|wardrobe|worms|calendar|gacha|ranking|play|challenge|vote|ai-report|saved|membership)(\/|$)/;

// 헤더 내비게이션
export type NavItem = { label: string; href: string; icon?: string; member?: boolean; children?: NavItem[] };
const NAV_ALL: NavItem[] = [
  { label: 'Today 브리핑', href: '/briefing/' },
  { label: '돈·AI·부업', href: '/category/money/', children: [
    { label: '주식·재테크', href: '/category/money/', icon: 'money' },
    { label: 'AI 트렌드', href: '/category/ai/', icon: 'ai' },
    { label: '부업·지원금', href: '/category/income/', icon: 'income' },
  ]},
  { label: '혜택·정책', href: '/benefits/', children: [
    { label: '내 혜택 찾기', href: '/benefits/', icon: 'benefits' },
    { label: '내 돈 리포트', href: '/my-report/', icon: 'money' },
    { label: 'AI 재무 진단', href: '/ai-report/', icon: 'ai', member: true },
    { label: '청년 정책', href: '/youth/', icon: 'youth' },
    { label: '복지 서비스', href: '/welfare/', icon: 'welfare' },
    { label: '중위소득 계산', href: '/median-income/', icon: 'calc' },
    { label: '정책 캘린더', href: '/policy-calendar/', icon: 'calendar' },
    { label: '이벤트별 지원금', href: '/life/', icon: 'benefits' },
    { label: '내 관심함', href: '/saved-picks/', icon: 'saved' },
  ]},
  { label: '커리어', href: '/salary/', children: [
    { label: '연봉 실수령액', href: '/salary/', icon: 'income' },
    { label: '시급 → 월급 환산', href: '/wage/', icon: 'calc' },
    { label: '퇴직금 표', href: '/severance/', icon: 'income' },
    { label: '실업급여 계산', href: '/unemployment/', icon: 'diagnose' },
    { label: '전역일 계산', href: '/discharge/', icon: 'calendar' },
    { label: '재무 건강 체크업', href: '/checkup/', icon: 'checkup' },
    { label: '건강검진 대상 조회', href: '/health-check/', icon: 'checkup' },
  ]},
  { label: '금리·계산기', href: '/rates/', children: [
    { label: '예·적금 금리', href: '/rates/', icon: 'money' },
    { label: '대출 금리', href: '/loans/', icon: 'diagnose' },
    { label: '예금 이자 계산표', href: '/interest/', icon: 'calc' },
    { label: '금리 결정 캘린더', href: '/rate-calendar/', icon: 'calendar' },
    { label: '세금 캘린더·계산기', href: '/tax/', icon: 'calc' },
    { label: '금융 계산기 23종', href: '/tools/', icon: 'calc' },
  ]},
  { label: '쇼츠·칼럼', href: '/shorts/', children: [
    { label: '오르까 내리까', href: '/play/', icon: 'quiz', member: true },
    { label: '밀웜 뽑기', href: '/gacha/', icon: 'vote', member: true },
    { label: '무지출 챌린지', href: '/challenge/', icon: 'checkup', member: true },
    { label: '랭킹', href: '/ranking/', icon: 'income', member: true },
    { label: '쇼츠', href: '/shorts/', icon: 'shorts' },
    { label: '칼럼', href: '/column/', icon: 'column' },
    { label: '용어 사전', href: '/glossary/', icon: 'glossary' },
    { label: '가이드', href: '/guides/', icon: 'guide' },
    { label: '퀴즈', href: '/quiz/', icon: 'quiz' },
    { label: '빼꼼 투표', href: '/vote/', icon: 'vote', member: true },
    { label: '앱 설치', href: '/install/', icon: 'start' },
    { label: '소개', href: '/about/', icon: 'start' },
  ]},
];
// member 표시 항목은 MEMBER_UI 가 꺼져 있으면 메뉴에서 제외
export const NAV: NavItem[] = MEMBER_UI
  ? NAV_ALL
  : NAV_ALL.map((g) => (g.children ? { ...g, children: g.children.filter((c) => !c.member) } : g));

// 상단 공지/추천 배너 — 내용만 바꾸면 됨. key를 바꾸면 닫았던 사용자에게 다시 표시.
export const NOTICE = {
  enabled: true,
  key: '2026-07-benefits-b',
  text: '🗓️ 재산세 7월(16~31일) 납부 · 여름 전기요금 아끼는 법 — 이달 챙길 돈 한눈에',
  href: '/blog/july-2026-money-calendar/',
} as const;
