/**
 * 내 혜택 찾기 — 2026년 한국 정부 지원금·정책 데이터베이스
 *
 * 사용자 프로필과 매칭하여 "당신이 받을 수 있는 혜택"을 보여준다.
 * 매칭 로직: 모든 eligibility 조건을 AND로 판정(하나라도 불만족 → 제외).
 * null/undefined 조건은 "제한 없음"으로 처리.
 *
 * ⚠️ 이 데이터는 2026-06 기준이며, 정책 변경 시 업데이트 필요.
 */

/* ── 프로필 타입 ── */
export type Employment = 'employed' | 'self-employed' | 'unemployed' | 'student';
export type Housing = 'own' | 'jeonse' | 'rent' | 'parents';
export type Region = 'seoul' | 'gyeonggi' | 'incheon' | 'busan' | 'daegu' | 'gwangju' | 'daejeon' | 'ulsan' | 'sejong' | 'gangwon' | 'chungbuk' | 'chungnam' | 'jeonbuk' | 'jeonnam' | 'gyeongbuk' | 'gyeongnam' | 'jeju';

export interface UserProfile {
  age: number;
  income: number;          // 연소득(만원)
  employment: Employment;
  housing: Housing;
  region: Region;
  familySize: number;      // 가구원수
  hasChildren: boolean;
  childAge?: number;       // 막내 자녀 나이 (없으면 undefined)
  isNewlywed: boolean;     // 신혼부부(혼인 7년 이내)
  isPregnant: boolean;
}

/* ── 혜택 타입 ── */
export type BenefitCategory = 'finance' | 'housing' | 'employment' | 'family' | 'tax' | 'education';

export interface Benefit {
  id: string;
  name: string;
  category: BenefitCategory;
  summary: string;           // 1~2줄 설명
  amount: string;            // "월 최대 70만원" 같은 표시용
  amountValue: number;       // 예상 연간 금액(만원) — 총액 계산용
  deadline?: string;         // "2026-07-03" 또는 "상시"
  deadlineLabel?: string;    // "~7/3 (5부제)" 같은 표시용
  applyUrl: string;          // 신청 링크
  applyMethod: string;       // "온라인(복지로)" 등
  tags: string[];            // 검색/필터용
  relatedSlug?: string;      // 관련 블로그 글 slug

  // 자격 조건 — null이면 "제한 없음"
  eligibility: {
    ageMin?: number;
    ageMax?: number;
    incomeMax?: number;        // 연소득 상한(만원)
    incomePercentile?: number; // 중위소득 비율(%) — incomeMax 대신 사용 가능
    employment?: Employment[];
    housing?: Housing[];
    region?: Region[];         // null이면 전국
    familySizeMin?: number;
    hasChildren?: boolean;
    childAgeMax?: number;
    isNewlywed?: boolean;
    isPregnant?: boolean;
  };
}

/* ── 카테고리 메타 ── */
export const BENEFIT_CATEGORIES: Record<BenefitCategory, { name: string; icon: string; color: string }> = {
  finance:    { name: '금융·저축', icon: '💰', color: '#6c5ce7' },
  housing:    { name: '주거·전월세', icon: '🏠', color: '#00b894' },
  employment: { name: '취업·창업', icon: '💼', color: '#0984e3' },
  family:     { name: '출산·육아', icon: '👶', color: '#e17055' },
  tax:        { name: '세금·공제', icon: '📋', color: '#fdcb6e' },
  education:  { name: '교육·자기개발', icon: '📚', color: '#a29bfe' },
};

/* ── 지역 메타 ── */
export const REGIONS: Record<Region, string> = {
  seoul: '서울', gyeonggi: '경기', incheon: '인천', busan: '부산',
  daegu: '대구', gwangju: '광주', daejeon: '대전', ulsan: '울산',
  sejong: '세종', gangwon: '강원', chungbuk: '충북', chungnam: '충남',
  jeonbuk: '전북', jeonnam: '전남', gyeongbuk: '경북', gyeongnam: '경남',
  jeju: '제주',
};

