/**
 * 연말정산 계산 — 2026년 귀속(2027년 1~2월 정산) 근로소득만 있는 사람 기준.
 * 연말정산 계산기(/year-end-tax/)와 연봉별 페이지(/year-end-tax/[amount]/)가 함께 쓴다(브라우저에서도 그대로 실행).
 *
 * 근거: 국세청 「2025년 연말정산 신고안내」의 계산식 + 국회예산정책처 「2025년 개정세법」의 2026년 귀속 변경분.
 * 2026년 귀속에 바뀐 것: 카드 공제 기본한도가 자녀 수에 따라 늘어남(7천만 이하 300/350/400, 초과 250/275/300),
 * 자녀세액공제 나이 9세 이상(2017년생 제외 → 2006~2016년생), 고향사랑기부금 10만~20만 구간 40%.
 * 국세청 「2026년 귀속 연말정산 신고안내」(보통 12월 발간)가 나오면 다시 대조할 것.
 *
 * 검증: scripts/check-yearend.mjs — 국세청 안내서 예시 두 개(카드 공제 530만원, 결정세액 240,232원)와 맞춰 본다.
 */
import { earnedIncomeDeduction, basicTax, earnedTaxCredit, computeSalary } from './salary';

export const YE_YEAR = 2026; // 귀속 연도
export const MAN = 10_000;
const floor = (x: number) => Math.floor(x + 1e-6);

export interface YeInput {
  gross: number;            // 총급여(원, 비과세 제외)
  // 인적공제
  spouse?: boolean;         // 배우자 기본공제(소득금액 100만원 이하)
  kids?: number;            // 기본공제 받는 20세 이하 자녀 수
  kidsCredit?: number;      // 그중 자녀세액공제 대상(2006~2016년생)
  newborn?: 0 | 1 | 2 | 3;  // 올해 출생·입양한 아이가 몇째인지(0=없음, 3=셋째 이상)
  parents?: number;         // 60세 이상 부모 등 그 밖의 부양가족 수
  senior70?: number;        // 기본공제 대상 중 70세 이상 수
  disabled?: number;        // 기본공제 대상 중 장애인 수(본인 포함)
  singleParent?: boolean;   // 한부모
  woman?: boolean;          // 부녀자(배우자 있는 여성 또는 부양가족 있는 여성 세대주)
  // 4대보험(원, 연간) — 비우면 총급여로 추정
  pensionIns?: number;      // 국민연금 본인 부담
  healthIns?: number;       // 건강보험+장기요양+고용보험 본인 부담
  // 신용카드 등(원, 연간). 전통시장·대중교통·문화체육은 결제수단과 상관없이 따로 적는다.
  credit?: number;          // 신용카드(아래 세 항목 제외)
  debit?: number;           // 체크카드·현금영수증(아래 세 항목 제외)
  market?: number;          // 전통시장
  transit?: number;         // 대중교통
  culture?: number;         // 도서·공연·영화·박물관·수영장·헬스장(총급여 7천만 이하만)
  // 주택(원, 연간)
  rentLoan?: number;        // 주택임차차입금 원리금 상환액(무주택 세대주)
  subscription?: number;    // 주택청약종합저축 납입액(총급여 7천만 이하 무주택 세대주·배우자)
  mortgage?: number;        // 장기주택저당차입금 이자상환액
  mortgageCap?: number;     // 그 한도(600만~2,000만, 대출 조건에 따라)
  // 세액공제(원, 연간)
  pensionSaving?: number;   // 연금저축
  irp?: number;             // 퇴직연금(IRP)
  insPremium?: number;      // 보장성 보험료
  medSelf?: number;         // 의료비: 본인·65세 이상·6세 이하·장애인·산정특례자
  medOther?: number;        // 의료비: 그 밖의 부양가족
  medIvf?: number;          // 의료비: 난임시술
  eduSelf?: number;         // 교육비: 본인(대학원 포함)
  eduKids?: number;         // 교육비: 취학 전·초중고(1인당 300만 한도 안의 금액)
  eduUniv?: number;         // 교육비: 대학생 부양가족(1인당 900만 한도 안의 금액)
  donPolitical?: number;    // 정치자금 기부금
  donHometown?: number;     // 고향사랑기부금
  donGeneral?: number;      // 특례·일반 기부금(종교단체 제외)
  rent?: number;            // 월세(무주택 세대주, 총급여 8천만 이하)
  // 이미 낸 세금
  paid?: number;            // 올해 원천징수된 소득세 합계(원, 지방소득세 제외). 비우면 추정
}

