// 게임 3종 OG 이미지(1200×630) — 링크 공유 미리보기 전용. HTML→스크린샷(한글 폰트 안전).
//   node gen-game-og.js  → site/public/og-play.png, og-gacha.png, og-challenge.png
import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const OUT = path.resolve('../site/public');

const CARDS = [
  {
    file: 'og-play.png', bg: 'linear-gradient(135deg,#4c46c8,#2b2566)', deco: '▲▼',
    eyebrow: 'WEEKLY PREDICTION', title: '오르까 내리까', desc: '코스피 · 달러 · 비트코인, 다음 주 오를까 내릴까?<br/>맞히면 밀웜 — 전부 맞히면 퍼펙트 보너스',
    chips: ['🎯 더블다운', '소수파 역배 보너스', '매주 금요일 판정'],
  },
  {
    file: 'og-gacha.png', bg: 'linear-gradient(135deg,#b45309,#7c2d12)', deco: '●',
    eyebrow: 'CAPSULE MACHINE', title: '밀웜 뽑기', desc: '밀웜 15마리로 크라미 아이템 캡슐 뽑기<br/>중복 없음 · 비쌀수록 극악 · 꽝도 있음',
    chips: ['하루 3번', '컬렉션 수집', '확률 전체 공개'],
  },
  {
    file: 'og-challenge.png', bg: 'linear-gradient(135deg,#b91c1c,#7f1d1d)', deco: '♥♥',
    eyebrow: '7-DAY CHALLENGE', title: '무지출 챌린지', desc: '일주일 불필요한 지출 0원 도전<br/>목숨 2개 · 매일 체크인 +2밀웜 · 완주 +20',
    chips: ['LIFE ♥♥', '7일 도장판', '완주 기록'],
  },
];

const html = (c) => `<!doctype html><meta charset="utf-8"><style>
  * { margin:0; box-sizing:border-box; font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif; }
  body { width:1200px; height:630px; background:${c.bg}; color:#fff; padding:70px 80px; position:relative; overflow:hidden; display:flex; flex-direction:column; justify-content:center; }
  .deco { position:absolute; right:-40px; top:-60px; font-size:420px; opacity:.10; font-weight:900; letter-spacing:-30px; }
  .brand { position:absolute; left:80px; top:56px; font-size:30px; font-weight:800; opacity:.9; }
  .brand i { font-style:normal; color:#ffd166; }
  .eyebrow { font-size:26px; font-weight:800; letter-spacing:.18em; color:#ffd166; margin-bottom:18px; }
  h1 { font-size:110px; font-weight:900; letter-spacing:-2px; margin-bottom:26px; }
  p { font-size:36px; line-height:1.45; opacity:.92; margin-bottom:34px; }
  .chips { display:flex; gap:14px; }
  .chips span { font-size:26px; font-weight:800; padding:12px 26px; border:2.5px solid rgba(255,255,255,.55); border-radius:999px; background:rgba(255,255,255,.10); }
  .url { position:absolute; right:80px; bottom:48px; font-size:28px; font-weight:800; opacity:.85; }
</style><body>
  <div class="deco">${c.deco}</div>
  <div class="brand">cr<i>a</i>ma</div>
  <div class="eyebrow">${c.eyebrow}</div>
  <h1>${c.title}</h1>
  <p>${c.desc}</p>
  <div class="chips">${c.chips.map((x) => `<span>${x}</span>`).join('')}</div>
  <div class="url">crama.app</div>
</body>`;

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const pg = await b.newPage();
await pg.setViewport({ width: 1200, height: 630 });
for (const c of CARDS) {
  await pg.setContent(html(c), { waitUntil: 'networkidle0' });
  await pg.screenshot({ path: path.join(OUT, c.file) });
  console.log('✓', c.file);
}
await b.close();
