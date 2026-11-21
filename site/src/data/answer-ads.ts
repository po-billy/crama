// 크라마 앤서 직접 판매 광고 — 계약이 생기면 ANSWER_ADS 에 한 줄 추가한다(기간이 지나면 자동으로 빠진다).
// 자리(zone): 'health'(건강검진 연도·나이별 결과 아래) · 'salary'(연봉 실수령액 결과 아래)
// regions: '*'(전국) 또는 시·도 이름 배열. 방문자가 고른 시·도와 맞는 광고가 먼저, 없으면 '*' 광고, 그것도 없으면 '자리 안내' 카드.
// 이미지: public/img/ads/ 에 넣고 '/img/ads/파일명' 으로. 링크에는 UTM이 자동으로 붙는다.

export const SIDO = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'] as const;

export interface AnswerAd {
  id: string; // utm_campaign 값으로도 쓰인다
  zone: 'health' | 'salary';
  regions: '*' | string[];
  brand: string;
  title: string; // 한 줄 또는 두 줄(\n)
  cta: string;
  href: string;
  img?: string;
  bg?: string; // 배너 바탕색
  accent?: string; // 버튼·로고 색
  start: string; // YYYY-MM-DD (그날부터)
  end: string; // YYYY-MM-DD (그날까지)
}

export const ANSWER_ADS: AnswerAd[] = [
  // 예) { id: 'oo-checkup-seoul', zone: 'health', regions: ['서울'], brand: 'OO건강검진센터', title: '연말 검진, 토요일에\n대기 없이 끝내세요', cta: '지금 예약하기', href: 'https://example.com/reserve', img: '/img/ads/oo-checkup.webp', bg: '#E4F3EC', accent: '#12936B', start: '2026-12-01', end: '2027-05-31' },
];

// 광고주가 없을 때 보여 줄 '자리 안내' 카드
export const HOUSE: Record<AnswerAd['zone'], { label: string; title: string; sub: string; href: string }> = {
  health: { label: '광고 자리 안내', title: '{region} 검진 파트너 자리가 비어 있어요', sub: '지금 이 화면은 올해 검진 대상을 확인한 사람이 봅니다. 검진센터라면 이 자리에 소개해 보세요.', href: '/answer/health-partner/' },
  salary: { label: '광고 자리 안내', title: '연봉을 확인한 직후, 이 자리가 보입니다', sub: '세무·금융·이직·HR 서비스를 실수령액 결과 바로 아래에 소개해 보세요.', href: '/answer/#lineup' },
};
