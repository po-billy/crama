// 연봉 → 근로소득자 상위 % 추정
// 출처: 국세청 근로소득 백분위(2023 귀속, 연내 계속근로자 1,368만명) 보도·천분위 자료 앵커.
// 앵커 사이는 로그-선형 보간. 참고용 추정(중간 입·퇴사자 제외 통계).
const ANCHORS: [number, number][] = [
  // [연봉(만원), 상위 %]
  [113769, 0.1],
  [21673, 1],
  [10057, 10],
  [7624, 20],
  [5482, 36], // 평균(≈상위 36% 부근 — 우측 꼬리 분포 특성)
  [4272, 50],
  [2642, 80],
  [2119, 90],
  [1200, 97],
];

export function salaryTopPct(man: number): number {
  if (man >= ANCHORS[0][0]) return 0.1;
  if (man <= ANCHORS[ANCHORS.length - 1][0]) return 99;
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const [hiMan, hiPct] = ANCHORS[i];
    const [loMan, loPct] = ANCHORS[i + 1];
    if (man <= hiMan && man >= loMan) {
      const t = (Math.log(man) - Math.log(loMan)) / (Math.log(hiMan) - Math.log(loMan));
      const pct = loPct + (hiPct - loPct) * t;
      return Math.round(pct * 10) / 10;
    }
  }
  return 50;
}

export const RANK_BASIS = '국세청 근로소득 백분위(2023 귀속, 연내 계속근로자 기준) 앵커 보간 추정';
