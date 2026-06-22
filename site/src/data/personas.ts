// 칼럼니스트 페르소나 — 칼럼(format: 'column') 글의 바이라인.
// AuthorBox가 글의 author 이름으로 이 목록을 조회해 프로필을 렌더한다.
// 정보성(가이드) 글은 'Crama 편집부'를 그대로 사용한다.
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

export function getPersona(name?: string): Persona | undefined {
  return name ? PERSONAS[name] : undefined;
}
