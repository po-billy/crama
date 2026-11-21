// 복권 당첨금 세금 — 소득세법: 200만원 이하 비과세, 초과분은 3억원까지 22%(소득세 20%+지방소득세 2%), 3억원 초과분 33%(30%+3%).
// 과세 대상은 당첨금에서 복권 구입비(1장 1,000원)를 뺀 금액.
export const TICKET = 1_000;
export function lottoTax(prize: number) {
  if (prize <= 2_000_000) return { tax: 0, net: prize, low: 0, high: 0 };
  const t = prize - TICKET;
  const low = Math.min(t, 300_000_000) * 0.22;
  const high = Math.max(0, t - 300_000_000) * 0.33;
  const tax = Math.floor((low + high) / 10) * 10;
  return { tax, net: prize - tax, low, high };
}
// 수치 페이지(원): 2등·3등 수준 + 1등 5억~50억
export const LOTTO_AMOUNTS = [1_500_000, 5_000_000, 50_000_000, 100_000_000, 300_000_000, 500_000_000, 1_000_000_000, 1_500_000_000, 2_000_000_000, 2_500_000_000, 3_000_000_000, 4_000_000_000, 5_000_000_000];
export function wonLabel(w: number) {
  const eok = Math.floor(w / 100_000_000), man = Math.round((w % 100_000_000) / 10_000);
  return `${eok ? eok + '억' : ''}${eok && man ? ' ' : ''}${man ? man.toLocaleString('ko-KR') + '만' : ''}원`;
}
export const slugOf = (w: number) => String(Math.round(w / 10_000)); // 만원 단위
