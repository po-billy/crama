// 채팅 붙여넣기 → 참여자 목록. 치지직·SOOP·유튜브·트위치 채팅을 복사해 붙여 넣은 텍스트를 읽는다.
// 서버로 아무것도 보내지 않는다.

export type ChatOpts = {
  keyword: string; // 쉼표로 여러 개. 비우면 채팅한 사람 모두
  weighted: boolean; // true면 참여 채팅 횟수만큼 여러 번(최대 maxPer)
  maxPer: number;
  exclude: string[]; // 뺄 닉네임(봇·방장)
};
export type Entry = { name: string; count: number };

const TIME = /^\s*(?:\[?\s*(?:오전|오후|AM|PM)?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\s*\]?)\s*/i;
const BADGE = /^(?:\[[^\]]{1,12}\]\s*)+/; // [매니저] [구독자] 같은 머리표

/** 한 줄을 '닉네임'과 '메시지'로 나눈다. 나눌 수 없으면 null */
export function splitLine(line: string): { name: string; msg: string } | null {
  let t = line.replace(TIME, '').trim();
  t = t.replace(BADGE, '').trim();
  if (!t) return null;
  const m = t.match(/^(.{1,40}?)\s*[:：]\s?(.*)$/);
  if (!m) return null;
  let name = m[1].trim().replace(/\s*\([^)]{1,30}\)$/, ''); // 닉네임(아이디) → 닉네임
  name = name.replace(/^@/, '').trim();
  if (!name || /^https?$/i.test(name)) return null;
  return { name, msg: m[2].trim() };
}

export function parseChat(text: string, o: ChatOpts): { entries: Entry[]; lines: number; matched: number } {
  const kws = o.keyword.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
  const ex = new Set(o.exclude.map((s) => s.trim().toLowerCase()).filter(Boolean));
  const map = new Map<string, number>();
  let lines = 0, matched = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    lines++;
    const p = splitLine(raw);
    if (!p || ex.has(p.name.toLowerCase())) continue;
    const msg = p.msg.toLowerCase();
    if (kws.length && !kws.some((k) => msg.includes(k))) continue;
    matched++;
    map.set(p.name, (map.get(p.name) || 0) + 1);
  }
  const entries = [...map.entries()].map(([name, c]) => ({ name, count: o.weighted ? Math.min(o.maxPer, c) : 1 }));
  return { entries, lines, matched };
}

/** '닉네임 x3' 형식 줄들을 항목으로 */
export function parseWeights(text: string): Entry[] {
  const out: Entry[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const t = raw.trim(); if (!t) continue;
    const m = t.match(/^(.*?)\s*[xX×*]\s*(\d{1,3})$/);
    out.push({ name: (m ? m[1] : t).trim(), count: m ? Math.max(1, +m[2]) : 1 });
  }
  return out.filter((e) => e.name);
}

/** 같은 이름은 횟수를 더한다 */
export function mergeEntries(...lists: Entry[][]): Entry[] {
  const map = new Map<string, number>();
  lists.flat().forEach((e) => map.set(e.name, (map.get(e.name) || 0) + e.count));
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

/** 가중치 무작위 1명 */
export function weightedPick(list: Entry[]): Entry | null {
  const total = list.reduce((s, e) => s + e.count, 0);
  if (!total) return null;
  let r = Math.random() * total;
  for (const e of list) { r -= e.count; if (r < 0) return e; }
  return list[list.length - 1];
}

/** 게임 입력칸 형식(한 줄에 '이름 xN') */
export function toGameLines(list: Entry[]) { return list.map((e) => (e.count > 1 ? `${e.name} x${e.count}` : e.name)).join('\n'); }