/* ── 2026년 중위소득 기준 (4인 가구 기준 비율 계산용) ── */
const MEDIAN_INCOME_2026: Record<number, number> = {
  1: 2392,  // 1인 가구 월 239.2만원 → 연 2,870만원
  2: 3932,
  3: 5025,
  4: 6097,
  5: 7108,
  6: 8064,
};
export function getMedianIncome(familySize: number, percentile: number): number {
  const base = MEDIAN_INCOME_2026[Math.min(familySize, 6)] ?? MEDIAN_INCOME_2026[4];
  return Math.round(base * 12 * (percentile / 100));
}

/* ── 혜택 데이터베이스 ── */
export const BENEFITS: Benefit[] = [
  // ━━━ 금융·저축 ━━━
  {
    id: 'youth-leap',
    name: '청년도약계좌',
    category: 'finance',
    summary: '매월 최대 70만원 납입, 정부기여금 + 이자 비과세로 5년 뒤 약 5,000만원. 실질 수익률 연 9~19%.',
    amount: '5년 만기 약 5,000만원',
    amountValue: 1000,
    deadline: '2026-07-03',
    deadlineLabel: '~7/3 (출생연도 5부제)',
    applyUrl: 'https://www.kinfa.or.kr',
    applyMethod: '시중은행 앱 (국민·신한·하나·우리 등)',
    tags: ['청년', '저축', '비과세', '정부기여금'],
    relatedSlug: 'youth-leap-vs-future-savings',
    eligibility: {
      ageMin: 19, ageMax: 34,
      incomeMax: 7500,
      employment: ['employed', 'self-employed'],
    },
  },
  {
    id: 'youth-tomorrow',
    name: '청년내일저축계좌',
    category: 'finance',
    summary: '월 10만원 저축 시 정부가 월 10~30만원 추가 적립. 3년 뒤 최대 1,440만원.',
    amount: '3년 만기 최대 1,440만원',
    amountValue: 480,
    applyUrl: 'https://www.bokjiro.go.kr',
    applyMethod: '복지로 온라인 신청',
    tags: ['청년', '저축', '저소득', '정부매칭'],
    eligibility: {
      ageMin: 15, ageMax: 39,
      incomePercentile: 100,
      employment: ['employed', 'self-employed'],
    },
  },
  {
    id: 'isa-tax-free',
    name: 'ISA 계좌 (개인종합자산관리)',
    category: 'finance',
    summary: '예금·펀드·ETF 수익에 대해 200~400만원까지 비과세. 2026년부터 납입한도 확대.',
    amount: '비과세 한도 최대 400만원',
    amountValue: 80,
    applyUrl: 'https://www.fss.or.kr',
    applyMethod: '증권사·은행 앱에서 개설',
    tags: ['절세', '투자', 'ETF', '비과세'],
    relatedSlug: 'isa-account-guide-2026',
    eligibility: {
      ageMin: 19,
    },
  },
  {
    id: 'irp-tax-deduction',
    name: 'IRP 세액공제',
    category: 'tax',
    summary: '연 최대 900만원 납입 시 최대 148.5만원 세액공제(16.5%). 퇴직연금과 통합.',
    amount: '연 최대 148.5만원 환급',
    amountValue: 148,
    applyUrl: 'https://www.fss.or.kr',
    applyMethod: '증권사·은행 앱에서 개설',
    tags: ['절세', '연금', '세액공제', '퇴직연금'],
    eligibility: {
      employment: ['employed', 'self-employed'],
    },
  },

  // ━━━ 주거·전월세 ━━━
  {
    id: 'youth-rent-subsidy',
    name: '청년 월세 지원',
    category: 'housing',
    summary: '월세 최대 20만원을 최장 12개월 지원. 보증금 대출과 중복 가능.',
    amount: '월 최대 20만원 (12개월)',
    amountValue: 240,
    applyUrl: 'https://www.myhome.go.kr',
    applyMethod: '마이홈 포털 또는 주민센터',
    tags: ['청년', '월세', '주거', '지원금'],
    eligibility: {
      ageMin: 19, ageMax: 34,
      incomePercentile: 60,
      housing: ['rent'],
    },
  },
  {
    id: 'youth-jeonse-loan',
    name: '청년 전세자금 대출',
    category: 'housing',
    summary: '최대 2억원, 연 1.5~2.5% 저금리 전세 대출. HUG 보증으로 보증금 보호.',
    amount: '최대 2억원 (연 1.5~2.5%)',
    amountValue: 200,
    applyUrl: 'https://nhuf.molit.go.kr',
    applyMethod: '주택도시기금 수탁은행',
    tags: ['청년', '전세', '대출', '저금리'],
    eligibility: {
      ageMin: 19, ageMax: 34,
      incomeMax: 5000,
      housing: ['jeonse'],
    },
  },
  {
    id: 'housing-benefit',
    name: '주거급여',
    category: 'housing',
    summary: '소득이 낮은 가구에 실제 임차료의 일부를 지원. 서울 기준 1인 최대 34.1만원.',
    amount: '월 최대 34.1만원 (서울 1인)',
    amountValue: 409,
    applyUrl: 'https://www.bokjiro.go.kr',
    applyMethod: '주민센터 또는 복지로',
    tags: ['저소득', '주거', '임차료', '기초'],
    eligibility: {
      incomePercentile: 48,
      housing: ['jeonse', 'rent'],
    },
  },
  {
    id: 'newlywed-jeonse',
    name: '신혼부부 전세자금 대출',
    category: 'housing',
    summary: '혼인 7년 이내 부부 대상, 최대 3억원 전세 대출 (연 1.5~2.7%).',
    amount: '최대 3억원 (연 1.5~2.7%)',
    amountValue: 300,
    applyUrl: 'https://nhuf.molit.go.kr',
    applyMethod: '주택도시기금 수탁은행',
    tags: ['신혼', '전세', '대출', '저금리'],
    eligibility: {
      incomeMax: 8500,
      isNewlywed: true,
      housing: ['jeonse'],
    },
  },
  {
    id: 'newborn-special-loan',
    name: '신생아 특례 대출',
    category: 'housing',
    summary: '2년 이내 출산 가구 대상, 구입 최대 5억·전세 최대 3억 (연 1.1~3.0%).',
    amount: '구입 최대 5억원 (연 1.1%~)',
    amountValue: 500,
    applyUrl: 'https://nhuf.molit.go.kr',
    applyMethod: '주택도시기금 수탁은행',
    tags: ['출산', '주택구입', '전세', '특례'],
    eligibility: {
      hasChildren: true,
      childAgeMax: 2,
    },
  },

  // ━━━ 취업·창업 ━━━
  {
    id: 'national-employment',
    name: '국민취업지원제도',
    category: 'employment',
    summary: '구직 활동 지원금 월 50만원(6개월) + 직업훈련 + 취업 알선. 1유형·2유형.',
    amount: '월 50만원 (최대 6개월)',
    amountValue: 300,
    applyUrl: 'https://www.kua.go.kr',
    applyMethod: '고용센터 방문 또는 온라인',
    tags: ['구직', '실업', '취업지원', '훈련'],
    eligibility: {
      ageMin: 15, ageMax: 69,
      employment: ['unemployed'],
    },
  },
  {
    id: 'youth-digital-job',
    name: '청년 디지털 일자리 사업',
    category: 'employment',
    summary: 'IT·디지털 분야 중소기업 취업 시 월 최대 190만원 급여 지원 + 훈련.',
    amount: '월 최대 190만원',
    amountValue: 2280,
    applyUrl: 'https://www.work.go.kr',
    applyMethod: '워크넷 온라인 신청',
    tags: ['청년', '디지털', 'IT', '일자리'],
    eligibility: {
      ageMin: 15, ageMax: 34,
      employment: ['unemployed', 'student'],
    },
  },
  {
    id: 'startup-support',
    name: '예비창업패키지',
    category: 'employment',
    summary: '예비 창업자에게 최대 1억원 사업화 자금 + 교육·멘토링 지원.',
    amount: '최대 1억원',
    amountValue: 10000,
    applyUrl: 'https://www.k-startup.go.kr',
    applyMethod: 'K-Startup 온라인 신청',
    tags: ['창업', '사업화', '자금', '멘토링'],
    eligibility: {
      ageMin: 19,
    },
  },
  {
    id: 'self-employed-insurance',
    name: '자영업자 고용보험',
    category: 'employment',
    summary: '자영업자도 고용보험 가입 가능. 폐업 시 실업급여(월 최대 198만원) 수급.',
    amount: '폐업 시 월 최대 198만원',
    amountValue: 198,
    applyUrl: 'https://www.ei.go.kr',
    applyMethod: '고용보험 사이트 또는 근로복지공단',
    tags: ['자영업', '고용보험', '실업급여', '폐업'],
    eligibility: {
      employment: ['self-employed'],
    },
  },

  // ━━━ 출산·육아 ━━━
  {
    id: 'parent-allowance',
    name: '부모급여',
    category: 'family',
    summary: '0세 월 100만원, 1세 월 50만원 지급. 어린이집 이용 시 보육료로 대체.',
    amount: '0세 월 100만원 / 1세 월 50만원',
    amountValue: 1200,
    applyUrl: 'https://www.bokjiro.go.kr',
    applyMethod: '정부24 또는 주민센터',
    tags: ['영아', '양육', '부모급여', '현금'],
    eligibility: {
      hasChildren: true,
      childAgeMax: 1,
    },
  },
  {
    id: 'first-meet-voucher',
    name: '첫만남이용권',
    category: 'family',
    summary: '출생 신고 시 200만원 바우처 지급 (쌍둥이 300만원). 유아용품·의료비 등.',
    amount: '200만원 (쌍둥이 300만원)',
    amountValue: 200,
    applyUrl: 'https://www.gov.kr',
    applyMethod: '정부24에서 출생 신고 시 자동 안내',
    tags: ['출산', '바우처', '신생아'],
    eligibility: {
      hasChildren: true,
      childAgeMax: 0,
      isPregnant: true,
    },
  },
  {
    id: 'child-allowance',
    name: '아동수당',
    category: 'family',
    summary: '만 8세 미만 아동에게 월 10만원 지급. 소득 무관.',
    amount: '월 10만원',
    amountValue: 120,
    applyUrl: 'https://www.bokjiro.go.kr',
    applyMethod: '정부24 또는 주민센터',
    tags: ['아동', '수당', '양육'],
    eligibility: {
      hasChildren: true,
      childAgeMax: 7,
    },
  },
  {
    id: 'childcare-subsidy',
    name: '영아수당 (양육수당)',
    category: 'family',
    summary: '어린이집 미이용 가정양육 시 월 15~20만원 현금 지원.',
    amount: '월 15~20만원',
    amountValue: 180,
    applyUrl: 'https://www.bokjiro.go.kr',
    applyMethod: '정부24 또는 주민센터',
    tags: ['영아', '양육수당', '가정양육'],
    eligibility: {
      hasChildren: true,
      childAgeMax: 5,
    },
  },

  // ━━━ 세금·공제 ━━━
  {
    id: 'eitc',
    name: '근로장려금 (EITC)',
    category: 'tax',
    summary: '저소득 근로자에게 최대 330만원 현금 지급. 5월 신청, 9월 지급.',
    amount: '최대 330만원',
    amountValue: 330,
    deadline: '2026-05-31',
    deadlineLabel: '매년 5월 신청 → 9월 지급',
    applyUrl: 'https://www.hometax.go.kr',
    applyMethod: '홈택스 또는 ARS(1544-9944)',
    tags: ['근로장려금', '저소득', '세금환급'],
    eligibility: {
      incomeMax: 3800,
      employment: ['employed', 'self-employed'],
    },
  },
  {
    id: 'child-tax-credit',
    name: '자녀장려금',
    category: 'tax',
    summary: '18세 미만 자녀가 있는 저소득 가구에 자녀 1인당 최대 100만원.',
    amount: '자녀 1인당 최대 100만원',
    amountValue: 100,
    deadline: '2026-05-31',
    deadlineLabel: '매년 5월 신청 → 9월 지급',
    applyUrl: 'https://www.hometax.go.kr',
    applyMethod: '홈택스 또는 ARS',
    tags: ['자녀장려금', '저소득', '세금환급'],
    eligibility: {
      incomeMax: 7000,
      hasChildren: true,
      childAgeMax: 17,
    },
  },
  {
    id: 'freelancer-tax',
    name: '프리랜서 종소세 절세',
    category: 'tax',
    summary: 'N잡·프리랜서 종합소득세 신고 시 경비율·단순경비율 적용으로 세금 절감.',
    amount: '소득에 따라 수십~수백만원 절세',
    amountValue: 100,
    deadline: '2026-05-31',
    deadlineLabel: '매년 5월 종합소득세 신고',
    applyUrl: 'https://www.hometax.go.kr',
    applyMethod: '홈택스 전자신고',
    tags: ['프리랜서', 'N잡', '종소세', '절세'],
    eligibility: {
      employment: ['self-employed'],
    },
  },

  // ━━━ 교육·자기개발 ━━━
  {
    id: 'national-scholarship',
    name: '국가장학금',
    category: 'education',
    summary: '대학생 등록금 지원. 소득 구간별 최대 전액(연 약 700만원).',
    amount: '최대 전액 (연 ~700만원)',
    amountValue: 700,
    applyUrl: 'https://www.kosaf.go.kr',
    applyMethod: '한국장학재단 온라인',
    tags: ['대학생', '등록금', '장학금'],
    eligibility: {
      ageMin: 18, ageMax: 30,
      incomePercentile: 200,
      employment: ['student'],
    },
  },
  {
    id: 'tomorrow-learning-card',
    name: '국민내일배움카드',
    category: 'education',
    summary: '직업 훈련비 최대 500만원 지원 (5년간). 온라인·오프라인 훈련 모두.',
    amount: '최대 500만원 (5년간)',
    amountValue: 100,
    applyUrl: 'https://www.hrd.go.kr',
    applyMethod: 'HRD-Net 온라인 신청',
    tags: ['직업훈련', '자기개발', '교육비'],
    eligibility: {
      ageMin: 15,
    },
  },

  // ━━━ 추가 혜택 (리서치 확장) ━━━
  {
    id: 'youth-tomorrow-fund',
    name: '청년내일채움공제',
    category: 'employment',
    summary: '중소기업 취업 청년이 2년간 400만원 적립 시, 기업+정부도 각 400만원 매칭. 만기 1,200만원+이자.',
    amount: '만기 1,200만원',
    amountValue: 600,
    applyUrl: 'https://www.comwel.or.kr',
    applyMethod: '청년공제 포털 또는 고용센터',
    tags: ['청년', '중소기업', '공제', '적립'],
    eligibility: {
      ageMin: 15, ageMax: 34,
      employment: ['employed'],
    },
  },
  {
    id: 'parental-leave',
    name: '육아휴직급여',
    category: 'family',
    summary: '고용보험 가입 근로자가 육아휴직 시 통상임금의 80~100% 지급. 첫 3개월 상한 250만원.',
    amount: '월 최대 250만원 (첫 3개월)',
    amountValue: 2100,
    applyUrl: 'https://www.ei.go.kr',
    applyMethod: '고용24 온라인 또는 고용센터',
    tags: ['육아', '휴직', '고용보험', '급여'],
    eligibility: {
      employment: ['employed'],
      hasChildren: true,
      childAgeMax: 8,
    },
  },
  {
    id: 'early-startup-package',
    name: '초기창업패키지',
    category: 'employment',
    summary: '창업 후 3년 이내 스타트업에 최대 1억원 사업화 자금 + 투자 연계·멘토링.',
    amount: '최대 1억원',
    amountValue: 10000,
    applyUrl: 'https://www.k-startup.go.kr',
    applyMethod: 'K-Startup 온라인 신청',
    tags: ['창업', '스타트업', '사업화', '자금'],
    eligibility: {
      employment: ['self-employed'],
    },
  },
  {
    id: 'small-biz-loan',
    name: '소상공인 정책자금 대출',
    category: 'employment',
    summary: '소상공인 저금리(연 2~4%) 운전자금 대출. 최대 7,000만원.',
    amount: '최대 7,000만원 (연 2~4%)',
    amountValue: 200,
    applyUrl: 'https://ols.semas.or.kr',
    applyMethod: '소상공인정책자금 온라인 포털',
    tags: ['소상공인', '대출', '운전자금', '저금리'],
    eligibility: {
      employment: ['self-employed'],
    },
  },
  {
    id: 'youth-isa',
    name: '청년형 ISA (우대)',
    category: 'finance',
    summary: '청년 전용 ISA. 비과세 한도 400만원(일반 200만원), 의무 가입 3년. 예금·펀드·ETF 통합 운용.',
    amount: '비과세 한도 400만원 (일반 대비 2배)',
    amountValue: 80,
    applyUrl: 'https://www.fss.or.kr',
    applyMethod: '시중 은행·증권사 앱',
    tags: ['청년', 'ISA', '비과세', '투자'],
    relatedSlug: 'isa-account-guide-2026',
    eligibility: {
      ageMin: 19, ageMax: 34,
      incomeMax: 3800,
    },
  },
  {
    id: 'eitc-dual',
    name: '근로장려금 (맞벌이)',
    category: 'tax',
    summary: '부부 모두 소득 있는 맞벌이 저소득 가구에 연 최대 330만원 환급.',
    amount: '연 최대 330만원',
    amountValue: 330,
    deadline: '2026-05-31',
    deadlineLabel: '매년 5월 신청',
    applyUrl: 'https://www.hometax.go.kr',
    applyMethod: '홈택스 또는 ARS',
    tags: ['맞벌이', '근로장려금', '세금환급'],
    eligibility: {
      incomeMax: 3800,
      employment: ['employed', 'self-employed'],
    },
  },
];

