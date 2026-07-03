// 금감원 금융상품통합비교공시(finlife) → site/src/data/rates.json (예·적금 금리 비교 /rates)
// 소스: finlifeapi depositProductsSearch / savingProductsSearch (은행 020000 + 저축은행 030300)
// 실행: cd automation && node sync-rates.js   (CI는 Secret FINLIFE_KEY 주입)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'rates.json');
const KEY = process.env.FINLIFE_KEY;
const BASE = 'https://finlife.fss.or.kr/finlifeapi';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'; // finlife는 UA 없으면 응답을 끊음
const GROUPS = [
  { no: '020000', label: '은행' },
  { no: '030300', label: '저축은행' },
];

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const c = clean(s); return c.length > n ? c.slice(0, n).trim() + '…' : c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAll(kind, grpNo) {
  // kind: depositProductsSearch | savingProductsSearch
  let page = 1, maxPage = 1;
  const base = [], opts = [];
  let dclsMonth = '';
  while (page <= maxPage) {
    const url = `${BASE}/${kind}.json?auth=${KEY}&topFinGrpNo=${grpNo}&pageNo=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) { console.warn(`⚠ ${kind}/${grpNo} HTTP ${res.status}`); break; }
    const j = await res.json().catch(() => ({}));
    const r = j.result || {};
    if (r.err_cd !== '000') { console.warn(`⚠ ${kind}/${grpNo} err ${r.err_cd} ${r.err_msg}`); break; }
    base.push(...(r.baseList || []));
    opts.push(...(r.optionList || []));
    maxPage = Number(r.max_page_no) || 1;
    if (!dclsMonth && base[0]) dclsMonth = base[0].dcls_month || '';
    page++;
    await sleep(150);
  }
  return { base, opts, dclsMonth };
}

const DENY_LABEL = { 1: '제한 없음', 2: '서민전용', 3: '일부 제한' };

function buildProducts(base, opts, groupLabel) {
  const byKey = {};
  for (const b of base) {
    const id = `${b.fin_co_no}-${b.fin_prdt_cd}`;
    byKey[id] = {
      id,
      bank: clean(b.kor_co_nm),
      group: groupLabel,
      name: clean(b.fin_prdt_nm),
      joinWay: clean(b.join_way),
      special: trunc(b.spcl_cnd, 500),
      joinDeny: DENY_LABEL[b.join_deny] || '',
      joinMember: trunc(b.join_member, 120),
      etcNote: trunc(b.etc_note, 300),
      maxLimit: b.max_limit == null ? null : Number(b.max_limit),
      options: [],
    };
  }
  for (const o of opts) {
    const id = `${o.fin_co_no}-${o.fin_prdt_cd}`;
    const p = byKey[id];
    if (!p) continue;
    p.options.push({
      trm: Number(o.save_trm),
      type: clean(o.intr_rate_type_nm),           // 단리/복리
      rsrv: o.rsrv_type_nm ? clean(o.rsrv_type_nm) : undefined, // 적금: 정액/자유
      rate: o.intr_rate == null ? null : Number(o.intr_rate),
      rate2: o.intr_rate2 == null ? null : Number(o.intr_rate2),
    });
  }
  return Object.values(byKey).filter((p) => p.options.length);
}

async function main() {
  if (!KEY) { console.warn('⚠ FINLIFE_KEY 없음 — 금리 스킵(기존 데이터 유지)'); return; }
  const deposits = [], savings = [];
  let dclsMonth = '';
  for (const g of GROUPS) {
    const d = await fetchAll('depositProductsSearch', g.no);
    deposits.push(...buildProducts(d.base, d.opts, g.label));
    const s = await fetchAll('savingProductsSearch', g.no);
    savings.push(...buildProducts(s.base, s.opts, g.label));
    dclsMonth = dclsMonth || d.dclsMonth || s.dclsMonth;
  }

  const best = (list, trm) => list.reduce((m, p) => {
    const o = p.options.filter((x) => x.trm === trm && x.rate2 != null);
    const r = o.length ? Math.max(...o.map((x) => x.rate2)) : null;
    return r != null && r > m ? r : m;
  }, 0);

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    dclsMonth,
    counts: { deposits: deposits.length, savings: savings.length },
    best: { deposit12: best(deposits, 12), saving12: best(savings, 12) },
    deposits, savings,
  };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  // 내용(generatedAt 제외) 동일하면 유지 — 무의미 일일 커밋 방지
  try {
    const prev = JSON.parse(await fs.readFile(OUT, 'utf8'));
    const a = { ...prev }; delete a.generatedAt;
    const b = { ...out }; delete b.generatedAt;
    if (JSON.stringify(a) === JSON.stringify(b)) { console.log('내용 변경 없음 — 파일 유지(커밋 스킵)'); return; }
  } catch {}
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');

  console.log(`\n예금 ${deposits.length}개(은행+저축은행) · 적금 ${savings.length}개 → ${OUT}`);
  console.log(`공시월 ${dclsMonth} · 12개월 최고: 예금 ${out.best.deposit12}% / 적금 ${out.best.saving12}%`);
}
main().catch((e) => { console.error(e); process.exit(1); });