/** 신용카드 등 소득공제 — 국세청 계산식(①~⑤ − ⑥, 기본한도 + 추가한도) */
export function cardDeduction(gross: number, c: { credit?: number; debit?: number; market?: number; transit?: number; culture?: number }, kids = 0) {
  const credit = c.credit || 0, debit = c.debit || 0, market = c.market || 0, transit = c.transit || 0;
  // 문화체육 30%는 총급여 7천만 이하만. 초과면 결제수단 구분 없이 신용카드 쪽(15%)으로 본다(보수적으로).
  const cultureOk = gross <= 70_000_000;
  const culture = cultureOk ? c.culture || 0 : 0;
  const creditAll = credit + (cultureOk ? 0 : c.culture || 0);
  const total = creditAll + debit + culture + market + transit;
  const threshold = gross * 0.25;
  const possibleRaw = creditAll * 0.15 + debit * 0.3 + culture * 0.3 + market * 0.4 + transit * 0.4;
  let minus: number;
  if (threshold <= creditAll) minus = threshold * 0.15;
  else if (threshold <= creditAll + debit + culture) minus = creditAll * 0.15 + (threshold - creditAll) * 0.3;
  else minus = creditAll * 0.15 + (debit + culture) * 0.3 + (threshold - creditAll - debit - culture) * 0.4;
  const possible = Math.max(0, possibleRaw - minus);
  const k = Math.min(kids, 2);
  const baseCap = gross <= 70_000_000 ? [3_000_000, 3_500_000, 4_000_000][k] : [2_500_000, 2_750_000, 3_000_000][k];
  const extraCap = gross <= 70_000_000 ? 3_000_000 : 2_000_000;
  const special = culture * 0.3 + market * 0.4 + transit * 0.4;
  const over = Math.max(0, possible - baseCap);
  const extra = Math.min(over, special, extraCap);
  const deduction = floor(Math.min(possible, baseCap) + extra);
  return { total, threshold, overThreshold: total - threshold, possible: floor(possible), baseCap, extraCap, deduction };
}

const childCredit = (n: number) => (n <= 0 ? 0 : n === 1 ? 250_000 : 550_000 + (n - 2) * 400_000);
const newbornCredit = (k: number) => [0, 300_000, 500_000, 700_000][Math.min(Math.max(k, 0), 3)];

function medicalCredit(gross: number, self: number, other: number, ivf: number) {
  const th = gross * 0.03;
  let o = 0, s = self, v = ivf;
  if (other >= th) o = Math.min(other - th, 7_000_000);
  else {
    let rem = th - other;
    const cutS = Math.min(s, rem); s -= cutS; rem -= cutS;
    v = Math.max(0, v - rem);
  }
  return floor((o + s) * 0.15 + v * 0.3);
}

function donationCredit(income: number, p: number, h: number, g: number) {
  const pol = Math.min(p, 100_000) * (100 / 110) + Math.max(0, p - 100_000) * 0.15;
  const home = Math.min(h, 100_000) * (100 / 110) + Math.min(Math.max(h - 100_000, 0), 100_000) * 0.4 + Math.min(Math.max(h - 200_000, 0), 19_800_000) * 0.15;
  const gCap = Math.max(0, (income - p - Math.min(h, 20_000_000)) * 0.3);
  const gg = Math.min(g, gCap);
  const gen = Math.min(gg, 10_000_000) * 0.15 + Math.max(0, gg - 10_000_000) * 0.3;
  return { polHome: floor(pol) + floor(home), general: floor(gen) };
}

