// 오른쪽 '이어서 볼 콘텐츠' 영역(SideRail)과 홈 사이드바가 함께 쓰는 목록.
import { MENU } from './menu';

// 실제 조회가 많은 순서(GA 최근 4주 기준으로 정리) — 조회수 자동 집계를 붙이기 전까지 수동 관리
export const POPULAR = [
  { name: '건강검진 대상 조회', href: '/health-check/' },
  { name: '연봉 실수령액', href: '/salary/' },
  { name: '연말정산 계산기', href: '/year-end-tax/' },
  { name: '복지 서비스 찾기', href: '/welfare/' },
  { name: '내 혜택 찾기', href: '/benefits/' },
  { name: '시급 → 월급 환산', href: '/wage/' },
  { name: '퇴직금 계산', href: '/severance/' },
  { name: '예·적금 금리 비교', href: '/rates/' },
  { name: '실업급여 계산', href: '/unemployment/' },
  { name: '세금 캘린더', href: '/tax/' },
  { name: '전역일 계산기', href: '/discharge/' },
];

// 홈 오른쪽 '많이 찾는 운세·테스트' — 아직 조회수 집계가 없어 수동으로 정한 순서
export const POPULAR_FUN = [
  { name: '오늘의 운세', href: '/fortune/' },
  { name: '타로 보기', href: '/tarot/' },
  { name: '이름 궁합', href: '/name-match/' },
  { name: '띠궁합', href: '/zodiac-match/' },
  { name: '로또 번호 생성기', href: '/lotto/' },
  { name: '머니 캐릭터 테스트', href: '/quiz/money-character/' },
];
// 홈 오른쪽 '지금 핫한 게임' — 수동으로 정한 순서
export const HOT_GAMES = [
  { name: '사다리 타기', href: '/pick/ladder/', img: 'c-ladder', desc: '점심 내기·벌칙 정하기' },
  { name: '오목', href: '/games/omok/', img: 'c-omok', desc: '컴퓨터와 한 판' },
  { name: '오늘의 스도쿠', href: '/games/sudoku/', img: 'c-sudoku', desc: '매일 바뀌는 퍼즐' },
  { name: '카드 짝 맞추기', href: '/games/memory/', img: 'c-memory', desc: '같은 그림 찾기' },
  { name: '돌림판 돌리기', href: '/pick/wheel/', img: 'c-wheel', desc: '항목 적고 돌리면 끝' },
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
  { name: '숨은 돈 찾기', href: '/hidden-money/', desc: '휴면예금·보험금·환급금 체크리스트' },
  { name: '경조사비 계산기', href: '/gift-money/', desc: '축의금·조의금, 관계별 얼마' },
  { name: '실수령으로 연봉 찾기', href: '/salary/net/', desc: '월 300만원 받으려면 연봉 얼마' },
  { name: '2026 소비 영수증', href: '/year-receipt/', desc: '1년 지출을 영수증으로 뽑기' },
  { name: '건강검진 결과 해석', href: '/health-check/result/', desc: '결과지 수치, 정상인지 한 번에' },
  { name: '채팅 참여 추첨', href: '/live/raffle/', desc: '!참여 친 시청자만 골라 추첨' },
  { name: '방송 타이머·목표 게이지', href: '/live/', desc: 'OBS에 넣는 무료 방송 도구' },
  { name: '구슬 레이스 추첨', href: '/party/marble/', desc: '방송·회식용, 300개까지 실시간 순위' },
  { name: '이름 레이스 추첨', href: '/party/race/', desc: '경마 추첨, 역전과 사진 판정' },
  { name: '밥값 몰아주기', href: '/party/pay/', desc: '점심값 몰빵·랜덤 금액' },
  { name: '폭탄 돌리기', href: '/party/bomb/', desc: '회식·방송 벌칙 폭탄' },
  { name: '출산예정일 계산기', href: '/mom/', desc: '오늘 임신 몇 주 며칠, 내 일정표' },
  { name: '아기 100일 계산기', href: '/mom/baby/', desc: '50일·100일·돌, 예방접종 날짜' },
  { name: '예비군 연차 계산기', href: '/reserve/', desc: '올해 몇 년차, 받는 훈련' },
  { name: '나이별 건강검진 항목', href: '/health-check/age/', desc: '42세·50세, 내 나이에 받는 검사' },
  { name: '연말정산 계산기', href: '/year-end-tax/', desc: '환급받을까 더 낼까, 2026년 귀속' },
  { name: '삼재 조회', href: '/samjae/', desc: '올해 삼재띠와 내 삼재 연도' },
  { name: '입학·졸업 연도', href: '/school/', desc: '올해 학년, 학번, 수능 연도' },
  { name: '국민연금 수령 나이', href: '/pension-age/', desc: '출생연도별 받기 시작하는 나이' },
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
export const RAIL_RE = /^\/(party|live|year-receipt|gift-money|hidden-money|annual-leave|hub|born|samjae|school|pension-age|age|dday|lunar|holidays|business-days|fortune|tarot|name-match|zodiac-match|lotto|lunch|games|pick|calc|convert|health|health-check|salary|year-end-tax|wage|severance|insurance|freelance-tax|realty-fee|minimum-wage|unemployment|interest|tools|car-tax|gift-tax|inheritance-tax|property-tax|discharge|reserve|mom|median-income|quiz|tax|rate-calendar)(\/|$)/;

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
