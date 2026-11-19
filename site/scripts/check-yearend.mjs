// 연말정산 계산 검증 — 국세청 「2025년 연말정산 신고안내」 예시와 맞는지 확인한다.
// 실행: npx esbuild scripts/check-yearend.mjs --bundle --platform=node --log-level=warning | node   (site 폴더에서)
import { computeYearEnd, cardDeduction } from '../src/lib/yearend';
const M = 10000;
let fail = 0;
const eq = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log(ok ? 'OK  ' : 'FAIL', name, got, ok ? '' : `(기대 ${want})`); };

// 예시 1: 총급여 6,800만, 4,300만 사용 → 카드 공제 530만(자녀 없음 → 2026년 기본한도도 300만)
const c1 = cardDeduction(6800 * M, { credit: 3000 * M, debit: 700 * M, market: 300 * M, transit: 200 * M, culture: 100 * M }, 0);
eq('예시1 공제가능금액', c1.possible, 635 * M);
eq('예시1 카드 공제', c1.deduction, 530 * M);

// 예시 2: 총급여 6,540만, 자녀 3명 → 결정세액 240,232원, 환급 759,768원
const r = computeYearEnd({
  gross: 6540 * M, spouse: false, kids: 3, kidsCredit: 3, pensionIns: 250 * M, healthIns: 170 * M,
  mortgage: 100 * M, mortgageCap: 1800 * M,
  credit: 1300 * M, debit: 1200 * M, market: 300 * M, transit: 200 * M, culture: 100 * M,
  irp: 300 * M, insPremium: 120 * M,
  medOther: 450 * M, medSelf: 180 * M, medIvf: 100 * M, eduSelf: 0, eduKids: 420 * M,
  donPolitical: 20 * M, donHometown: 10 * M, donGeneral: 50 * M, paid: 100 * M,
});
eq('예시2 근로소득금액', r.income, 52_380_000);
eq('예시2 카드 공제', r.cardDeduction, 4_895_000);
eq('예시2 과세표준', r.taxBase, 36_285_000);
eq('예시2 산출세액', r.calcTax, 4_182_750);
eq('예시2 근로소득세액공제', r.credits.earned, 660_000);
eq('예시2 연금계좌', r.credits.pension, 360_000);
eq('예시2 보험료', r.credits.insurance, 120_000);
eq('예시2 의료비', r.credits.medical, 950_700);
eq('예시2 교육비', r.credits.education, 630_000);
eq('예시2 기부금', r.credits.donation, 271_818);
eq('예시2 결정세액', r.decided, 240_232);
process.exit(fail ? 1 : 0);
