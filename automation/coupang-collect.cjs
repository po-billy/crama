// 쿠팡 파트너스 '이벤트/프로모션 목록' 수집 — 기획전 제목·이미지·변환 링크를 받아 coupang-events.json(이 파일 옆)으로 저장한다.
// 준비: (1) npm i puppeteer-core  (2) 크롬을 --remote-debugging-port=9333 --user-data-dir=<임시 폴더> 로 따로 띄워 파트너스에 직접 로그인
// 실행 후 결과를 site/src/data/coupang-events.json 형식(id, cat, title, end, created, image, link)으로 정리해 넣는다(CLAUDE.md 참고).
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const OUT = __dirname + '/../coupang-events.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9333', defaultViewport: null });
  const page = (await browser.pages()).find((p) => p.url().includes('partners.coupang.com'));
  // 1) 목록 요청이 어떤 모양인지 화면에서 한 번 받아 본다
  let listReq = null;
  const onReq = (r) => { if (r.method() === 'POST' && /\/api\/v1\/events$/.test(r.url())) listReq = { body: r.postData(), headers: r.headers() }; };
  page.on('request', onReq);
  await page.goto('https://partners.coupang.com/#affiliate/ws/affiliate'); await sleep(1200);
  await page.goto('https://partners.coupang.com/#affiliate/ws/events');
  for (let t = 0; t < 30 && !listReq; t++) await sleep(500);
  page.off('request', onReq);
  if (!listReq) throw new Error('목록 요청을 보지 못함');
  console.log('목록 요청 본문:', listReq.body);
  const extra = {}; for (const k of Object.keys(listReq.headers)) if (/^x-|csrf|xsrf/i.test(k)) extra[k] = listReq.headers[k];
  console.log('추가 헤더 이름:', Object.keys(extra).join(',') || '(없음)');
  const base = JSON.parse(listReq.body || '{}');
  const call = (method, path, body) => page.evaluate(async (method, path, body, extra) => {
    const res = await fetch(path, { method, credentials: 'include', headers: Object.assign({ 'Content-Type': 'application/json;charset=UTF-8', Accept: 'application/json' }, extra), body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, json: await res.json().catch(() => null) };
  }, method, path, body, extra);

  // 2) 목록 전체
  const first = await call('POST', '/api/v1/events', base);
  const data = first.json && first.json.data; if (!data) throw new Error('목록 응답 이상: ' + JSON.stringify(first).slice(0, 300));
  console.log('목록 응답 키:', Object.keys(data).join(','), '| 항목 키:', Object.keys(data.content[0]).join(','));
  const pageKey = Object.keys(base).find((k) => /page/i.test(k) && typeof base[k] === 'number'), sizeKey = Object.keys(base).find((k) => /size/i.test(k));
  const total = data.totalElements || data.totalCount || data.total || 0, size = (sizeKey && base[sizeKey]) || data.content.length;
  const pages = Math.ceil((data.total || 0) / 12) || 1;
  console.log('전체', total, '| 쪽', pages, '| 쪽 키', pageKey, base[pageKey]);
  let all = [...data.content];
  for (let p = 1; p < pages; p++) {
    await sleep(1200);
    const r = await call('POST', '/api/v1/events', { page: { pageNumber: p, size: 12 } });
    const c = r.json && r.json.data && r.json.data.content; if (!c) { console.log('  ', p, '쪽 실패', r.status); break; }
    all = all.concat(c);
  }
  const uniq = [...new Map(all.map((e) => [e.eventId || e.id, e])).values()];
  console.log('목록에서 받은 기획전', uniq.length);

  // 3) 상세(변환 링크) — 이미 받은 것은 건너뜀
  let done = []; try { done = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) {}
  const have = new Set(done.map((d) => d.id));
  for (const e of uniq) {
    const id = e.eventId || e.id; if (!id || have.has(id)) continue;
    await sleep(1300 + Math.random() * 900);
    const r = await call('GET', '/api/v1/events/' + id);
    const d = r.json && r.json.data;
    if (!d || !d.landingUrl) { console.log('  상세 실패', id, r.status, JSON.stringify(r.json).slice(0, 120)); if (r.status === 429 || r.status === 403) break; continue; }
    done.push(Object.assign({}, e, { id, link: d.landingUrl, image: d.image || e.image }));
    fs.writeFileSync(OUT, JSON.stringify(done, null, 1));
    if (done.length % 10 === 0) console.log('  ', done.length, '/', uniq.length);
  }
  console.log('끝 — 링크까지 받은 것', done.length, '/', uniq.length);
  console.log('예시:', JSON.stringify(done[0]));
  await browser.disconnect();
})().catch((e) => { console.error('오류:', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
