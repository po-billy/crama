// 사이트 전역 상수 — 브랜드/SEO 기본값
export const SITE = {
  name: 'Crama',
  title: 'Crama — 트렌드를 읽다',
  description:
    '주식·재테크와 AI 트렌드를 깊이 있게 읽는 인사이트 매거진. 매일 업데이트되는 원본 분석과 가이드.',
  url: 'https://crama.app',
  author: 'Crama 편집부',
  locale: 'ko_KR',
  tagline: '트렌드를 읽다',
} as const;

export type CategorySlug = 'money' | 'ai';

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
};

// 헤더 내비게이션
export const NAV = [
  { label: '주식·재테크', href: '/category/money/' },
  { label: 'AI 트렌드', href: '/category/ai/' },
  { label: '소개', href: '/about/' },
] as const;
