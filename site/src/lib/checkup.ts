// 국가건강검진 계산 공용 — 연도 페이지(/health-check/[year]/), 나이별 페이지(/health-check/age/[age]/), 목록이 함께 쓴다.
// 기준: 국민건강보험공단 2026년 일반건강검진·국가암검진 안내. 해마다 조정되므로 1월에 공단 안내를 다시 확인할 것
// (2025년 C형간염, 2026년 폐기능 검사가 새로 들어왔다). 해가 바뀌면 CHECK_YEAR만 올리면 된다.

export const CHECK_YEAR = 2026;
export const NEXT_YEAR = CHECK_YEAR + 1;
export const YEAR_FROM = 1947;
export const YEAR_TO = 2007; // 2007년생은 2027년에 20세로 첫 검진
export const AGE_FROM = 20;
export const AGE_TO = 80;

/** 검진 나이 = 검진 연도 - 출생연도(생일과 무관) */
export const checkAge = (birthYear: number, checkYear = CHECK_YEAR) => checkYear - birthYear;

/** 2년 주기 검진 대상 연도인지(지역가입자·피부양자·직장 사무직). 출생연도와 검진 연도의 짝·홀이 같으면 대상. */
export const isTargetYear = (birthYear: number, checkYear: number) => checkYear - birthYear >= 20 && (checkYear - birthYear) % 2 === 0;

/** 출생연도 기준 가장 가까운 대상 연도(올해 포함) */
export const nextTargetYear = (birthYear: number, from = CHECK_YEAR) => {
  for (let y = from; y < from + 30; y++) if (isTargetYear(birthYear, y)) return y;
  return from;
};

export const short = (y: number) => String(y).slice(2);
export const parity = (y: number) => (y % 2 === 0 ? '짝수' : '홀수');

export type Extra = { name: string; who: string; note: string };

/** 검진 나이에 따라 붙는 추가 검사 */
export function extrasFor(age: number): Extra[] {
  const out: Extra[] = [];
  const add = (name: string, who: string, note: string) => out.push({ name, who, note });
  const lipidM = age >= 24 && (age - 24) % 4 === 0;
  const lipidF = age >= 40 && age % 4 === 0;
  if (lipidM || lipidF) add('이상지질혈증(콜레스테롤)', lipidM && lipidF ? '남녀 모두' : lipidM ? '남성' : '여성', '남성 24세·여성 40세부터 4년마다');
  if (age === 40) add('B형간염', '남녀 모두', '40세에 한 번(보균자·면역자 제외)');
  if (age === 56) add('C형간염', '남녀 모두', '56세에 한 번');
  if (age === 56 || age === 66) add('폐기능 검사', '남녀 모두', '56세·66세에 한 번씩');
  if ([54, 60, 66].includes(age)) add('골밀도 검사', '여성', '54세·60세·66세');
  if (age >= 66) add('인지기능장애 검사', '남녀 모두', '66세부터 2년마다');
  if (age >= 20 && age <= 34) add('정신건강검사(우울증·조기정신증)', '남녀 모두', '20~34세 2년마다');
  if ([40, 50, 60, 70].includes(age)) add('생활습관평가', '남녀 모두', '40·50·60·70세');
  if ([66, 70, 80].includes(age)) add('노인신체기능 검사', '남녀 모두', '66·70·80세');
  if (age === 40) add('치면세균막 검사(구강)', '남녀 모두', '40세');
  return out;
}

export type Cancer = { name: string; rule: string; how: string; sex: 'all' | 'f'; risk?: boolean };

/** 검진 나이에 받을 수 있는 국가 암검진 */
export function cancersFor(age: number): Cancer[] {
  const all: (Cancer & { ok: boolean })[] = [
    { name: '위암', ok: age >= 40, rule: '40세부터 2년마다', how: '위내시경(또는 위장조영검사)', sex: 'all' },
    { name: '대장암', ok: age >= 50, rule: '50세부터 매년', how: '분변잠혈검사 → 이상 시 대장내시경', sex: 'all' },
    { name: '유방암', ok: age >= 40, rule: '40세부터 2년마다', how: '유방촬영술', sex: 'f' },
    { name: '자궁경부암', ok: age >= 20, rule: '20세부터 2년마다', how: '자궁경부세포검사', sex: 'f' },
    { name: '간암', ok: age >= 40, rule: '40세부터 6개월마다', how: '간 초음파 + 혈액검사', sex: 'all', risk: true },
    { name: '폐암', ok: age >= 54 && age <= 74, rule: '54~74세 2년마다', how: '저선량 흉부 CT', sex: 'all', risk: true },
  ];
  return all.filter((c) => c.ok).map(({ ok, ...c }) => c);
}

/** 검진 항목이 여러 개 새로 붙는 나이 */
export const isTransition = (age: number) => [20, 40, 50, 56, 66].includes(age);

/** 나이별 한 줄 요약(나이 페이지 제목·설명에 사용) */
export function ageHeadline(age: number) {
  if (age === 20) return '첫 국가건강검진, 자궁경부암 검진 시작';
  if (age === 40) return '위암·유방암 검진 시작, B형간염·생활습관 검사';
  if (age === 50) return '대장암 검진 시작, 생활습관평가';
  if (age === 54) return '폐암(고위험군)·여성 골밀도 검사 시작';
  if (age === 56) return 'C형간염·폐기능 검사';
  if (age === 66) return '인지기능·노인신체기능·폐기능 검사';
  const ex = extrasFor(age);
  return ex.length ? `${ex.map((e) => e.name.replace(/\(.*\)/, '')).join('·')} 추가` : '공통 항목 중심';
}

/** 공통 검사 */
export const BASIC_ITEMS = [
  { name: '진찰·상담', desc: '문진, 과거 병력과 생활 습관 확인' },
  { name: '신체 계측', desc: '키, 몸무게, 허리둘레, 체질량지수' },
  { name: '혈압·시력·청력', desc: '기본 측정' },
  { name: '흉부 방사선 촬영', desc: '폐와 심장 상태 확인' },
  { name: '혈액 검사', desc: '빈혈, 공복혈당, 간 기능, 신장 기능' },
  { name: '소변 검사', desc: '요단백' },
  { name: '구강 검진', desc: '치과에서 따로 받음' },
];