/* ── 매칭 엔진 ── */
export function matchBenefits(profile: UserProfile): Benefit[] {
  return BENEFITS.filter((b) => {
    const e = b.eligibility;

    // 나이
    if (e.ageMin != null && profile.age < e.ageMin) return false;
    if (e.ageMax != null && profile.age > e.ageMax) return false;

    // 소득
    if (e.incomeMax != null && profile.income > e.incomeMax) return false;
    if (e.incomePercentile != null) {
      const threshold = getMedianIncome(profile.familySize, e.incomePercentile);
      if (profile.income > threshold) return false;
    }

    // 고용 상태
    if (e.employment && !e.employment.includes(profile.employment)) return false;

    // 주거
    if (e.housing && !e.housing.includes(profile.housing)) return false;

    // 지역
    if (e.region && !e.region.includes(profile.region)) return false;

    // 가구원수
    if (e.familySizeMin != null && profile.familySize < e.familySizeMin) return false;

    // 자녀
    if (e.hasChildren === true && !profile.hasChildren) return false;
    if (e.childAgeMax != null && (!profile.hasChildren || (profile.childAge ?? 99) > e.childAgeMax)) return false;

    // 신혼
    if (e.isNewlywed === true && !profile.isNewlywed) return false;

    // 임신
    if (e.isPregnant === true && !profile.isPregnant) return false;

    return true;
  }).sort((a, b) => b.amountValue - a.amountValue); // 금액 큰 순
}
