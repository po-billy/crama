// 출생연도로 정해지는 생애 일정 계산 — 삼재, 학교 입학·졸업, 국민연금 조기·연기 수령.
// 화면: /samjae/[year]/ · /school/[year]/ · /pension-age/[year]/ (+ /born/[year]/ 에서 연결)
import { THIS_YEAR, pensionAge } from './people';

const zIdx = (y: number) => (((y - 4) % 12) + 12) % 12;

/* ---------- 삼재 ----------
   띠 네 묶음마다 삼재가 드는 해(지지)가 정해져 있다.
   원숭이·쥐·용띠 → 호랑이·토끼·용 해 / 돼지·토끼·양띠 → 뱀·말·양 해
   호랑이·말·개띠 → 원숭이·닭·개 해 / 뱀·닭·소띠 → 돼지·쥐·소 해 */
export const SAMJAE_NAMES = ['들삼재', '눌삼재', '날삼재'];
export const SAMJAE_DESC = ['삼재가 들어오는 첫해', '삼재가 머무는 둘째 해', '삼재가 나가는 마지막 해'];
const samjaeStart = (birth: number) => { const r = zIdx(birth) % 4; return r === 0 ? 2 : r === 3 ? 5 : r === 2 ? 8 : 11; };
/** 그 해가 삼재의 몇 번째 해인지(0 들·1 눌·2 날), 삼재가 아니면 -1 */
export const samjaePhase = (birth: number, y: number) => { const d = (((zIdx(y) - samjaeStart(birth)) % 12) + 12) % 12; return d < 3 ? d : -1; };
/** 태어난 뒤 맞는 삼재 3년 묶음 목록(들삼재가 시작되는 해 기준) */
export function samjaeBlocks(birth: number, until = birth + 96) {
  const out: number[] = [];
  for (let y = birth; y <= until; y++) if (samjaePhase(birth, y) === 0 && y >= birth) out.push(y);
  return out;
}
/** 같은 시기에 삼재를 맞는 세 띠의 번호(0 쥐 … 11 돼지) */
export const samjaeGroup = (birth: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((i) => i % 4 === zIdx(birth) % 4);
/** 그 해에 삼재인 띠 번호 */
export const samjaeZodiacsOf = (y: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((i) => samjaePhase(2020 + i, y) >= 0);

/* ---------- 학교 ---------- (1월 1일~12월 31일 출생이 같은 학년, 3월 입학 기준) */
export const SCHOOL_FROM = 1980, SCHOOL_TO = THIS_YEAR;
export const schoolYears = () => { const o: number[] = []; for (let y = SCHOOL_TO; y >= SCHOOL_FROM; y--) o.push(y); return o; };
export const schoolPlan = (birth: number) => [
  { name: '초등학교', in: birth + 7, out: birth + 13, years: 6 },
  { name: '중학교', in: birth + 13, out: birth + 16, years: 3 },
  { name: '고등학교', in: birth + 16, out: birth + 19, years: 3 },
  { name: '대학교(4년제)', in: birth + 19, out: birth + 23, years: 4 },
];
/** 올해 학년(3월 기준). 미취학·졸업 뒤도 문장으로 */
export function gradeNow(birth: number, y = THIS_YEAR) {
  const k = y - birth;
  if (k < 7) return k === 6 ? '미취학 (내년 초등학교 입학)' : `미취학 (${birth + 7}년 초등학교 입학)`;
  if (k <= 12) return `초등학교 ${k - 6}학년`;
  if (k <= 15) return `중학교 ${k - 12}학년`;
  if (k <= 18) return `고등학교 ${k - 15}학년`;
  if (k <= 22) return `대학교 ${k - 18}학년 나이`;
  return '학교를 마친 나이';
}
/** 2002년생부터 1월 1일~12월 31일 출생이 한 학년(그 전에는 1·2월생이 한 해 일찍 입학하는 경우가 많았다) */
export const hasEarlyEntry = (birth: number) => birth <= 2001;

/* ---------- 국민연금 ---------- */
export const PENSION_BANDS = [
  { label: '1952년생 이전', age: 60 }, { label: '1953~1956년생', age: 61 }, { label: '1957~1960년생', age: 62 },
  { label: '1961~1964년생', age: 63 }, { label: '1965~1968년생', age: 64 }, { label: '1969년생 이후', age: 65 },
];
/** 받는 시기를 앞당기거나 늦출 때의 지급률(%) — 조기 1년당 6% 감액(최대 5년), 연기 1년당 7.2% 증액(최대 5년) */
export function pensionOptions(birth: number) {
  const a = pensionAge(birth);
  const rows: { age: number; year: number; rate: number; kind: string }[] = [];
  for (let k = -5; k <= 5; k++) rows.push({ age: a + k, year: birth + a + k, rate: Math.round((k < 0 ? 100 + k * 6 : 100 + k * 7.2) * 10) / 10, kind: k < 0 ? '조기 수령' : k === 0 ? '정상 수령' : '연기 수령' });
  return rows;
}
