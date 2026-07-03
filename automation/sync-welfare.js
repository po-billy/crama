// 중앙부처 복지서비스 API(XML) → site/src/data/welfare-services.json (복지 서비스 모아보기 /welfare)
// 소스: apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001 (460건, 복지로/보건복지부)
// 실행: cd automation && node sync-welfare.js   (CI는 Secret DATA_GO_KR_KEY 주입)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'welfare-services.json');
const KEY = process.env.DATA_GO_KR_KEY;
const ENDPOINT = 'https://apis.data.go.kr/B554287/NationalWelfareInformationsV001/NationalWelfarelistV001';

const decode = (s) => String(s == null ? '' : s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const clean = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const c = clean(s); return c.length > n ? c.slice(0, n).trim() + '…' : c; };
const firstOf = (s) => { const parts = [...new Set(clean(s).split(/[,·、]/).map((x) => x.trim()).filter(Boolean))]; return parts[0] || ''; };
const tag = (block, name) => { const m = block.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')); return m ? m[1] : ''; };

async function fetchAll() {
  const url = `${ENDPOINT}?serviceKey=${KEY}&callTp=L&pageNo=1&numOfRows=500&srchKeyCode=003`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('⚠ HTTP', res.status); return []; }
  const xml = await res.text();
  if (!/SUCCESS/.test(xml)) { console.warn('⚠ 응답 이상:', xml.slice(0, 200)); return []; }
  return xml.match(/<servList>[\s\S]*?<\/servList>/g) || [];
}

function normalize(block) {
  const rawUrl = clean(tag(block, 'servDtlLink'));
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl : '';
  return {
    id: clean(tag(block, 'servId')),
    name: clean(tag(block, 'servNm')),
    theme: firstOf(tag(block, 'intrsThemaArray')),   // 관심주제(이름)
    summary: trunc(tag(block, 'servDgst'), 180),
    detail: trunc(tag(block, 'servDgst'), 1000),   // 상세 페이지 본문용(전문에 가깝게)
    ministry: clean(tag(block, 'jurMnofNm')),          // 소관부처
    cycle: clean(tag(block, 'sprtCycNm')),             // 지원주기(1회성/매월…)
    ptype: clean(tag(block, 'srvPvsnNm')),             // 제공유형(현금/현물/서비스…)
    online: clean(tag(block, 'onapPsbltYn')) === 'Y',  // 온라인신청 가능
    tel: clean(tag(block, 'rprsCtadr')),
    url,
  };
}

// ── 상세조회 증분 보강 — 일 100회 제한이라 실행당 BUDGET건씩, 기존 보강분은 유지(6일 내 전량) ──
const DETAIL_BUDGET = Number(process.env.WELFARE_DETAIL_BUDGET || 80);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRich(servId) {
  const url = `${ENDPOINT.replace('NationalWelfarelistV001', 'NationalWelfaredetailedV001')}?serviceKey=${KEY}&callTp=D&servId=${servId}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const xml = await res.text();
  const pick = (n, cap) => trunc(tag(xml, n), cap);
  const rich = {
    outline: pick('wlfareInfoOutlCn', 600),
    target: pick('tgtrDtlCn', 900),
    criteria: pick('slctCritCn', 1200),
    benefit: pick('alwServCn', 1200),
  };
  return (rich.target || rich.criteria || rich.benefit || rich.outline) ? rich : null;
}

async function main() {
  if (!KEY) { console.warn('⚠ DATA_GO_KR_KEY 없음 — 복지 스킵(기존 데이터 유지)'); return; }
  const blocks = await fetchAll();
  const seen = new Set();
  const services = blocks
    .map(normalize)
    .filter((s) => s.id && s.name && !seen.has(s.id) && seen.add(s.id));

  // 이전 보강분(rich) 이어받기
  let prevRich = {};
  try {
    const prev = JSON.parse(await fs.readFile(OUT, 'utf8'));
    (prev.services || []).forEach((s) => { if (s.rich) prevRich[s.id] = s.rich; });
  } catch {}
  services.forEach((s) => { if (prevRich[s.id]) s.rich = prevRich[s.id]; });

  // 미보강분에서 BUDGET건 상세조회
  const pending = services.filter((s) => !s.rich);
  let enriched = 0;
  for (const s of pending.slice(0, DETAIL_BUDGET)) {
    try {
      const r = await fetchRich(s.id);
      if (r) { s.rich = r; enriched++; }
    } catch {}
    await sleep(120);
  }
  console.log(`상세 보강: 이번 ${enriched}건 / 누적 ${services.filter((s) => s.rich).length}/${services.length} (남은 ${services.filter((s) => !s.rich).length}건은 다음 크론에서)`);

  const byTheme = {};
  services.forEach((s) => { if (s.theme) byTheme[s.theme] = (byTheme[s.theme] || 0) + 1; });

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: services.length,
    online: services.filter((s) => s.online).length,
    themes: Object.keys(byTheme).sort((a, b) => byTheme[b] - byTheme[a]),
    services,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  // 내용(generatedAt 제외)이 동일하면 파일 유지 — 날짜만 바뀐 무의미 일일 커밋 방지
  try {
    const prev = JSON.parse(await fs.readFile(OUT, 'utf8'));
    const a = { ...prev }; delete a.generatedAt;
    const b = { ...out }; delete b.generatedAt;
    if (JSON.stringify(a) === JSON.stringify(b)) { console.log('내용 변경 없음 — 파일 유지(커밋 스킵)'); return; }
  } catch {}
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  console.log(`\n중앙부처 복지서비스 ${services.length}건(온라인신청 ${out.online}건) → ${OUT}`);
  console.log('관심주제:', JSON.stringify(byTheme));
  console.log('\n── 예시 (앞 6건) ──');
  services.slice(0, 6).forEach((s) => console.log(`  [${s.theme}] ${s.name.slice(0, 40)} · ${s.ministry}${s.online ? ' 🖥' : ''}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
