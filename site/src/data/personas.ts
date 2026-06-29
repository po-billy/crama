// 칼럼니스트 페르소나 — 칼럼(format: 'column') 글의 바이라인.
// AuthorBox가 글의 author 이름으로 이 목록을 조회해 프로필을 렌더한다.
// 정보성(가이드) 글은 'Crama 편집부'를 그대로 사용한다.
import type { CategorySlug } from '../consts';

export type Persona = {
  name: string;
  beat: string; // 담당 분야
  bio: string; // 한두 문장 소개(목소리 중심)
  initial: string; // 아바타 이니셜
};

// 이름(byline)을 키로 조회 — 글 frontmatter의 author 값과 일치해야 한다.
export const PERSONAS: Record<string, Persona> = {
  '윤재호': {
    name: '윤재호',
    beat: '투자심리 · 초보투자',
    bio: '10년 넘게 시장의 환호와 공포를 지켜본 투자 칼럼니스트. 차트보다 사람의 마음이 수익률을 가른다고 믿는다. 흔들리는 초보 투자자 곁에서 "팔지 않고 버티는 법"을 쓴다.',
    initial: '윤',
  },
  '문지선': {
    name: '문지선',
    beat: '생활경제 · 소비습관',
    bio: '돈이 새는 자리를 집요하게 들여다보는 생활경제 칼럼니스트. 거창한 재테크보다 매일의 소비 습관이 통장을 바꾼다고 말한다. 숫자 뒤에 숨은 마음의 구멍을 짚는 글을 쓴다.',
    initial: '문',
  },
  '강현우': {
    name: '강현우',
    beat: '자산설계 · 저축',
    bio: '사회초년생의 첫 통장부터 노후 설계까지, 돈의 순서를 짚는 자산설계 칼럼니스트. 화려한 수익보다 무너지지 않는 토대를 먼저 만들라고 조언한다.',
    initial: '강',
  },
  '이도경': {
    name: '이도경',
    beat: 'AI · 생산성',
    bio: '새 기술을 가장 먼저 써 보고 가장 솔직하게 평가하는 AI·생산성 칼럼니스트. AI를 두려움도 맹신도 아닌 "도구"로 다루는 법을 전한다.',
    initial: '이',
  },
  '박서영': {
    name: '박서영',
    beat: '부업 · N잡',
    bio: '퇴근 후의 시간을 수입으로 바꾸는 길을 직접 부딪쳐 본 부업 칼럼니스트. 한탕이 아니라 오래가는 두 번째 수입을 설계하는 법을 쓴다.',
    initial: '박',
  },
  '한승우': {
    name: '한승우',
    beat: '거시 · 시장',
    bio: '금리와 환율, 시장의 큰 흐름을 쉬운 말로 풀어내는 시장 칼럼니스트. 뉴스 너머의 맥락을 읽어, 개인 투자자가 무엇을 해야 하는지로 번역한다.',
    initial: '한',
  },
};

// 실제 운영자(실명) — 정보성(가이드) 글의 책임 저자. 사람(Person) E-E-A-T 신호.
// ⚠️ 허위 경력 금지: 사실(운영자/편집장)만. 링크드인 등이 생기면 sameAs 에 추가.
export const REAL_AUTHOR = {
  id: 'eom-heesong',
  name: '엄희송',
  role: '편집장 · 운영자',
  bio: 'Crama를 운영하며 돈·재테크와 AI 트렌드를 직접 리서치·정리하고 사실관계를 검수합니다. 어려운 정보를 쉬운 말로 옮겨, 흐름을 먼저 읽는 사람을 만드는 것이 목표입니다.',
  sameAs: ['https://www.linkedin.com/in/billy-hee-song-eum-a66776254/'] as string[], // 실재 인물 검증(E-E-A-T) — 링크드인 공개 프로필
};

// 카테고리별 기본 칼럼니스트 — 칼럼인데 작성자가 지정되지 않았거나
// 알 수 없는 이름일 때 이 페르소나로 안전하게 대체한다(빈틈 방지).
export const CATEGORY_DEFAULT_PERSONA: Record<CategorySlug, string> = {
  money: '윤재호',
  ai: '이도경',
  income: '박서영',
};

export function getPersona(name?: string): Persona | undefined {
  return name ? PERSONAS[name] : undefined;
}

// 글의 실제 표시 작성자 이름을 결정한다.
// - 정보성(가이드): 지정된 author(보통 'Crama 편집부')를 그대로 사용
// - 칼럼: 지정된 author가 등록된 페르소나면 그대로, 아니면 카테고리 기본 칼럼니스트로 대체
//   → 새 분야 글에서 배정을 깜빡해도 항상 일관된 칼럼니스트 바이라인이 보장된다.
export function resolveAuthorName(
  author: string | undefined,
  category: CategorySlug,
  isColumn: boolean,
): string {
  // 정보성(가이드): 실명 책임 저자(엄희송)로 통일 — '편집부'/미지정도 실명 저자로 승격
  if (!isColumn) {
    if (!author || author === 'Crama 편집부' || author === REAL_AUTHOR.name) return REAL_AUTHOR.name;
    return author;
  }
  if (author && PERSONAS[author]) return author;
  // 실명 책임 저자(엄희송)는 칼럼에도 허용 — 실존 인물이라 Person으로 렌더(가짜 페르소나 위장 아님)
  if (author === REAL_AUTHOR.name) return REAL_AUTHOR.name;
  return CATEGORY_DEFAULT_PERSONA[category];
}

// 표시용 바이라인 — 칼럼니스트 페르소나는 'Crama 편집부 · 이름'으로,
// 책임 주체(편집부)를 앞세워 신뢰(E-E-A-T)를 브랜드에 귀속시킨다.
// 정보성 글(편집부 등)은 이름을 그대로 반환.
export function bylineLabel(name?: string): string {
  const p = getPersona(name);
  return p ? `Crama 편집부 · ${p.name}` : (name ?? '');
}