export interface YeResult {
  gross: number; eid: number; income: number;
  personal: number; pensionIns: number; healthIns: number; housing: number; subscription: number;
  card: ReturnType<typeof cardDeduction>; cardDeduction: number; overLimit: number;
  taxBase: number; calcTax: number;
  credits: { earned: number; child: number; pension: number; insurance: number; medical: number; education: number; donation: number; rent: number; standard: number };
  usedStandard: boolean;
  decided: number; decidedLocal: number;   // 결정세액(소득세), 지방소득세
  paid: number; paidLocal: number; paidEstimated: boolean;
  diff: number;                            // 결정 − 기납부(소득세+지방세). 음수면 환급
  marginal: number;                        // 한계세율(지방세 포함)
}

/** 4대보험 연간 추정(연봉 계산기와 같은 요율) */
export function insuranceOf(gross: number) {
  const s = computeSalary(gross);
  return { pensionIns: s.np * 12, healthIns: (s.hi + s.ltc + s.ei) * 12 };
}

/** 매달 원천징수된 소득세 연간 추정 — 간이세액표 원리(근로소득공제·인적공제·보험료·근로소득세액공제·자녀세액공제)로 근사 */
export function estimatePaid(gross: number, family: number, kidsCredit: number) {
  const ins = insuranceOf(gross);
  const base = Math.max(0, gross - earnedIncomeDeduction(gross) - 1_500_000 * Math.max(1, family) - ins.pensionIns - ins.healthIns);
  const calc = basicTax(base);
  return floor(Math.max(0, calc - earnedTaxCredit(calc, gross) - childCredit(kidsCredit)));
}

function marginalRate(base: number) {
  const r = base <= 14e6 ? 0.06 : base <= 50e6 ? 0.15 : base <= 88e6 ? 0.24 : base <= 150e6 ? 0.35 : base <= 300e6 ? 0.38 : base <= 500e6 ? 0.4 : base <= 1e9 ? 0.42 : 0.45;
  return r * 1.1;
}

