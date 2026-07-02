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
    ministry: clean(tag(block, 'jurMnofNm')),          // 소관부처
    cycle: clean(tag(block, 'sprtCycNm')),             // 지원주기(1회성/매월…)
    ptype: clean(tag(block, 'srvPvsnNm')),             // 제공유형(현금/현물/서비스…)
    online: clean(tag(block, 'onapPsbltYn')) === 'Y',  // 온라인신청 가능
    tel: clean(tag(block, 'rprsCtadr')),
    url,
  };
}

async function main() {
  if (!KEY) { console.warn('⚠ DATA_GO_KR_KEY 없음 — 복지 스킵(기존 데이터 유지)'); return; }
  const blocks = await fetchAll();
  const seen = new Set();
  const services = blocks
    .map(normalize)
    .filter((s) => s.id && s.name && !seen.has(s.id) && seen.add(s.id));

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
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  console.log(`\n중앙부처 복지서비스 ${services.length}건(온라인신청 ${out.online}건) → ${OUT}`);
  console.log('관심주제:', JSON.stringify(byTheme));
  console.log('\n── 예시 (앞 6건) ──');
  services.slice(0, 6).forEach((s) => console.log(`  [${s.theme}] ${s.name.slice(0, 40)} · ${s.ministry}${s.online ? ' 🖥' : ''}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
