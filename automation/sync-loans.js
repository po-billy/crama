// 금감원 finlife → site/src/data/loans.json (대출 금리 비교 /loans: 주담대·전세자금·신용)
// 실행: cd automation && node sync-loans.js   (CI는 Secret FINLIFE_KEY)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'loans.json');
const KEY = process.env.FINLIFE_KEY;
const BASE = 'https://finlife.fss.or.kr/finlifeapi';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const trunc = (s, n) => { const c = clean(s); return c.length > n ? c.slice(0, n).trim() + '…' : c; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchKind(kind) {
  let page = 1, maxPage = 1;
  const base = [], opts = [];
  let dclsMonth = '';
  while (page <= maxPage) {
    const res = await fetch(`${BASE}/${kind}.json?auth=${KEY}&topFinGrpNo=020000&pageNo=${page}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) { console.warn(`⚠ ${kind} HTTP ${res.status}`); break; }
    const r = (await res.json().catch(() => ({}))).result || {};
    if (r.err_cd !== '000') { console.warn(`⚠ ${kind} err ${r.err_cd} ${r.err_msg}`); break; }
    base.push(...(r.baseList || []));
    opts.push(...(r.optionList || []));
    maxPage = Number(r.max_page_no) || 1;
    if (!dclsMonth && base[0]) dclsMonth = base[0].dcls_month || '';
    page++;
    await sleep(150);
  }
  return { base, opts, dclsMonth };
}

function buildSecured({ base, opts }) {
  // 주담대·전세: 옵션(금리유형×상환방식×담보) → 상품 단위로 병합, min~max·avg 요약
  const byKey = {};
  for (const b of base) {
    const id = `${b.fin_co_no}-${b.fin_prdt_cd}`;
    byKey[id] = {
      id, bank: clean(b.kor_co_nm), name: clean(b.fin_prdt_nm),
      joinWay: clean(b.join_way), limit: trunc(b.loan_lmt, 120),
      expense: trunc(b.loan_inci_expn, 200), earlyFee: trunc(b.erly_rpay_fee, 200), dlyRate: trunc(b.dly_rate, 120),
      options: [],
    };
  }
  for (const o of opts) {
    const p = byKey[`${o.fin_co_no}-${o.fin_prdt_cd}`];
    if (!p) continue;
    p.options.push({
      mrtg: o.mrtg_type_nm ? clean(o.mrtg_type_nm) : undefined,   // 아파트/아파트외(주담대만)
      rpay: clean(o.rpay_type_nm),                                 // 분할/만기일시
      rateType: clean(o.lend_rate_type_nm),                        // 고정/변동
      min: o.lend_rate_min == null ? null : Number(o.lend_rate_min),
      max: o.lend_rate_max == null ? null : Number(o.lend_rate_max),
      avg: o.lend_rate_avg == null ? null : Number(o.lend_rate_avg),
    });
  }
  return Object.values(byKey).filter((p) => p.options.length).map((p) => {
    const mins = p.options.map((o) => o.min).filter((v) => v != null);
    const maxs = p.options.map((o) => o.max).filter((v) => v != null);
    const avgs = p.options.map((o) => o.avg).filter((v) => v != null);
    return { ...p, min: mins.length ? Math.min(...mins) : null, max: maxs.length ? Math.max(...maxs) : null, avg: avgs.length ? Math.min(...avgs) : null };
  });
}

function buildCredit({ base, opts }) {
  const byKey = {};
  for (const b of base) {
    const id = `${b.fin_co_no}-${b.fin_prdt_cd}`;
    byKey[id] = { id, bank: clean(b.kor_co_nm), name: clean(b.fin_prdt_nm), cb: clean(b.cb_name), joinWay: clean(b.join_way), options: [] };
  }
  for (const o of opts) {
    const p = byKey[`${o.fin_co_no}-${o.fin_prdt_cd}`];
    if (!p) continue;
    p.options.push({
      prdt: clean(o.crdt_prdt_type_nm),        // 일반신용/마이너스한도/장기카드
      rateType: clean(o.crdt_lend_rate_type_nm),
      g1: o.crdt_grad_1 == null ? null : Number(o.crdt_grad_1),    // 900점 초과
      g4: o.crdt_grad_4 == null ? null : Number(o.crdt_grad_4),    // 801~900
      avg: o.crdt_grad_avg == null ? null : Number(o.crdt_grad_avg),
    });
  }
  return Object.values(byKey).filter((p) => p.options.length).map((p) => {
    const avgs = p.options.map((o) => o.avg).filter((v) => v != null);
    const g1s = p.options.map((o) => o.g1).filter((v) => v != null);
    return { ...p, avg: avgs.length ? Math.min(...avgs) : null, best: g1s.length ? Math.min(...g1s) : null };
  });
}

async function main() {
  if (!KEY) { console.warn('⚠ FINLIFE_KEY 없음 — 대출 스킵(기존 유지)'); return; }
  const m = await fetchKind('mortgageLoanProductsSearch');
  const r = await fetchKind('rentHouseLoanProductsSearch');
  const c = await fetchKind('creditLoanProductsSearch');
  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    dclsMonth: m.dclsMonth || r.dclsMonth || c.dclsMonth,
    mortgages: buildSecured(m),
    rents: buildSecured(r),
    credits: buildCredit(c),
  };
  out.counts = { mortgages: out.mortgages.length, rents: out.rents.length, credits: out.credits.length };
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  try {
    const prev = JSON.parse(await fs.readFile(OUT, 'utf8'));
    const a = { ...prev }; delete a.generatedAt;
    const b = { ...out }; delete b.generatedAt;
    if (JSON.stringify(a) === JSON.stringify(b)) { console.log('내용 변경 없음 — 파일 유지(커밋 스킵)'); return; }
  } catch {}
  await fs.writeFile(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`주담대 ${out.counts.mortgages} · 전세 ${out.counts.rents} · 신용 ${out.counts.credits} → ${OUT} (공시월 ${out.dclsMonth})`);
}
main().catch((e) => { console.error(e); process.exit(1); });
