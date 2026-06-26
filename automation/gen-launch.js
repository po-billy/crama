// 출시 소재(런치 갤러리) 생성 — screenshot/*.png → 크림 배경 + 헤드라인 + 라운드/그림자 목업
//   node gen-launch.js   결과: screenshot/out/NN-*.png (1600x1000, 디스콰이엇/PH 갤러리용)
import sharp from 'sharp';
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, '..', 'screenshot');
const OUT = path.join(SRC, 'out');

const W = 1600, H = 1000;
const PAPER = '#fbf8f3', INK = '#1c1a17', ACCENT = '#b04a2f', MUTED = '#6f6a62';
const SERIF = 'HANBatang', SANS = 'Malgun Gothic';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const wrap = (t, max) => { const o = []; let c = ''; for (const w of String(t).split(/\s+/)) { if (!c) c = w; else if ((c + ' ' + w).length <= max) c += ' ' + w; else { o.push(c); c = w; } } if (c) o.push(c); return o; };
const tspans = (lines, x, y, lh) => lines.map((ln, i) => `<tspan x="${x}" y="${y + i * lh}">${esc(ln)}</tspan>`).join('');

// 파일명 → 소재 카피(순서·키커·헤드라인·서브). 헤드라인 줄바꿈은 \n.
const MAP = {
  '홈(와이드 배너+원형 메뉴).png': { n: 1, kicker: 'CRAMA', head: '먼저 읽는 사람들의\n돈·AI 매거진', sub: '트렌드를 먼저, 쉽게, 읽어줍니다' },
  '아티클_컬럼.png': { n: 2, kicker: 'ARTICLE', head: '전문 칼럼을\n깊이 있게', sub: 'AI·돈 트렌드를 칼럼니스트의 언어로 번역' },
  '모바일 미니 오디오바·이어듣기.png': { n: 3, kicker: 'AUDIO', head: '읽지 말고,\n들으세요', sub: '모든 글을 음성으로 — 끝나면 다음 글까지 자동 재생' },
  '금융 계산기 목록.png': { n: 4, kicker: 'TOOLS', head: '재테크 계산기,\n한곳에 20여 종', sub: '복리·대출·세금·전세·노후까지 즉시 계산' },
  '머니캐릭터.png': { n: 5, kicker: 'TEST', head: '나는 어떤\n머니 캐릭터일까?', sub: '10가지 질문으로 내 돈 성향을 진단' },
  '크라마 꾸미기.png': { n: 6, kicker: 'CRAMI', head: '읽을수록 자라는\n내 크라미', sub: '완독·청취로 모은 밀웜으로 마스코트 꾸미기' },
  '크라마 트렌드.png': { n: 7, kicker: 'TRENDS', head: '지금 뜨는 흐름,\n먼저 읽다', sub: '돈과 AI, 두 흐름만 깊게' },
  '마이페이지.png': { n: 8, kicker: 'MY', head: '내 기록이\n쌓이는 공간', sub: '저장한 글·구독·내 크라미를 한눈에' },
  '다크모드.png': { n: 9, kicker: 'DARK MODE', head: '밤에도\n편하게', sub: '라이트·다크 모드 지원' },
  '홈(와이드 배너+원형 메뉴-모바일).png': { n: 10, kicker: 'MOBILE', head: '어디서나\n먼저 읽는 매거진', sub: '손안에서 듣고 읽는 돈·AI 트렌드' },
};

