// 온통청년 정책 API → site/src/data/youth-policies.json (청년 정책 모아보기 /youth)
// 소스: https://www.youthcenter.go.kr/go/ythip/getPlcy (2600+건). apiKeyNm = ONTONG_YOUTH_KEY
// 실행: cd automation && node sync-youth.js   (CI는 GitHub Secret ONTONG_YOUTH_KEY 주입)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 로컬은 .env 로드(있으면), CI/GitHub Actions는 env가 주입되므로 dotenv 미설치여도 동작
try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'youth-policies.json');
const KEY = process.env.ONTONG_YOUTH_KEY;
const SIZE = 100;
const PAGES = 5; // 100 × 5 = 최대 500건 수집 → 정규화/중복제거 후 저장

const clean = (s) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const c = clean(s); return c.length > n ? c.slice(0, n).trim() + '…' : c; };
// lclsfNm/mclsfNm은 같은 값이 콤마로 중복되어 오는 경우가 있어 첫 고유값만 취함
const firstOf = (s) => { const parts = [...new Set(clean(s).split(',').map((x) => x.trim()).filter(Boolean))]; return parts[0] || ''; };

async function fetchPage(pageNum) {
  const url = `https://www.youthcenter.go.kr/go/ythip/getPlcy?apiKeyNm=${KEY}&pageNum=${pageNum}&pageSize=${SIZE}&rtnType=json`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('⚠ HTTP', res.status, '(page', pageNum + ')'); return []; }
  const j = await res.json().catch(() => ({}));
  return j?.result?.youthPolicyList || [];
}

function normalize(p) {
  const rawUrl = p.aplyUrlAddr || p.refUrlAddr1 || p.refUrlAddr2 || '';
  const url = /^https?:\/\//.test(rawUrl) ? rawUrl.trim() : '';
  return {
    id: p.plcyNo,
    name: clean(p.plcyNm),
    cat: firstOf(p.lclsfNm),      // 대분류: 일자리/주거/교육･직업훈련/금융･복지･문화/참여･기반
    sub: firstOf(p.mclsfNm),      // 중분류
    summary: trunc(p.plcyExplnCn, 150),
    support: trunc(p.plcySprtCn, 220),
    keywords: clean(p.plcyKywdNm),
    org: clean(p.sprvsnInstCdNm),
    url,
    minAge: String(p.sprtTrgtMinAge || '').trim(),
    maxAge: String(p.sprtTrgtMaxAge || '').trim(),
    ageLimit: p.sprtTrgtAgeLmtYn === 'Y',
    apply: clean(p.aplyYmd),      // 신청기간(있으면)
  };
}

async function main() {
  if (!KEY) { console.warn('⚠ ONTONG_YOUTH_KEY 없음 — 청년정책 스킵(기존 데이터 유지). automation/.env 또는 GitHub Secret에 추가'); return; }
  let raw = [];
  for (let i = 1; i <= PAGES; i++) raw = raw.concat(await fetchPage(i));

  const seen = new Set();
  const policies = raw
    .map(normalize)
    .filter((p) => p.id && p.name && p.cat && !seen.has(p.id) && seen.add(p.id));

  const byCat = {};
  policies.forEach((p) => (byCat[p.cat] = (byCat[p.cat] || 0) + 1));

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: policies.length,
    withUrl: policies.filter((p) => p.url).length,
    categories: Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]),
    policies,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  console.log(`\n청년정책 ${policies.length}건(신청링크 ${out.withUrl}건) → ${OUT}`);
  console.log('카테고리:', JSON.stringify(byCat));
  console.log('\n── 예시 (앞 6건) ──');
  policies.slice(0, 6).forEach((p) => console.log(`  [${p.cat}/${p.sub}] ${p.name.slice(0, 46)} (${p.minAge}~${p.maxAge}세)${p.url ? ' 🔗' : ''}`));
}
main().catch((e) => { console.error(e); process.exit(1); });
