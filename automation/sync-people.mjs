// 인물 데이터 동기화 — 위키데이터(사실 정보) + 위키미디어 코먼스(자유 이용 사진) → site/src/data/people.json
// 실행: node automation/sync-people.mjs   (API 키 불필요, 무료)
//
// 원칙
//  · 공개된 사실 정보만: 이름, 생년월일, 직업. 사생활·평가 정보는 넣지 않는다.
//  · 생년월일이 '일' 단위로 정확하고 값이 하나뿐인 인물만(데이터가 엇갈리면 제외).
//  · 고인·미성년자는 제외.
//  · 사진은 코먼스에서 자유 이용 허락(CC BY / CC BY-SA / CC0 / 퍼블릭 도메인)이 확인된 것만, 저작자·라이선스를 함께 저장.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'site');
const OUT = path.join(SITE, 'src/data/people.json');
const IMG_DIR = path.join(SITE, 'public/img/people');
const sharp = createRequire(path.join(SITE, 'package.json'))('sharp');
const UA = 'people-data-sync/1.0 (static site build script)';
const LIMIT = Number(process.env.PEOPLE_LIMIT || 800);
const MIN_LINKS = Number(process.env.PEOPLE_MIN_LINKS || 6);
const THIS_YEAR = new Date().getFullYear();

// 직업 라벨(한국어) → 화면 표기. 앞에 있을수록 우선.
const JOBS = [
  [/가수|싱어송라이터|래퍼|아이돌|음악가|작곡가/, '가수'],
  [/(?<!희극 ?)배우|성우/, '배우'],
  [/희극|코미디언|개그/, '코미디언'],
  [/방송인|아나운서|진행자|사회자/, '방송인'],
  [/축구/, '축구 선수'], [/야구/, '야구 선수'], [/농구/, '농구 선수'], [/배구/, '배구 선수'], [/골프/, '골프 선수'],
  [/피겨|빙상|스케이트|쇼트트랙/, '빙상 선수'], [/수영/, '수영 선수'], [/양궁/, '양궁 선수'], [/배드민턴/, '배드민턴 선수'],
  [/e스포츠|프로게이머/, '프로게이머'], [/선수/, '운동선수'],
];
// 이 직업이 붙은 인물은 다루지 않는다(연예·스포츠 인물만)
const BLOCK = /정치인|국회의원|대통령|군인|법조인|판사|검사|변호사|기업인|사업가|종교|목사|승려|범죄|외교관|공무원|교수|의사/;

async function sparql(query) {
  const res = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(query), { headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA } });
  if (!res.ok) throw new Error('SPARQL ' + res.status + ' ' + (await res.text()).slice(0, 200));
  return (await res.json()).results.bindings;
}

const Q = `SELECT ?p ?koName ?enName ?b ?prec ?img ?links ?title ?dead ?occName WHERE {
  ?p wdt:P31 wd:Q5; wdt:P27 wd:Q884; wikibase:sitelinks ?links. FILTER(?links >= ${MIN_LINKS})
  ?p p:P569/psv:P569 ?bn. ?bn wikibase:timeValue ?b; wikibase:timePrecision ?prec.
  ?a schema:about ?p; schema:isPartOf <https://ko.wikipedia.org/>; schema:name ?title.
  ?p wdt:P106 ?o. ?o rdfs:label ?occName. FILTER(lang(?occName) = "ko")
  OPTIONAL { ?p rdfs:label ?koName FILTER(lang(?koName) = "ko") }
  OPTIONAL { ?p rdfs:label ?enName FILTER(lang(?enName) = "en") }
  OPTIONAL { ?p wdt:P18 ?img }
  OPTIONAL { ?p wdt:P570 ?dead }
}`;

