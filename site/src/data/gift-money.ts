// 경조사비(축의금·조의금·돌잔치) 적정 금액 — 정답이 있는 값이 아니라 "많이 내는 범위"다.
// 근거: 인크루트 직장인 설문(2025년 5월, 844명: 식사하는 직장 동료 결혼식 10만원 응답이 가장 많음)과 언론·생활 정보에 자주 나오는 관계별 범위.
// 금액 단위는 만원. 관례상 10만원 아래는 3·5·7만원, 그 위는 10·15·20만원처럼 낸다.

export type EventKey = 'wedding' | 'funeral' | 'firstbday';
export type RelKey = 'family' | 'bestfriend' | 'friend' | 'teammate' | 'coworker' | 'boss' | 'client';

export const EVENTS: Record<EventKey, { name: string; money: string; slug: string; verb: string }> = {
  wedding: { name: '결혼식', money: '축의금', slug: 'wedding', verb: '결혼식 축의금' },
  funeral: { name: '장례식', money: '조의금', slug: 'funeral', verb: '장례식 조의금(부조금)' },
  firstbday: { name: '돌잔치', money: '돌잔치 축하금', slug: 'firstbday', verb: '돌잔치 축하금' },
};
export const RELS: Record<RelKey, { name: string; slug: string; desc: string }> = {
  family: { name: '가까운 친척', slug: 'family', desc: '사촌 이내, 자주 보는 친척' },
  bestfriend: { name: '친한 친구', slug: 'best-friend', desc: '따로 연락하고 만나는 친구' },
  friend: { name: '친구·지인', slug: 'friend', desc: '모임에서 보는 정도의 사이' },
  teammate: { name: '같은 팀 동료', slug: 'teammate', desc: '매일 같이 일하는 동료' },
  coworker: { name: '얼굴만 아는 동료', slug: 'coworker', desc: '업무로만 가끔 이야기하는 사이' },
  boss: { name: '상사·선배', slug: 'boss', desc: '직장 상사, 학교 선배' },
  client: { name: '거래처', slug: 'client', desc: '업무로 만나는 외부 관계' },
};

/** [최소, 권장, 최대] (만원) — 결혼식은 식사 참석 기준, att=false면 불참 기준 */
const TABLE: Record<EventKey, Record<RelKey, { go: [number, number, number]; no?: [number, number, number] }>> = {
  wedding: {
    family: { go: [20, 30, 50], no: [10, 20, 30] },
    bestfriend: { go: [10, 15, 20], no: [10, 10, 15] },
    friend: { go: [5, 10, 10], no: [3, 5, 5] },
    teammate: { go: [10, 10, 15], no: [5, 5, 10] },
    coworker: { go: [5, 10, 10], no: [3, 5, 5] },
    boss: { go: [10, 10, 15], no: [5, 5, 10] },
    client: { go: [5, 10, 10], no: [5, 5, 5] },
  },
  funeral: {
    family: { go: [10, 20, 50] },
    bestfriend: { go: [10, 10, 20] },
    friend: { go: [5, 5, 10] },
    teammate: { go: [5, 10, 10] },
    coworker: { go: [3, 5, 5] },
    boss: { go: [5, 10, 10] },
    client: { go: [5, 5, 10] },
  },
  firstbday: {
    family: { go: [10, 20, 30] },
    bestfriend: { go: [10, 10, 15] },
    friend: { go: [5, 5, 10] },
    teammate: { go: [5, 5, 10] },
    coworker: { go: [3, 5, 5] },
    boss: { go: [5, 10, 10] },
    client: { go: [5, 5, 10] },
  },
};

export function giftRange(ev: EventKey, rel: RelKey, attend = true) {
  const row = TABLE[ev][rel];
  return (!attend && row.no) ? row.no : row.go;
}

/** 관례 금액으로 맞추기: 10만원 아래는 3·5·7, 위는 5만원 단위 */
export function tidy(man: number) {
  if (man <= 3) return 3;
  if (man < 10) return man <= 5 ? 5 : man <= 7 ? 7 : 10;
  return Math.ceil(man / 5) * 5;
}

export const PAGES = (Object.keys(EVENTS) as EventKey[]).flatMap((e) => (Object.keys(RELS) as RelKey[]).map((r) => ({ e, r, slug: `${EVENTS[e].slug}-${RELS[r].slug}` })));
