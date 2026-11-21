// 손없는 날 — 민속에서 음력 날짜 끝자리가 9·0인 날(9·10·19·20·29·30일)을 '손(귀신)이 없는 날'이라 하여 이사·개업 날로 고른다.
// 음력은 Node·브라우저의 Intl 단기력(ko-KR-u-ca-dangi)으로 빌드할 때 계산한다. 공휴일은 lib/holidays.
import { holidaysOf } from './holidays';

const fmt = new Intl.DateTimeFormat('ko-KR-u-ca-dangi', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric' });
export const DOW = ['일', '월', '화', '수', '목', '금', '토'];
export const SONLESS_DAYS = [9, 10, 19, 20, 29, 30];

export type Day = { date: string; d: number; dow: number; lm: string; ld: number; sonless: boolean; holiday?: string };

export function monthDays(y: number, m: number): Day[] {
  const hol = new Map(holidaysOf(y).map((h) => [h.date, h.name]));
  const out: Day[] = [];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    const t = new Date(Date.UTC(y, m - 1, d, 3)); // 정오(KST) 무렵
    const parts = fmt.formatToParts(t);
    const lm = parts.find((p) => p.type === 'month')?.value || '';
    const ld = Number(parts.find((p) => p.type === 'day')?.value || 0);
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    out.push({ date, d, dow: t.getUTCDay(), lm, ld, sonless: SONLESS_DAYS.includes(ld), holiday: hol.get(date) });
  }
  return out;
}

/** 페이지 만들 달: 2026년 1월 ~ 2027년 12월 */
export const MONTHS: { y: number; m: number; key: string }[] = [];
for (const y of [2026, 2027]) for (let m = 1; m <= 12; m++) MONTHS.push({ y, m, key: `${y}-${String(m).padStart(2, '0')}` });

export const isOff = (x: Day) => x.dow === 0 || x.dow === 6 || !!x.holiday;
