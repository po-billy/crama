// 연차유급휴가 계산 — 근로기준법 제60조(입사일 기준).
// · 1년 미만(또는 1년간 출근율 80% 미만): 1개월 개근마다 1일, 최대 11일
// · 1년간 80% 이상 출근: 15일
// · 3년 이상: 최초 1년을 넘는 근속 2년마다 1일 가산, 최대 25일
// 상시 5명 미만 사업장, 주 15시간 미만 초단시간 근로자는 연차 규정이 적용되지 않는다.

/** 근속 n년을 채웠을 때 새로 생기는 연차(일) */
export function leaveForYears(n: number): number {
  if (n < 1) return 0;
  return Math.min(25, 15 + Math.floor((n - 1) / 2));
}

const DAY = 86400000;
const ymd = (d: Date) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
const addMonths = (d: Date, m: number) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const addYears = (d: Date, y: number) => { const x = new Date(d); x.setFullYear(x.getFullYear() + y); return x; };

export type LeaveEvent = { date: string; days: number; label: string };

/** 입사일부터 기준일까지 생긴 연차와 앞으로 생길 연차 */
export function leaveTimeline(join: Date, until: Date, futureYears = 5) {
  const past: LeaveEvent[] = [], next: LeaveEvent[] = [];
  // 1년 미만: 매월 개근 시 1일(입사 후 1·2·…·11개월 되는 날)
  for (let m = 1; m <= 11; m++) {
    const d = addMonths(join, m);
    const ev = { date: ymd(d), days: 1, label: `입사 ${m}개월 개근` };
    (d <= until ? past : next).push(ev);
  }
  for (let y = 1; y <= 40; y++) {
    const d = addYears(join, y);
    const ev = { date: ymd(d), days: leaveForYears(y), label: `근속 ${y}년` };
    if (d <= until) past.push(ev); else { if (next.filter((e) => e.label.startsWith('근속')).length < futureYears) next.push(ev); }
  }
  const years = Math.floor((until.getTime() - join.getTime()) / (365.2425 * DAY));
  const months = Math.floor((until.getTime() - join.getTime()) / (30.436875 * DAY));
  // 지금 쓸 수 있는 해의 연차(가장 최근에 생긴 근속 연차, 1년 미만이면 월차 누계)
  const current = years >= 1 ? leaveForYears(years) : Math.min(11, past.length);
  return { past, next, years, months, current, total: past.reduce((s, e) => s + e.days, 0) };
}

/** 연차수당: 미사용 일수 × 1일 통상임금(통상 시급 × 8시간) */
export function leavePay(days: number, hourly: number, hoursPerDay = 8) { return Math.round(days * hourly * hoursPerDay); }

export const LEAVE_YEARS = Array.from({ length: 25 }, (_, i) => i + 1);
