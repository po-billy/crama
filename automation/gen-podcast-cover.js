// 팟캐스트 커버 생성 — 1500x1500 JPG (애플/스포티파이 제출 요건: 1400~3000px 정사각).
//   node gen-podcast-cover.js  → site/public/podcast-cover.jpg
import sharp from 'sharp';
import path from 'node:path';
import { ROOT } from './lib/util.js';

const W = 1500;
const ACCENT = '#b04a2f';
const ACCENT_D = '#8f3a23';
const CREAM = '#fbfaf8';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0%" stop-color="${ACCENT}"/>
      <stop offset="100%" stop-color="${ACCENT_D}"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${W}" fill="url(#bg)"/>
  <rect x="70" y="70" width="${W - 140}" height="${W - 140}" rx="48" fill="none" stroke="${CREAM}" stroke-opacity="0.5" stroke-width="3"/>

  <!-- 헤드폰 마크 -->
  <g transform="translate(${W / 2}, 540)" fill="none" stroke="${CREAM}" stroke-width="26" stroke-linecap="round">
    <path d="M -150 30 A 150 150 0 0 1 150 30"/>
    <rect x="-188" y="20" width="70" height="135" rx="34" fill="${CREAM}" stroke="none"/>
    <rect x="118" y="20" width="70" height="135" rx="34" fill="${CREAM}" stroke="none"/>
  </g>

  <text x="${W / 2}" y="930" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="250" font-weight="700" fill="${CREAM}">Crama</text>
  <text x="${W / 2}" y="1035" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="58" letter-spacing="14" fill="${CREAM}" fill-opacity="0.92">AUDIO MAGAZINE</text>
  <text x="${W / 2}" y="1120" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="42" letter-spacing="3" fill="${CREAM}" fill-opacity="0.75">stocks · money · AI</text>
</svg>`;

const out = path.join(ROOT, 'site', 'public', 'podcast-cover.jpg');
await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(out);
console.log('[cover] 생성:', out);
