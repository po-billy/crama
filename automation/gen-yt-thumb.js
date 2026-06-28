// 유튜브식 카드 썸네일 — 실사 사진 배경 + 굵은 한글 헤드라인(딥블루/옐로). 마스코트·칩 없음.
//   node gen-yt-thumb.js <slug>                 (frontmatter의 thumbTitle/title 사용)
//   node gen-yt-thumb.js <slug> --title "1줄\n2줄"
//   node gen-yt-thumb.js --all                  (모든 글 일괄 — 히어로 webp 있는 것만)
// 결과: public/img/generated/<slug>-thumb.webp (1280x720), frontmatter에 thumb 자동 기록
import 'dotenv/config';
import sharp from 'sharp';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { BLOG_DIR, PUBLIC_IMG } from './lib/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const W = 1280, H = 720;
const NAVY = '#0a1b33', YELLOW = '#ffd23e', WHITE = '#ffffff';

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const visLen = (s) => String(s).replace(/\s/g, '').length || 1;

function wrapKo(t, max) {
  const words = String(t).trim().split(/\s+/);
  const out = []; let line = '';
  for (const w of words) { const cand = line ? line + ' ' + w : w; if (cand.length <= max || !line) line = cand; else { out.push(line); line = w; } }
  if (line) out.push(line);
  return out;
}
// 썸네일 카피: thumbTitle(있으면 \n 그대로) > title 정리(따옴표 제거 + ' — ' 앞부분)
function deriveLines(title, thumbTitle) {
  if (thumbTitle && thumbTitle.trim()) return thumbTitle.split(/\\n|\n/).map((s) => s.trim()).filter(Boolean).slice(0, 3);
  let t = String(title).replace(/[''""]/g, '').trim().split(/\s[—\-–]\s/)[0].trim();
  return wrapKo(t, 11).slice(0, 2);
}

// 배경: 그라데이션(하단·좌측 어둡게) — 사진 위 텍스트 가독성
function buildBack() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.28" stop-color="${NAVY}" stop-opacity="0"/>
      <stop offset="0.66" stop-color="${NAVY}" stop-opacity="0.5"/>
      <stop offset="1" stop-color="${NAVY}" stop-opacity="0.94"/>
    </linearGradient>
    <linearGradient id="l" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${NAVY}" stop-opacity="0.62"/>
      <stop offset="0.5" stop-color="${NAVY}" stop-opacity="0.12"/>
      <stop offset="0.8" stop-color="${NAVY}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#000" opacity="0.1"/>
  <rect width="${W}" height="${H}" fill="url(#l)"/>
  <rect width="${W}" height="${H}" fill="url(#v)"/>
</svg>`);
}

// 전경: 좌측 액센트 바 + 헤드라인(둘째 줄 옐로)
function buildFront(lines) {
  const x = 64;
  const maxTextW = W - x - 80;
  const maxLen = Math.max(...lines.map(visLen));
  const fs1 = Math.max(58, Math.min(104, Math.floor(maxTextW / maxLen)));
  const lh = Math.round(fs1 * 1.16);
  const blockH = lines.length * lh;
  const baseY = H - 72 - blockH + fs1;
  const shadow = lines.map((ln, i) => `<tspan x="${x}" y="${baseY + i * lh}">${esc(ln)}</tspan>`).join('');
  const colored = lines.map((ln, i) => `<tspan x="${x}" y="${baseY + i * lh}" fill="${i === 1 ? YELLOW : WHITE}">${esc(ln)}</tspan>`).join('');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs><filter id="sh" x="-25%" y="-25%" width="150%" height="170%"><feGaussianBlur stdDeviation="8"/></filter></defs>
  <rect x="${x + 2}" y="${baseY - fs1 - 32}" width="74" height="10" rx="5" fill="${YELLOW}"/>
  <text font-family="Malgun Gothic" font-size="${fs1}" font-weight="bold" fill="#000" opacity="0.66" filter="url(#sh)">${shadow}</text>
  <text font-family="Malgun Gothic" font-size="${fs1}" font-weight="bold">${colored}</text>
</svg>`);
}

function readFm(slug) {
  const file = path.join(BLOG_DIR, `${slug}.mdx`);
  const raw = fs.readFileSync(file, 'utf8');
  const fm = (raw.match(/^---\n([\s\S]*?)\n---/) || [, ''])[1];
  const get = (k) => { const r = fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')); return r ? r[1].trim().replace(/^['"]|['"]$/g, '') : ''; };
  return { file, raw, title: get('title'), thumbTitle: get('thumbTitle'), heroImage: get('heroImage') };
}

async function generateThumb(slug, opts = {}) {
  const fm = readFm(slug);
  const title = opts.title || fm.title;
  const thumbTitle = opts.thumbTitle != null ? opts.thumbTitle : fm.thumbTitle;
  const heroRel = fm.heroImage || `/img/generated/${slug}-hero.webp`;
  const heroFile = path.join(PUBLIC_IMG, '..', '..', heroRel.replace(/^\//, ''));
  const srcFile = opts.src || (fs.existsSync(heroFile) ? heroFile : path.join(PUBLIC_IMG, `${slug}-hero.webp`));
  if (!fs.existsSync(srcFile) || /\.svg$/.test(srcFile)) throw new Error(`히어로 사진 없음(webp 필요): ${srcFile}`);

  const lines = deriveLines(title, thumbTitle);
  const bg = await sharp(srcFile).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  const outFile = path.join(PUBLIC_IMG, `${slug}-thumb.webp`);
  await sharp(bg)
    .composite([{ input: buildBack(), top: 0, left: 0 }, { input: buildFront(lines), top: 0, left: 0 }])
    .webp({ quality: 82 }).toFile(outFile);
  return { outFile, publicPath: `/img/generated/${slug}-thumb.webp`, lines };
}

async function ensureThumbField(slug, publicPath) {
  const fm = readFm(slug);
  if (/^thumb:\s*/m.test(fm.raw)) return false;
  const updated = fm.raw.replace(/^(heroImage:.*)$/m, `$1\nthumb: '${publicPath}'`);
  if (updated === fm.raw) return false;
  await fsp.writeFile(fm.file, updated, 'utf8');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
  if (args.includes('--all')) {
    const slugs = fs.readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f)).map((f) => f.replace(/\.mdx?$/, ''));
    let ok = 0, skip = 0;
    for (const slug of slugs) {
      try { const r = await generateThumb(slug); await ensureThumbField(slug, r.publicPath); ok++; console.log('[thumb]', slug, '|', r.lines.join(' / ')); }
      catch (e) { skip++; console.log('[skip]', slug, '—', e.message); }
    }
    console.log(`\n완료: ${ok}장 / 건너뜀 ${skip}`);
    return;
  }
  const slug = args.find((a) => !a.startsWith('--'));
  if (!slug) { console.error('사용법: node gen-yt-thumb.js <slug> [--title "1줄\\n2줄"] | --all'); process.exit(1); }
  const r = await generateThumb(slug, { title: flag('--title'), thumbTitle: flag('--title'), src: flag('--src') });
  const wrote = await ensureThumbField(slug, r.publicPath);
  console.log(`[thumb] ${r.outFile}\n  카피: ${r.lines.join('  /  ')}${wrote ? '\n  frontmatter thumb: 추가됨' : ''}`);
}

export { generateThumb, ensureThumbField };

// CLI로 직접 실행할 때만 main()
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
