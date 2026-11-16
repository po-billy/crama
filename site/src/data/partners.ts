// 쿠팡 파트너스 제휴 링크 — 지금은 꺼 둠(애드센스 승인 뒤 COUPANG_ON 을 true 로).
// 링크는 반드시 파트너스에서 변환한 link.coupang.com 주소만 넣는다(쿠팡 원래 주소는 정산되지 않음).
// 노출 위치: components/SideRail.astro 의 '함께 보면 좋은 상품' 상자(고지 문구 포함). 주소가 match 로 시작하는 페이지에만 나온다.
export const COUPANG_ON = false;

// 공정위 지침·파트너스 약관상 링크가 있는 화면마다 반드시 함께 표시해야 하는 문구(수정·삭제 금지)
export const COUPANG_NOTICE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

export type PartnerLink = { label: string; desc: string; href: string; match: string[] };
export const COUPANG_LINKS: PartnerLink[] = [
  { label: '가정용 혈압계 보러 가기', desc: '검진 전에 집에서 미리 재 보세요', href: 'https://link.coupang.com/a/iIuovyXwya', match: ['/health-check/'] },
];

export const partnerFor = (pathname: string) => (COUPANG_ON ? COUPANG_LINKS.filter((l) => l.match.some((m) => pathname.startsWith(m))) : []);
