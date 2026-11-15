/**
 * 연봉 실수령액 계산 — 2026년 요율 기준(국민연금 상·하한은 2026년 7월 고시분)(1인 가구·본인 공제만·비과세 없음).
 * 간이세액표가 아닌 종합 근사 계산이라 실제 원천징수와 ±수만 원 차이가 날 수 있다(페이지에 고지).
 *
 * 요율 출처:
 *  - 국민연금 4.75%(근로자, 2026년 보험료율 9.5%), 기준소득월액 상한 659만·하한 41만(2026.7~2027.6)
 *  - 건강보험 3.595%(근로자, 2026년 7.19%), 장기요양 = 건보료의 13.14%(소득 대비 0.9448%)
 *  - 고용보험 0.9%(근로자)
 *  - 소득세: 근로소득공제 → 인적·보험료 공제 → 기본세율(6~45%) → 근로소득세액공제, 지방소득세 10%
 */

export const NP_RATE = 0.0475;
export const NP_CAP_MONTH = 6_590_000; // 기준소득월액 상한
export const NP_FLOOR_MONTH = 410_000;
export const HI_RATE = 0.03595;
export const LTC_RATE = 0.1314; // 건보료 대비
export const EI_RATE = 0.009;

// 근로소득공제(연, 원)
function earnedIncomeDeduction(gross: number): number {
  let d: number;
  if (gross <= 5_000_000) d = gross * 0.7;
  else if (gross <= 15_000_000) d = 3_500_000 + (gross - 5_000_000) * 0.4;
  else if (gross <= 45_000_000) d = 7_500_000 + (gross - 15_000_000) * 0.15;
  else if (gross <= 100_000_000) d = 12_000_000 + (gross - 45_000_000) * 0.05;
  else d = 14_750_000 + (gross - 100_000_000) * 0.02;
  return Math.min(d, 20_000_000);
}

// 기본세율 누진(과세표준 → 산출세액, 연)
function basicTax(base: number): number {
  if (base <= 0) return 0;
  if (base <= 14_000_000) return base * 0.06;
  if (base <= 50_000_000) return 840_000 + (base - 14_000_000) * 0.15;
  if (base <= 88_000_000) return 6_240_000 + (base - 50_000_000) * 0.24;
  if (base <= 150_000_000) return 15_360_000 + (base - 88_000_000) * 0.35;
  if (base <= 300_000_000) return 37_060_000 + (base - 150_000_000) * 0.38;
  if (base <= 500_000_000) return 94_060_000 + (base - 300_000_000) * 0.4;
  if (base <= 1_000_000_000) return 174_060_000 + (base - 500_000_000) * 0.42;
  return 384_060_000 + (base - 1_000_000_000) * 0.45;
}

// 근로소득세액공제(연) — 산출세액·총급여 기반 한도
function earnedTaxCredit(calcTax: number, gross: number): number {
  let credit = calcTax <= 1_300_000 ? calcTax * 0.55 : 715_000 + (calcTax - 1_300_000) * 0.3;
  let cap: number;
  if (gross <= 33_000_000) cap = 740_000;
  else if (gross <= 70_000_000) cap = Math.max(660_000, 740_000 - (gross - 33_000_000) * 0.008);
  else if (gross <= 120_000_000) cap = Math.max(500_000, 660_000 - (gross - 70_000_000) * 0.5);
  else cap = Math.max(200_000, 500_000 - (gross - 120_000_000) * 0.5);
  return Math.min(credit, cap);
}

// 10원 미만 절사(부동소수점 오차로 27,000이 26,990이 되는 것을 막기 위해 아주 작은 값을 더한다)
const cut10 = (x: number) => Math.floor((x + 1e-6) / 10) * 10;

export interface SalaryBreakdown {
  annual: number;        // 연봉(원)
  monthlyGross: number;  // 월 급여(세전)
  np: number;            // 월 국민연금
  hi: number;            // 월 건강보험
  ltc: number;           // 월 장기요양
  ei: number;            // 월 고용보험
  incomeTax: number;     // 월 소득세
  localTax: number;      // 월 지방소득세
  totalDeduct: number;   // 월 공제 합계
  monthlyNet: number;    // 월 실수령액
  annualNet: number;     // 연 실수령액
  effectiveRate: number; // 실효 공제율(%)
}

export function computeSalary(annual: number): SalaryBreakdown {
  const monthlyGross = annual / 12;

  const npBase = Math.min(Math.max(monthlyGross, NP_FLOOR_MONTH), NP_CAP_MONTH);
  const np = cut10(npBase * NP_RATE);
  const hi = cut10(monthlyGross * HI_RATE);
  const ltc = cut10(hi * LTC_RATE);
  const ei = cut10(monthlyGross * EI_RATE);

  // 연간 소득세: 근로소득공제 → 인적(본인 150만)·보험료(연금+건보+장기요양+고용) 공제 → 세율 → 세액공제
  const eid = earnedIncomeDeduction(annual);
  const insuranceAnnual = (np + hi + ltc + ei) * 12;
  const taxBase = Math.max(0, annual - eid - 1_500_000 - insuranceAnnual);
  const calc = basicTax(taxBase);
  const credit = earnedTaxCredit(calc, annual);
  const annualIncomeTax = Math.max(0, calc - credit);
  const incomeTax = cut10(annualIncomeTax / 12);
  const localTax = cut10(incomeTax * 0.1);

  const totalDeduct = np + hi + ltc + ei + incomeTax + localTax;
  const monthlyNet = Math.round(monthlyGross - totalDeduct);
  return {
    annual,
    monthlyGross: Math.round(monthlyGross),
    np, hi, ltc, ei, incomeTax, localTax, totalDeduct,
    monthlyNet,
    annualNet: monthlyNet * 12,
    effectiveRate: Math.round((totalDeduct / monthlyGross) * 1000) / 10,
  };
}

// 페이지 생성 대상 연봉(만원): 2,000~10,000 100만 단위 + 10,500~20,000 500만 단위
export function salaryAmounts(): number[] {
  const list: number[] = [];
  for (let m = 2000; m <= 10000; m += 100) list.push(m);
  for (let m = 10500; m <= 20000; m += 500) list.push(m);
  return list;
}

export const RATE_BASIS = '2026년 4대보험 요율(국민연금 4.75%·건강보험 3.595%)·소득세법 기준';
export const fmt = (n: number) => n.toLocaleString('ko-KR');
export const fmtMan = (won: number) => Math.round(won / 10_000).toLocaleString('ko-KR'); // 원→만원

// 월급 기준 페이지 생성 대상(만원): 150~600 10만 단위 + 650~1,000 50만 단위
export function monthlyAmounts(): number[] {
  const list: number[] = [];
  for (let m = 150; m <= 600; m += 10) list.push(m);
  for (let m = 650; m <= 1000; m += 50) list.push(m);
  return list;
}
