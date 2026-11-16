// 오른쪽 '이어서 볼 콘텐츠' 영역(SideRail)과 홈 사이드바가 함께 쓰는 목록.
import { MENU } from './menu';

// 실제 조회가 많은 순서(GA 최근 4주 기준으로 정리) — 조회수 자동 집계를 붙이기 전까지 수동 관리
export const POPULAR = [
  { name: '건강검진 대상 조회', href: '/health-check/' },
  { name: '연봉 실수령액', href: '/salary/' },
  { name: '복지 서비스 찾기', href: '/welfare/' },
  { name: '내 혜택 찾기', href: '/benefits/' },
  { name: '시급 → 월급 환산', href: '/wage/' },
  { name: '퇴직금 계산', href: '/severance/' },
  { name: '예·적금 금리 비교', href: '/rates/' },
  { name: '실업급여 계산', href: '/unemployment/' },
  { name: '세금 캘린더', href: '/tax/' },
  { name: '전역일 계산기', href: '/discharge/' },
];

// 심심풀이 — 그림이 있는 게임·운세·테스트·뽑기
export const FUN = [
  { name: '오늘의 운세', href: '/fortune/', img: 'c-fortune' },
  { name: '타로 보기', href: '/tarot/', img: 'c-tarot' },
  { name: '이름 궁합', href: '/name-match/', img: 'c-name-match' },
  { name: '띠궁합', href: '/zodiac-match/', img: 'c-zodiac-match' },
  { name: '사다리 타기', href: '/pick/ladder/', img: 'c-ladder' },
  { name: '돌림판 돌리기', href: '/pick/wheel/', img: 'c-wheel' },
  { name: '오목', href: '/games/omok/', img: 'c-omok' },
  { name: '카드 짝 맞추기', href: '/games/memory/', img: 'c-memory' },
  { name: '오늘의 스도쿠', href: '/games/sudoku/', img: 'c-sudoku' },
  { name: '지뢰 찾기', href: '/games/mines/', img: 'c-minesweeper' },
  { name: '벽돌깨기', href: '/games/bricks/', img: 'c-breakout' },
  { name: '상식 퀴즈', href: '/games/quiz/', img: 'c-quiz' },
  { name: '로또 번호 생성기', href: '/lotto/', img: 'c-lotto' },
  { name: '점심 메뉴 추천', href: '/lunch/', img: 'c-lunch' },
  { name: '머니 캐릭터 테스트', href: '/quiz/money-character/', img: 'c-quiz-money' },
];

// 새로 나왔어요 — 새 페이지를 만들면 맨 위에 추가(위에서 6개만 노출)
export const NEW_ITEMS = [
  { name: '쿠팡 기획전 모음', href: '/deals/', desc: '지금 진행 중인 할인·특가' },
  { name: '공휴일·황금연휴', href: '/holidays/', desc: '올해·내년 쉬는 날과 연휴' },
  { name: '영업일 계산기', href: '/business-days/', desc: '주말·공휴일 뺀 날짜 계산' },
  { name: '사다리 타기', href: '/pick/ladder/', desc: '점심 내기·벌칙 정하기' },
  { name: '음력·양력 변환', href: '/lunar/', desc: '음력 생일을 양력으로' },
  { name: '오목', href: '/games/omok/', desc: '컴퓨터와 한 판' },
  { name: '연도별 최저임금', href: '/minimum-wage/', desc: '2027년 시급까지 한 표로' },
  { name: '더치페이 계산기', href: '/calc/dutch-pay/', desc: '1인당 얼마씩 깔끔하게' },
  { name: '반응속도 테스트', href: '/games/reaction/', desc: '내 반응 속도는 몇 ms' },
  { name: '돌림판 돌리기', href: '/pick/wheel/', desc: '항목을 적고 돌리면 끝' },
  { name: '카드 할부 계산기', href: '/calc/card-installment/', desc: '할부 수수료와 월 납입액' },
];

// 이 영역을 붙이는 주소(조회·계산기·게임·운세·테스트). 홈, 글, 회원 화면, 목록이 넓은 복지·청년 화면은 제외.
export const RAIL_RE = /^\/(hub|born|age|dday|lunar|holidays|business-days|fortune|tarot|name-match|zodiac-match|lotto|lunch|games|pick|calc|convert|health|health-check|salary|wage|severance|insurance|freelance-tax|realty-fee|minimum-wage|unemployment|interest|tools|car-tax|gift-tax|inheritance-tax|property-tax|discharge|median-income|quiz|tax|rate-calendar)(\/|$)/;

const clean = (h: string) => h.split('#')[0];
/** 지금 주소가 속한 분야와, 그 분야의 다른 페이지들 */
export function related(pathname: string, max = 7) {
  let best: { g: (typeof MENU)[number]['groups'][number]; len: number } | null = null;
  for (const t of MENU) for (const g of t.groups) for (const it of g.items) {
    if (!it.href) continue;
    const h = clean(it.href);
    if (h !== '/' && pathname.startsWith(h) && (!best || h.length > best.len)) best = { g, len: h.length };
  }
  if (!best) return null;
  const seen = new Set<string>();
  const items = best.g.items.filter((it) => it.href && !pathname.startsWith(clean(it.href)) && !seen.has(clean(it.href)) && seen.add(clean(it.href)));
  // 주소마다 다른 항목이 보이도록 시작 위치를 돌린다(빌드 결과는 항상 같음)
  const start = items.length ? [...pathname].reduce((n, c) => n + c.charCodeAt(0), 0) % items.length : 0;
  return { group: best.g, items: [...items.slice(start), ...items.slice(0, start)].slice(0, max) };
}
export const rotate = <T,>(arr: T[], pathname: string, n: number) => {
  const start = [...pathname].reduce((s, c) => s + c.charCodeAt(0), 0) % arr.length;
  return [...arr.slice(start), ...arr.slice(0, start)].filter((x: any) => !pathname.startsWith(x.href)).slice(0, n);
};
