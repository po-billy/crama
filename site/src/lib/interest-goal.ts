// 이자 역산 — 세후 월 이자 목표(만원)에 필요한 예치금(원). 1년 만기 단리, 이자소득세 15.4%.
export const GOALS = [10, 20, 30, 50, 70, 100, 150, 200, 300, 500];
export const TAX = 0.154;
export const needFor = (man: number, rate: number) => (man * 10_000 * 12) / ((rate / 100) * (1 - TAX));
export const grossYearly = (man: number) => (man * 10_000 * 12) / (1 - TAX);
export function eok(won: number): string {
  const m = Math.round(won / 10_000);
  if (m < 10000) return `${m.toLocaleString('ko-KR')}만원`;
  const e = Math.floor(m / 10000), r = m % 10000;
  return `${e}억${r ? ' ' + r.toLocaleString('ko-KR') + '만' : ''}원`;
}
export function bestDeposit(rates: any): { rate: number; bank: string } | null {
  let best: { rate: number; bank: string } | null = null;
  for (const p of rates.deposits || []) for (const o of p.options || [])
    if (o.trm === 12 && o.rate2 != null && (!best || o.rate2 > best.rate)) best = { rate: o.rate2, bank: p.bank };
  return best;
}
