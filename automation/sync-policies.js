// 공공 API → 정책 캘린더 이벤트 정규화 → site/src/data/policy-events.json
// 소스: 청약홈(주거·날짜O), 기업마당(자영업/창업·날짜O). 온통청년은 YOUTH_API_KEY 발급 후 fetchYouth() 추가.
// 복지서비스(4600건·마감없음)는 캘린더가 아니라 혜택찾기(Supabase) 단계에서 처리.
// 실행: cd automation && node sync-policies.js
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 로컬은 .env 로드(있으면), CI/GitHub Actions는 env가 주입되므로 dotenv 미설치여도 동작
try { await import('dotenv/config'); } catch {}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'site', 'src', 'data', 'policy-events.json');
const DATA_GO_KR = process.env.DATA_GO_KR_KEY;
const BIZINFO = process.env.BIZINFO_KEY;
const YEAR = 2026;
const TODAY = new Date();

// 공급위치/해시태그 → region 태그 (캘린더 필터와 동일 체계)
const REGION = { 서울: 'seoul', 경기: 'gyeonggi', 인천: 'incheon', 부산: 'busan', 대구: 'daegu', 광주: 'gwangju', 대전: 'daejeon', 울산: 'ulsan', 세종: 'sejong', 강원: 'gangwon', 충북: 'chungbuk', 충남: 'chungnam', 전북: 'jeonbuk', 전남: 'jeonnam', 경북: 'gyeongbuk', 경남: 'gyeongnam', 제주: 'jeju' };
const regionOf = (s = '') => { for (const k in REGION) if (s.includes(k)) return REGION[k]; return 'all'; };
const notPast = (y, m, d) => (new Date(y, m - 1, d) - TODAY) / 86400000 >= -1;

// ── 청약홈 APT 분양정보 → '청약접수 시작' 이벤트 ──
async function fetchApply() {
  if (!DATA_GO_KR) { console.warn('⚠ DATA_GO_KR_KEY 없음 — 청약 스킵'); return []; }
  const base = 'https://api.odcloud.kr/api/ApplyhomeInfoDetailSvc/v1/getAPTLttotPblancDetail';
  const cond = encodeURIComponent('cond[RCRIT_PBLANC_DE::GTE]'); // 최근 공고만(모집공고일 5월 이후)
  const url = `${base}?page=1&perPage=500&${cond}=${YEAR}-05-01&serviceKey=${DATA_GO_KR}`;
  const res = await fetch(url);
  if (!res.ok) { console.warn('⚠ 청약 HTTP', res.status); return []; }
  const { data = [] } = await res.json();
  const out = [];
  for (const it of data) {
    const bgn = it.RCEPT_BGNDE; // 청약접수 시작일 'YYYY-MM-DD'
    if (!bgn) continue;
    const [y, m, d] = bgn.split('-').map(Number);
    if (y !== YEAR || !notPast(y, m, d)) continue;
    out.push({
      month: m, day: d,
      title: `${it.HOUSE_NM} 청약접수`,
      cat: 'housing',
      desc: `${it.HSSPLY_ADRES || ''} · 접수 ${it.RCEPT_BGNDE}~${it.RCEPT_ENDDE || ''}`.trim(),
      url: it.PBLANC_URL || it.HMPG_ADRES || '',
      target: 'all', field: 'housing', ageGroup: 'all',
      region: regionOf(it.HSSPLY_ADRES),
      source: 'applyhome', id: `apt-${it.PBLANC_NO}`,
    });
  }
  return out;
}

// ── 기업마당 창업 지원사업 → '신청 마감' 이벤트 (자영업 타겟) ──
async function fetchBizinfo() {
  if (!BIZINFO) { console.warn('⚠ BIZINFO_KEY 없음 — 기업마당 스킵'); return []; }
  const url = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${BIZINFO}&dataType=json&searchCnt=0&searchLclasId=06`; // 06=창업
  const res = await fetch(url);
  if (!res.ok) { console.warn('⚠ 기업마당 HTTP', res.status); return []; }
  const { jsonArray = [] } = await res.json();
  const out = [];
  for (const it of jsonArray) {
    const mch = (it.reqstBeginEndDe || '').match(/(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{4})-(\d{2})-(\d{2})/);
    if (!mch) continue; // 상시/날짜없음 제외
    const y = +mch[4], m = +mch[5], d = +mch[6]; // 종료(마감)일
    if (y !== YEAR || !notPast(y, m, d)) continue;
    out.push({
      month: m, day: d,
      title: it.pblancNm,
      cat: 'benefit',
      desc: `${it.jrsdInsttNm || ''} · ${it.trgetNm || '중소기업·소상공인'} · 마감 ${mch[4]}-${mch[5]}-${mch[6]}`.trim(),
      url: it.pblancUrl || '',
      target: 'self', field: 'job', ageGroup: 'all', region: 'all',
      source: 'bizinfo', id: `biz-${it.pblancId}`,
    });
  }
  return out;
}

async function main() {
  // 캘린더 = 청약(주거·소비자 친화·날짜 명확)만. 기업마당 창업 공고는 대부분 B2B/기관 공모라
  // 소비자 캘린더엔 노이즈 → 보류(추후 자영업/혜택찾기 트랙에서 선별 사용). fetchBizinfo()는 남겨둠.
  const events = (await fetchApply()).sort((a, b) => a.month - b.month || a.day - b.day);
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(events, null, 2) + '\n');

  const byMonth = {};
  events.forEach((e) => (byMonth[e.month] = (byMonth[e.month] || 0) + 1));
  console.log(`\n청약 ${events.length}건 → 캘린더`);
  console.log('월별:', JSON.stringify(byMonth));
  console.log('\n── 예시 (앞 10건) ──');
  events.slice(0, 10).forEach((e) => console.log(`  ${e.month}/${e.day} [${e.cat}/${e.region}] ${e.title.slice(0, 52)}`));
  console.log(`\n→ ${OUT}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
