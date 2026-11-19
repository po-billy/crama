// 예비군 연차·훈련 계산 공용 — /reserve/ 계산기, /reserve/[n]/ 연차별, /reserve/from/[year]/ 전역연도별 페이지가 쓴다.
// 기준: 국방부 2026년도 예비군 훈련 발표(2026-02-27, 3월 3일 시작, 전국 143개 훈련장).
// 해마다 훈련 시간·훈련비가 바뀌므로 매년 2월 국방부 발표를 보고 TRAININGS와 RESERVE_YEAR를 고칠 것.

export const RESERVE_YEAR = 2026;
export const MAX_GRADE = 8;
export const FROM_YEARS = (() => { const o: number[] = []; for (let y = RESERVE_YEAR; y >= RESERVE_YEAR - 9; y--) o.push(y); return o; })();

/** 전역한 다음 해 1월 1일부터 1년차. 전역한 해는 0년차(훈련 소집 없음), 8년차가 끝나면 예비군 만료. */
export const gradeOf = (dischargeYear: number, year = RESERVE_YEAR) => year - dischargeYear;
export const dischargeYearOf = (grade: number, year = RESERVE_YEAR) => year - grade;

export type Training = { name: string; who: string; time: string; place: string; pay?: string };

export const TRAININGS: Record<'mob' | 'local' | 'none', Training[]> = {
  mob: [
    { name: '동원훈련Ⅰ형 (옛 동원훈련)', who: '동원 지정자', time: '2박 3일 입영', place: '소집부대·동원훈련장', pay: '9만 5천 원' },
    { name: '동원훈련Ⅱ형 (옛 동미참)', who: '동원 미지정자', time: '4일 출퇴근', place: '지역예비군훈련장', pay: '5만 원' },
  ],
  local: [
    { name: '기본훈련', who: '지역예비군', time: '1일 8시간', place: '지역예비군훈련장', pay: '1만 원(2026년 신설)' },
    { name: '작계훈련', who: '지역예비군', time: '전·후반기 나눠 총 12시간', place: '거주지 작전지역' },
  ],
  none: [
    { name: '정기 훈련 소집 없음', who: '7~8년차', time: '-', place: '비상소집 점검 대상' },
  ],
};

export function stageOf(grade: number): { key: 'pre' | 'mob' | 'local' | 'none' | 'done'; label: string; summary: string } {
  if (grade <= 0) return { key: 'pre', label: '전역한 해', summary: '전역한 해에는 예비군 훈련 소집이 없어요. 다음 해 1월 1일부터 1년차예요.' };
  if (grade <= 4) return { key: 'mob', label: `${grade}년차 · 동원 대상`, summary: '동원 지정자는 2박 3일 입영(동원훈련Ⅰ형), 미지정자는 4일 출퇴근(동원훈련Ⅱ형)을 받아요.' };
  if (grade <= 6) return { key: 'local', label: `${grade}년차 · 지역예비군`, summary: '하루 8시간 기본훈련과 거주지 작계훈련(총 12시간)을 받아요.' };
  if (grade <= MAX_GRADE) return { key: 'none', label: `${grade}년차 · 소집 없음`, summary: '정기 훈련 소집은 없고 비상소집 점검 대상이에요. 8년차가 끝나면 예비군이 끝나요.' };
  return { key: 'done', label: '예비군 만료', summary: '8년차가 끝나 예비군 의무가 끝났어요. 만 40세가 되는 해까지는 민방위 대상이에요.' };
}

export const trainingsOf = (grade: number): Training[] => {
  const k = stageOf(grade).key;
  return k === 'mob' || k === 'local' || k === 'none' ? TRAININGS[k] : [];
};

export const RESERVE_FAQ = [
  { q: '예비군 연차는 어떻게 세나요?', a: '전역한 해는 0년차로 훈련이 없고, 다음 해 1월 1일부터 1년차가 됩니다. 전역 날짜가 1월이든 12월이든 같은 해에 전역했다면 연차는 같아요.' },
  { q: '동원 지정자인지 어떻게 아나요?', a: '동원 지정 여부는 병무청이 정해 통지서로 알려 줍니다. 예비군 홈페이지(yebigun1.mil.kr)나 병무청 누리집에서 본인 훈련 일정과 함께 확인할 수 있어요.' },
  { q: '훈련 일정은 언제 나오나요?', a: `${RESERVE_YEAR}년 훈련은 3월 3일부터 시작했어요. 개인별 소집 날짜는 소집통지서로 알려 주며, 예비군 홈페이지에서 일정 확인과 연기 신청을 할 수 있어요.` },
];
