// 쿠팡 파트너스 제휴 링크 — COUPANG_ON 으로 전체를 켜고 끈다(끄면 상자·기획전 페이지 링크가 모두 사라짐).
// 링크는 반드시 파트너스에서 변환한 link.coupang.com 주소만 넣는다(쿠팡 원래 주소는 정산되지 않음).
// 노출 위치: components/SideRail.astro 의 '함께 보면 좋은 상품' 상자, pages/deals.astro(기획전 모음).
// 기획전 목록 원본: data/coupang-events.json (파트너스 '이벤트/프로모션 목록'에서 수집, 종료일 지난 것은 화면에서 자동 숨김)
export const COUPANG_ON = true;

// 공정위 지침·파트너스 약관상 링크가 있는 화면마다 반드시 함께 표시해야 하는 문구(수정·삭제 금지)
export const COUPANG_NOTICE = '이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';

export type PartnerLink = { label: string; desc: string; href: string; match: string[] };
// 위에 있을수록 먼저 노출(한 화면에 최대 3개). match 는 주소의 앞부분.
export const COUPANG_LINKS: PartnerLink[] = [
  { label: '가정용 혈압계', desc: '검진 전에 집에서 미리 재 보기', href: 'https://link.coupang.com/a/iIuovyXwya', match: ['/health-check/'] },
  { label: '혈당 측정기', desc: '공복 혈당을 집에서 확인', href: 'https://link.coupang.com/a/iIwpN1smL6', match: ['/health-check/'] },
  { label: '종합비타민', desc: '매일 챙기는 기본 영양제', href: 'https://link.coupang.com/a/iIwqXM5K9Y', match: ['/health-check/'] },
  { label: '체성분 체중계', desc: '체지방·근육량까지 재는 체중계', href: 'https://link.coupang.com/a/iIwo7Dy0my', match: ['/health/bmi/', '/health/body-fat/', '/health/bmr/'] },
  { label: '단백질 보충제', desc: '운동 후 단백질 채우기', href: 'https://link.coupang.com/a/iIwzk7p89s', match: ['/health/bmr/', '/health/bmi/', '/health/body-fat/'] },
  { label: '텀블러·물병', desc: '하루 물 섭취량 채우기', href: 'https://link.coupang.com/a/iIwz47euyq', match: ['/health/water/'] },
  { label: '디카페인 커피', desc: '카페인 걱정 없이 한 잔', href: 'https://link.coupang.com/a/iIwA20Sxiu', match: ['/health/caffeine/'] },
  { label: '수면 안대', desc: '빛을 가려 깊게 자기', href: 'https://link.coupang.com/a/iIwBWzLYiG', match: ['/health/sleep/'] },
  { label: '오메가3', desc: '많이 찾는 건강기능식품', href: 'https://link.coupang.com/a/iIwwHcDI9A', match: ['/health/'] },
  { label: '군인 선물', desc: '면회·전역 때 챙기는 선물', href: 'https://link.coupang.com/a/iIwxB6C61I', match: ['/discharge/'] },
  { label: '군용 시계', desc: '훈련소·부대에서 쓰는 시계', href: 'https://link.coupang.com/a/iIwyIUOKLA', match: ['/discharge/'] },
  { label: '보드게임', desc: '모임에서 꺼내기 좋은 게임', href: 'https://link.coupang.com/a/iIwDiAaGcK', match: ['/games/', '/pick/'] },
  { label: '여행용 캐리어', desc: '연휴 여행 준비', href: 'https://link.coupang.com/a/iIwGNwc6Wi', match: ['/holidays/'] },
  { label: '다이어리', desc: '일정과 기념일 적어 두기', href: 'https://link.coupang.com/a/iIwHkfbQHs', match: ['/dday/', '/fortune/', '/tarot/', '/lunar/'] },
  { label: '가계부', desc: '월급 관리의 시작', href: 'https://link.coupang.com/a/iIwHS5ARGu', match: ['/salary/', '/wage/', '/insurance/', '/calc/dutch-pay/'] },
];
// 딱 맞는 상품이 없는 화면에 쓰는 공통 링크(매일 바뀌는 특가)
export const COUPANG_GOLDBOX: PartnerLink = { label: '쿠팡 골드박스', desc: '매일 바뀌는 오늘의 특가', href: 'https://link.coupang.com/a/iIwosfxcvk', match: [] };

export function partnerFor(pathname: string): PartnerLink[] {
  if (!COUPANG_ON) return [];
  const hit = COUPANG_LINKS.filter((l) => l.match.some((m) => pathname.startsWith(m))).slice(0, 3);
  return hit.length ? hit : [COUPANG_GOLDBOX];
}