console.log('위키데이터 조회 중…');
const rows = await sparql(Q);
const map = new Map();
for (const r of rows) {
  const id = r.p.value.split('/').pop();
  let e = map.get(id);
  if (!e) map.set(id, (e = { id, births: new Set(), jobs: new Set(), precOk: true }));
  // 표기 이름은 한국어 위키백과 문서 제목(괄호 구분어 제외)을 우선 — 라벨은 '제니 김'처럼 어색한 경우가 있다
  e.name = r.title.value.replace(/\s*\(.*\)$/, '') || r.koName?.value;
  e.title = r.title.value;
  e.en = e.en || r.enName?.value || '';
  e.links = Number(r.links.value);
  e.births.add(r.b.value.slice(0, 10));
  if (Number(r.prec.value) < 11) e.precOk = false;
  if (r.img && !e.img) e.img = decodeURIComponent(r.img.value.split('/Special:FilePath/')[1] || '');
  if (r.dead) e.dead = true;
  e.jobs.add(r.occName.value);
}
const drop = { 고인: 0, 생년월일불명확: 0, 미성년: 0, 직업제외: 0, 이름이상: 0 };
let list = [];
for (const e of map.values()) {
  if (e.dead) { drop.고인++; continue; }
  if (!e.precOk || e.births.size !== 1) { drop.생년월일불명확++; continue; }
  const birth = [...e.births][0];
  const year = Number(birth.slice(0, 4));
  if (!(year >= 1930) || THIS_YEAR - year < 20) { drop.미성년++; continue; }
  const jobs = [...e.jobs];
  if (jobs.some((j) => BLOCK.test(j))) { drop.직업제외++; continue; }
  // 대표 직업 하나만 적는다. 위키데이터 직업 라벨은 잡음이 많아(예: 코미디언에게 배우·가수가 함께 붙음) 여러 개를 나열하면 틀린 표기가 생긴다.
  //  1) 코미디언 라벨이 있으면 코미디언  2) 운동 종목이 있으면 그 종목  3) 나머지는 라벨이 가장 많이 붙은 쪽(동률이면 가수 > 배우 > 방송인)
  const score = new Map();
  for (const [re, label] of JOBS) { const n = jobs.filter((x) => re.test(x)).length; if (n) score.set(label, (score.get(label) || 0) + n); }
  let primary = null;
  if (score.has('코미디언')) primary = '코미디언';
  else primary = [...score.keys()].find((l) => /선수|프로게이머/.test(l) && l !== '운동선수') || null;
  if (!primary) primary = [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const hits = primary ? [primary] : [];
  if (!hits.length) { drop.직업제외++; continue; }
  const sport = /선수|프로게이머/.test(hits[0]);
  if (!/^[가-힣A-Za-z0-9 .·\-]{1,20}$/.test(e.name)) { drop.이름이상++; continue; }
  list.push({ id: e.id, name: e.name.replace(/\s*\(.*\)$/, ''), en: e.en, birth, job: hits.join('·'), jobs: hits, sport, links: e.links, file: e.img || '', title: e.title });
}
// 순위 기준: 한국어 위키백과 최근 60일 조회수(사람이 본 횟수). 언어판 수만으로 뽑으면 해외 인지도가 높은 인물만 남고
// 국내에서 많이 찾는 인물(예능인 등)이 빠진다. 위키백과 API(prop=pageviews)는 무료·키 불필요이고 한 번에 50명씩 묻는다.
// 요청이 잦으면 429(요청 과다)로 한동안 막히므로 천천히 보내고, 막히면 기다렸다가 이어서 한다.
{
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const byTitle = new Map(list.map((p) => [p.title, p]));
  const ask = async (params) => {
    const url = 'https://ko.wikipedia.org/w/api.php?' + new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', prop: 'pageviews', pvipdays: '60', ...params });
    for (let t = 0; t < 40; t++) {
      let res;
      try { res = await fetch(url, { headers: { 'User-Agent': UA } }); } catch (e) { console.log('   네트워크 오류 — 다시 시도'); await sleep(30000); continue; }
      if (res.status === 429 || res.status >= 500) { if (t % 5 === 0) console.log('   요청 제한(' + res.status + ') — 기다리는 중…'); await sleep(90000); continue; }
      if (!res.ok) throw new Error('조회수 API ' + res.status);
      return res.json();
    }
    throw new Error('조회수 API가 계속 막혀 있음 — 한 시간쯤 뒤에 다시 실행하세요');
  };
  // 받은 조회수는 임시 폴더에 저장해 두고(3일간 유효) 중간에 끊겨도 다음 실행에서 이어받는다
  const CACHE = path.join(os.tmpdir(), 'people-views-cache.json');
  let cache = {};
  try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (Date.now() - c.at < 3 * 86400000) cache = c.views || {}; } catch (e) {}
  for (const p of list) if (p.title in cache) p.views = cache[p.title];
  const titles = [...byTitle.keys()].filter((t) => !(t in cache));
  console.log('조회수 확인', list.length, '명 중 새로 받을', titles.length, '명…');
  for (let i = 0; i < titles.length; i += 50) {
    const chunk = titles.slice(i, i + 50), sum = new Map();
    let cont = {};
    for (let guard = 0; guard < 20; guard++) {
      const j = await ask({ titles: chunk.join('|'), ...cont });
      const back = new Map((j.query?.normalized || []).map((n) => [n.to, n.from]));
      for (const pg of j.query?.pages || []) {
        const key = back.get(pg.title) || pg.title;
        const v = Object.values(pg.pageviews || {}).reduce((n, x) => n + (x || 0), 0);
        sum.set(key, (sum.get(key) || 0) + v);
      }
      if (!j.continue) break;
      cont = j.continue; await sleep(700);
    }
    for (const t of chunk) { byTitle.get(t).views = sum.get(t) || 0; cache[t] = byTitle.get(t).views; }
    fs.writeFileSync(CACHE, JSON.stringify({ at: Date.now(), views: cache }));
    if ((i / 50) % 10 === 0) console.log('  ', Math.min(i + 50, titles.length), '/', titles.length);
    await sleep(1200);
  }
  const zero = list.filter((p) => !p.views).length;
  if (zero > list.length / 3) throw new Error('조회수를 받지 못한 인물이 너무 많음: ' + zero);
  console.log('조회수 확인 끝 | 0회', zero, '명');
}
list.sort((a, b) => b.views - a.views || b.links - a.links || a.name.localeCompare(b.name, 'ko'));
// 위키백과 언어판 수 기준이라 축구 선수가 과하게 많아진다 → 운동선수는 전체의 1/4 까지만
{ const cap = Math.floor(LIMIT / 4); let sports = 0; list = list.filter((p) => (p.sport ? ++sports <= cap : true)).slice(0, LIMIT); list.forEach((p) => delete p.sport); }
console.log('후보', map.size, '명 →', list.length, '명 선정 | 제외', JSON.stringify(drop));