export function computeYearEnd(inp: YeInput): YeResult {
  const gross = Math.max(0, inp.gross || 0);
  const n = (k: keyof YeInput) => Math.max(0, Number(inp[k]) || 0);
  const eid = floor(earnedIncomeDeduction(gross));
  const income = gross - eid;

  // 인적공제
  const kids = n('kids'), parents = n('parents');
  const basicCount = 1 + (inp.spouse ? 1 : 0) + kids + parents;
  let personal = 1_500_000 * basicCount + 1_000_000 * n('senior70') + 2_000_000 * n('disabled');
  if (inp.singleParent) personal += 1_000_000;
  else if (inp.woman && income <= 30_000_000) personal += 500_000;

  const est = insuranceOf(gross);
  const pensionIns = inp.pensionIns != null ? n('pensionIns') : est.pensionIns;
  const healthIns = inp.healthIns != null ? n('healthIns') : est.healthIns;

  // 주택자금(특별소득공제) + 청약(그 밖의 소득공제)
  const sub = gross <= 70_000_000 ? Math.min(n('subscription'), 3_000_000) * 0.4 : 0;
  const rentLoanD = n('rentLoan') * 0.4;
  const rentPart = Math.min(rentLoanD + sub, 4_000_000);           // 임차차입금 + 청약 합산 400만
  const subscription = floor(Math.min(sub, rentPart));
  const rentLoanPart = floor(rentPart - subscription);
  const mortCap = n('mortgageCap') || 8_000_000;
  const mort = Math.min(n('mortgage'), mortCap);
  const housingAll = mort > 0 ? Math.min(mort + rentLoanPart + subscription, mortCap) : rentLoanPart + subscription;
  const housing = Math.max(0, housingAll - subscription);           // 특별소득공제 부분

  const card = cardDeduction(gross, { credit: n('credit'), debit: n('debit'), market: n('market'), transit: n('transit'), culture: n('culture') }, kids);

  // 세액공제(공통)
  const kc = Math.min(n('kidsCredit'), kids || n('kidsCredit'));
  const child = childCredit(kc) + newbornCredit(n('newborn'));
  const pensionBase = Math.min(Math.min(n('pensionSaving'), 6_000_000) + n('irp'), 9_000_000);
  const pension = floor(pensionBase * (gross <= 55_000_000 ? 0.15 : 0.12));
  const don = donationCredit(income, n('donPolitical'), n('donHometown'), n('donGeneral'));

  function run(itemized: boolean) {
    const special = itemized ? healthIns + housing : 0;
    // 소득공제 종합한도 2,500만: 주택자금 + 청약 + 카드
    const capped = (itemized ? housing : 0) + subscription + card.deduction;
    const overLimit = Math.max(0, capped - 25_000_000);
    const taxBase = Math.max(0, income - personal - pensionIns - special - subscription - card.deduction + overLimit);
    const calcTax = floor(basicTax(taxBase));
    const earned = floor(earnedTaxCredit(calcTax, gross));
    const insurance = itemized ? floor(Math.min(n('insPremium'), 1_000_000) * 0.12) : 0;
    const medical = itemized ? medicalCredit(gross, n('medSelf'), n('medOther'), n('medIvf')) : 0;
    const education = itemized ? floor((n('eduSelf') + n('eduKids') + n('eduUniv')) * 0.15) : 0;
    const donation = don.polHome + (itemized ? don.general : 0);
    const rent = itemized && gross <= 80_000_000 ? floor(Math.min(n('rent'), 10_000_000) * (gross <= 55_000_000 ? 0.17 : 0.15)) : 0;
    const standard = itemized ? 0 : 130_000;
    const credits = { earned, child, pension, insurance, medical, education, donation, rent, standard };
    const sum = Object.values(credits).reduce((a, b) => a + b, 0);
    const decided = floor(Math.max(0, calcTax - sum));
    return { taxBase, calcTax, credits, decided, overLimit };
  }
  const a = run(true), b = run(false);
  const best = b.decided < a.decided ? b : a;
  const usedStandard = best === b;

  const paidEstimated = inp.paid == null || inp.paid === ('' as any);
  const paid = paidEstimated ? estimatePaid(gross, basicCount, kc) : n('paid');
  const decidedLocal = floor(best.decided * 0.1 / 10) * 10;
  const paidLocal = floor(paid * 0.1 / 10) * 10;
  return {
    gross, eid, income, personal, pensionIns, healthIns, housing: usedStandard ? 0 : housing, subscription,
    card, cardDeduction: card.deduction, overLimit: best.overLimit,
    taxBase: best.taxBase, calcTax: best.calcTax, credits: best.credits, usedStandard,
    decided: best.decided, decidedLocal, paid, paidLocal, paidEstimated,
    diff: best.decided + decidedLocal - paid - paidLocal,
    marginal: marginalRate(best.taxBase),
  };
}

/** '이렇게 하면 더 돌려받아요' — 같은 입력에 금액을 더해 다시 계산한 차이(소득세+지방세) */
export function whatIf(inp: YeInput, patch: Partial<YeInput>) {
  const a = computeYearEnd(inp), b = computeYearEnd({ ...inp, ...patch, paid: a.paid });
  return (a.decided + a.decidedLocal) - (b.decided + b.decidedLocal);
}

/** 연봉별 페이지 대상(만원): 연봉 계산기와 같은 구간 */
export function yeAmounts(): number[] {
  const list: number[] = [];
  for (let m = 2000; m <= 10000; m += 100) list.push(m);
  for (let m = 10500; m <= 15000; m += 500) list.push(m);
  return list;
}
