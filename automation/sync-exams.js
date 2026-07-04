// 큐넷 국가기술자격 시험일정 → site/src/data/exams.json (/exams 자격증 캘린더)
// 소스: openapi.q-net.or.kr InquiryTestInformationNTQSVC (http만 동작, 새벽엔 백엔드 점검으로 99 응답 잦음)
// 실행: cd automation && node sync-exams.js   (CI는 Secret DATA_GO_KR_KEY)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'exams.json');
const KEY = process.env.DATA_GO_KR_KEY;
const BASE = 'http://openapi.q-net.or.kr/api/service/rest/InquiryTestInformationNTQSVC';
const OPS = [
  { op: 'getEList', label: '기사·산업기사' },
  { op: 'getCList', label: '기능사' },
  { op: 'getMCList', label: '기능장' },
  { op: 'getPEList', label: '기술사' },
  { op: 'getJMList', label: '종목별' },
];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// <item>의 자식 태그를 전부 {tag: text}로 — 스키마 변화에 안전
function parseItems(xml) {
  const items = [];
  const blocks = xml.match(/<item>([\s\S]*?)<\/item>/g) || [];
  for (const b of blocks) {
    const o = {};
    const tags = b.match(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/g) || [];
    for (const t of tags) {
      const m = t.match(/<([a-zA-Z0-9_]+)>([\s\S]*?)<\/\1>/);
      if (m) o[m[1]] = m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
    }
    if (Object.keys(o).length) items.push(o);
  }
  return items;
}

async function fetchOp(op) {
  for (let t = 1; t <= 3; t++) {
    try {
      const res = await fetch(`${BASE}/${op}?serviceKey=${KEY}&numOfRows=500&pageNo=1`);
      const xml = await res.text();
      if (/resultCode>00</.test(xml) || /<item>/.test(xml)) return parseItems(xml);
      console.warn(`⚠ ${op} try${t}:`, (xml.match(/resultMsg>([^<]*)/) || [])[1] || xml.slice(0, 80));
    } catch (e) { console.warn(`⚠ ${op} try${t}:`, e.message); }
    await sleep(2000);
  }
  return null; // 실패 — 기존 데이터 유지
}

async function main() {
  if (!KEY) { console.warn('⚠ DATA_GO_KR_KEY 없음 — 스킵'); return; }
  let prev = {};
  try { prev = JSON.parse(await fs.readFile(OUT, 'utf8')); } catch {}
  const out = { generatedAt: new Date().toISOString().slice(0, 10) };
  let okCnt = 0;
  for (const { op, label } of OPS) {
    const items = await fetchOp(op);
    if (items && items.length) { out[op] = items; okCnt++; console.log(`${label}(${op}): ${items.length}건`); }
    else { out[op] = prev[op] || []; console.log(`${label}(${op}): 실패 → 기존 ${out[op].length}건 유지`); }
    await sleep(300);
  }
  if (!okCnt && !Object.keys(prev).length) { console.log('전부 실패 + 기존 없음 — 파일 미생성'); return; }
  // 내용 동일 시 유지
  try {
    const a = { ...prev }; delete a.generatedAt;
    const b = { ...out }; delete b.generatedAt;
    if (JSON.stringify(a) === JSON.stringify(b)) { console.log('내용 변경 없음 — 파일 유지'); return; }
  } catch {}
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`→ ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
