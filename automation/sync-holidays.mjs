// 공휴일 동기화 — 한국천문연구원 특일정보(공공데이터포털) → site/src/data/holidays.json
// 실행: node automation/sync-holidays.mjs   (DATA_GO_KR_KEY 필요, 해당 API 활용신청이 되어 있어야 함)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site/src/data/holidays.json');
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, 'automation/.env'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const KEY = process.env.DATA_GO_KR_KEY || env.DATA_GO_KR_KEY;
if (!KEY) { console.error('DATA_GO_KR_KEY 없음'); process.exit(1); }
const now = new Date().getFullYear();
const YEARS = [now, now + 1];
const out = {};
for (const y of YEARS) {
  const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${encodeURIComponent(KEY)}&solYear=${y}&numOfRows=100&_type=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'holiday-sync/1.0' } });
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch (e) { console.error(y, '응답이 JSON이 아님:', text.slice(0, 200)); process.exit(2); }
  const items = j?.response?.body?.items?.item;
  const list = (Array.isArray(items) ? items : items ? [items] : []).filter((i) => i.isHoliday === 'Y').map((i) => { const d = String(i.locdate); return { date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, name: String(i.dateName) }; });
  if (!list.length) { console.error(y, '공휴일이 비어 있음:', text.slice(0, 200)); process.exit(3); }
  out[y] = list.sort((a, b) => a.date.localeCompare(b.date));
  console.log(y, list.length + '일:', list.map((h) => h.date.slice(5) + ' ' + h.name).join(', '));
}
const data = { generatedAt: new Date().toISOString().slice(0, 10), source: '한국천문연구원 특일정보(공공데이터포털)', years: out };
let same = false;
try { same = JSON.stringify(JSON.parse(fs.readFileSync(OUT, 'utf8')).years) === JSON.stringify(out); } catch (e) {}
if (!same) fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
console.log(same ? '변경 없음' : '저장 ' + OUT);
