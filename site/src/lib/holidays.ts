// 공휴일 공용 계산 — 데이터 원본: src/data/holidays.json (automation/sync-holidays.mjs 가 한국천문연구원 특일정보에서 생성)
import data from '../data/holidays.json';

export type Holiday = { date: string; name: string };
export const HOLIDAYS = (data as any).years as Record<string, Holiday[]>;
export const HOLIDAYS_UPDATED = (data as any).generatedAt as string;
export const HOLIDAY_YEARS = Object.keys(HOLIDAYS).map(Number).sort((a, b) => a - b);
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];

const DAY = 86400000;
export const toT = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
export const toS = (t: number) => new Date(t).toISOString().slice(0, 10);
export const dow = (s: string) => new Date(toT(s)).getUTCDay();
export const md = (s: string) => `${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일`;

/** 그 해의 공휴일(같은 날 이름이 둘이면 합침) */
export function holidaysOf(year: number): Holiday[] {
  const map = new Map<string, string>();
  for (const h of HOLIDAYS[String(year)] || []) map.set(h.date, map.has(h.date) ? map.get(h.date) + '·' + h.name : h.name);
  return [...map].map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date));
}

/** 주말·공휴일이 3일 이상 이어지는 연휴(공휴일이 하나 이상 낀 것만) */
export function longWeekends(year: number) {
  const hol = new Map(holidaysOf(year).map((h) => [h.date, h.name]));
  const off = (t: number) => { const s = toS(t), d = new Date(t).getUTCDay(); return d === 0 || d === 6 || hol.has(s); };
  const out: { from: string; to: string; days: number; names: string[] }[] = [];
  const end = Date.UTC(year, 11, 31);
  let t = Date.UTC(year, 0, 1);
  // 1월 1일이 전년도 주말에서 이어지는 경우를 위해 앞으로 조금 당겨 시작
  while (off(t - DAY) && t > Date.UTC(year, 0, 1) - 3 * DAY) t -= DAY;
  while (t <= end) {
    if (!off(t)) { t += DAY; continue; }
    let e = t; const names: string[] = [];
    while (off(e)) { const n = hol.get(toS(e)); if (n && !names.includes(n.replace(/^대체공휴일\((.+)\)$/, '$1'))) names.push(n.replace(/^대체공휴일\((.+)\)$/, '$1')); e += DAY; }
    const days = (e - t) / DAY;
    if (days >= 3 && names.length) out.push({ from: toS(t), to: toS(e - DAY), days, names });
    t = e;
  }
  return out;
}

/** 연차 하루로 이어 붙일 수 있는 징검다리 — 앞뒤가 모두 쉬는 날인 평일 */
export function bridges(year: number) {
  const hol = new Map(holidaysOf(year).map((h) => [h.date, h.name]));
  const off = (t: number) => { const d = new Date(t).getUTCDay(); return d === 0 || d === 6 || hol.has(toS(t)); };
  const out: { leave: string; from: string; to: string; days: number; names: string[] }[] = [];
  for (let t = Date.UTC(year, 0, 1); t <= Date.UTC(year, 11, 31); t += DAY) {
    if (off(t) || !off(t - DAY) || !off(t + DAY)) continue;
    let a = t - DAY, b = t + DAY; while (off(a - DAY)) a -= DAY; while (off(b + DAY)) b += DAY;
    const names: string[] = [];
    for (let k = a; k <= b; k += DAY) { const n = hol.get(toS(k)); if (n) { const base = n.replace(/^대체공휴일\((.+)\)$/, '$1'); if (!names.includes(base)) names.push(base); } }
    if (names.length) out.push({ leave: toS(t), from: toS(a), to: toS(b), days: (b - a) / DAY + 1, names });
  }
  return out;
}
