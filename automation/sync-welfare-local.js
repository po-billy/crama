// 지자체 복지서비스 API(XML) → site/public/data/welfare-local.json (온디맨드 '우리 지역 복지')
// 소스: apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist (4600건)
// public/ 로 출력해 정적 자산으로 서빙 → /welfare에서 지역 선택 시 fetch(온디맨드, 초기 페이지 경량 유지)
// 실행: cd automation && node sync-welfare-local.js   (CI는 Secret DATA_GO_KR_KEY 주입)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'public', 'data', 'welfare-local.json');
const KEY = process.env.DATA_GO_KR_KEY;
const ENDPOINT = 'https://apis.data.go.kr/B554287/LocalGovernmentWelfareInformations/LcgvWelfarelist';
const SIZE = 500;
const MAX_PAGES = 12;

const decode = (s) => String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const clean = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const c = clean(s); return c.length > n ? c.slice(0, n).trim() + '…' : c; };
const firstOf = (s) => { const parts = [...new Set(clean(s).split(/[,·、]/).map((x) => x.trim()).filter(Boolean))]; return parts[0] || ''; };
const tag = (block, name) => { const m = block.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')); return m ? m[1] : ''; };

async function fetchPage(pageNo) {
  const url = `${ENDPOINT}?serviceKey=${KEY}&pageNo=${pageNo}&numOfRows=${SIZE}`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('⚠ HTTP', res.status, 'page', pageNo); return []; }
  const xml = await res.text();
  return xml.match(/<servList>[\s\S]*?<\/servList>/g) || [];
}

function normalize(block) {
  const rawUrl = clean(tag(block, 'servDtlLink'));
  return {
    id: clean(tag(block, 'servId')),
    name: clean(tag(block, 'servNm')),
    region: clean(tag(block, 'ctpvNm')),                 // 시도
    sgg: clean(tag(block, 'sggNm')),                     // 시군구
    theme: firstOf(tag(block, 'intrsThemaNmArray')),     // 관심주제
    life: firstOf(tag(block, 'lifeNmArray')),            // 생애주기
    summary: trunc(tag(block, 'servDgst'), 160),
    detail: trunc(tag(block, 'servDgst'), 600),   // 상세 페이지 본문용
    dept: clean(tag(block, 'bizChrDeptNm')),             // 담당부서
    apply: clean(tag(block, 'aplyMtdNm')),               // 신청방법
    url: /^https?:\/\//.test(rawUrl) ? rawUrl : '',
  };
}

async function main() {
  if (!KEY) { console.warn('⚠ DATA_GO_KR_KEY 없음 — 지자체 복지 스킵(기존 유지)'); return; }
  let blocks = [];
  for (let pg = 1; pg <= MAX_PAGES; pg++) {
    const b = await fetchPage(pg);
    blocks = blocks.concat(b);
    if (b.length < SIZE) break; // 마지막 페이지
  }
  const seen = new Set();
  const services = blocks
    .map(normalize)
    .filter((s) => s.id && s.name && s.region && !seen.has(s.id) && seen.add(s.id));

  const byRegion = {};
  services.forEach((s) => { byRegion[s.region] = (byRegion[s.region] || 0) + 1; });

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: services.length,
    regions: Object.keys(byRegion).sort((a, b) => byRegion[b] - byRegion[a]),
    regionCount: byRegion,
    services,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out) + '\n'); // 온디맨드 fetch용 — 최소화(들여쓰기 없음)

  console.log(`\n지자체 복지 ${services.length}건 → ${OUT}`);
  console.log('시도별:', JSON.stringify(byRegion));
}
main().catch((e) => { console.error(e); process.exit(1); });