// 스크린샷을 라운드 처리한 버퍼
async function rounded(file, w, h, r) {
  const mask = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" ry="${r}"/></svg>`);
  return sharp(file).resize(w, h, { fit: 'fill' }).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

function textBlock(x, kicker, head, sub, opt = {}) {
  const hFs = opt.hFs || 78, hLh = hFs * 1.18;
  const heads = String(head).split('\n').flatMap((l) => wrap(l, opt.hMax || 12));
  const subs = wrap(sub, opt.sMax || 26);
  const ky = opt.ky;                       // 키커 baseline
  const hy = ky + (opt.gap || 92);         // 헤드라인 첫 줄(키커와 충분히 떨어뜨림)
  const barY = hy + (heads.length - 1) * hLh + 34;
  const sy = barY + 64;
  return `
    <text x="${x}" y="${ky}" font-family="${SANS}" font-size="27" font-weight="bold" fill="${ACCENT}">${esc(kicker)}</text>
    <text font-family="${SERIF}" font-size="${hFs}" font-weight="bold" fill="${INK}">${tspans(heads, x, hy, hLh)}</text>
    <rect x="${x + 2}" y="${barY}" width="86" height="8" rx="4" fill="${ACCENT}"/>
    <text font-family="${SANS}" font-size="30" fill="${MUTED}">${tspans(subs, x, sy, 44)}</text>`;
}

const wordmark = (x, y) => `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="34" font-weight="bold" fill="${INK}">Crama</text><text x="${x + 116}" y="${y}" font-family="${SANS}" font-size="26" fill="${MUTED}">crama.app</text>`;
const SHADOW = `<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>`;

async function build(file) {
  const meta = MAP[file]; if (!meta) return null;
  const src = path.join(SRC, file);
  const m = await sharp(src).metadata();
  const isPC = m.width / m.height > 1.3;
  let bgSvg, shotBuf, sx, sy, sw, sh, r;

  if (isPC) {
    // 상단 헤드라인 + 하단 브라우저 목업(가로). 텍스트 영역을 위로 압축해 겹침 방지.
    sw = 1080; sh = Math.round(sw * m.height / m.width); r = 16;
    sx = Math.round((W - sw) / 2); sy = H - sh - 48;
    shotBuf = await rounded(src, sw, sh, r);
    bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${SHADOW}</defs>
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      <rect x="0" y="0" width="${W}" height="10" fill="${ACCENT}"/>
      ${textBlock(120, meta.kicker, meta.head, meta.sub, { ky: 120, hFs: 60, hMax: 24, sMax: 64, gap: 74 })}
      ${wordmark(W - 360, 132)}
      <rect x="${sx + 4}" y="${sy + 16}" width="${sw}" height="${sh}" rx="${r}" fill="#000" opacity="0.16" filter="url(#sh)"/>
    </svg>`;
  } else {
    // 좌 헤드라인 + 우 폰 목업(세로)
    sh = 838; sw = Math.round(sh * m.width / m.height); r = 38;
    sx = Math.round(1185 - sw / 2); sy = Math.round((H - sh) / 2);
    shotBuf = await rounded(src, sw, sh, r);
    bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs>${SHADOW}</defs>
      <rect width="${W}" height="${H}" fill="${PAPER}"/>
      <rect x="0" y="0" width="${W}" height="10" fill="${ACCENT}"/>
      ${textBlock(120, meta.kicker, meta.head, meta.sub, { ky: 330, hFs: 80, hMax: 11, sMax: 24 })}
      ${wordmark(120, H - 90)}
      <rect x="${sx + 4}" y="${sy + 18}" width="${sw}" height="${sh}" rx="${r}" fill="#000" opacity="0.18" filter="url(#sh)"/>
    </svg>`;
  }

  const border = Buffer.from(`<svg width="${sw}" height="${sh}"><rect x="1" y="1" width="${sw - 2}" height="${sh - 2}" rx="${r}" fill="none" stroke="rgba(0,0,0,0.10)" stroke-width="2"/></svg>`);
  const outName = `${String(meta.n).padStart(2, '0')}-${path.basename(file, '.png')}.png`;
  await sharp(Buffer.from(bgSvg))
    .composite([{ input: shotBuf, left: sx, top: sy }, { input: border, left: sx, top: sy }])
    .png().toFile(path.join(OUT, outName));
  return outName;
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const files = readdirSync(SRC).filter((f) => /\.png$/i.test(f));
  const done = [];
  for (const f of files) { const o = await build(f); if (o) { done.push(o); console.log('[launch]', o); } }
  console.log(`\n완료: ${done.length}장 → ${OUT}`);
})().catch((e) => { console.error(e); process.exit(1); });