// 주소용 슬러그: 영문 이름 기반, 겹치면 출생연도를 붙인다
const used = new Set();
for (const p of list) {
  let s = (p.en || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!s) s = p.id.toLowerCase();
  if (used.has(s)) s = s + '-' + p.birth.slice(0, 4);
  if (used.has(s)) s = s + '-' + p.id.toLowerCase();
  used.add(s); p.slug = s;
}

// 코먼스 사진 라이선스 확인(50개씩)
const strip = (h) => String(h || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();
const FREE = /^(cc[ -]by|cc0|public domain|pd|kogl type 1|cc-by)/i;
const withFile = list.filter((p) => p.file);
const meta = new Map();
for (let i = 0; i < withFile.length; i += 40) {
  const titles = withFile.slice(i, i + 40).map((p) => 'File:' + p.file).join('|');
  const url = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&iiurlwidth=320&titles=' + encodeURIComponent(titles);
  const j = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
  const norm = new Map((j.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const pg of Object.values(j.query?.pages || {})) {
    const ii = pg.imageinfo?.[0]; if (!ii) continue;
    const m = ii.extmetadata || {};
    const from = (norm.get(pg.title) || pg.title).replace(/^File:/, '');
    meta.set(from, { thumb: ii.thumburl, page: ii.descriptionurl, license: strip(m.LicenseShortName?.value), artist: strip(m.Artist?.value).slice(0, 80) });
    meta.set(pg.title.replace(/^File:/, ''), meta.get(from));
  }
}

fs.mkdirSync(IMG_DIR, { recursive: true });
let photos = 0, skippedLicense = 0;
for (const p of list) {
  const m = p.file && (meta.get(p.file) || meta.get(p.file.replace(/_/g, ' ')));
  delete p.title;
  const file = p.file; delete p.file;
  if (!m || !m.thumb) continue;
  if (!FREE.test(m.license)) { skippedLicense++; continue; }
  const dest = path.join(IMG_DIR, p.slug + '.webp');
  try {
    if (!fs.existsSync(dest)) {
      const res = await fetch(m.thumb, { headers: { 'User-Agent': UA } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf).resize(240, 240, { fit: 'cover', position: 'attention' }).webp({ quality: 80 }).toFile(dest);
      await new Promise((r) => setTimeout(r, 120));
    }
    p.img = `/img/people/${p.slug}.webp`;
    p.credit = { artist: m.artist || '저작자 미상', license: m.license, url: m.page };
    photos++;
  } catch (e) { /* 사진 실패는 건너뛴다(이름 첫 글자 아이콘으로 대체) */ }
  void file;
}

const out = { generatedAt: new Date().toISOString().slice(0, 10), source: '위키데이터(CC0) · 위키미디어 코먼스', count: list.length, people: list };
// 내용이 같으면 파일을 건드리지 않는다(무의미 커밋 방지) — generatedAt 제외 비교
let same = false;
try { const prev = JSON.parse(fs.readFileSync(OUT, 'utf8')); same = JSON.stringify(prev.people) === JSON.stringify(out.people); } catch (e) {}
if (!same) fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(same ? '변경 없음' : '저장 ' + OUT, '| 사진', photos, '명 | 라이선스 미확인으로 제외', skippedLicense);
console.log('상위 15:', list.slice(0, 15).map((p) => `${p.name}(${p.job},${p.birth.slice(0, 4)})`).join(' '));
const by = {}; list.forEach((p) => (by[p.job] = (by[p.job] || 0) + 1)); console.log('직업별', JSON.stringify(by));
