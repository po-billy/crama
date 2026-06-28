// 브랜드 자산 재생성 — favicon.svg 기준 PNG 아이콘 + 심플 OG(워드마크만, 뱃지/UI 없음).
//   사용: node gen-brand-assets.js
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const PUB = path.resolve('../site/public');
const favSvg = await fs.readFile(path.join(PUB, 'favicon.svg'));

// 1) PNG 아이콘들 (favicon.svg 벡터를 고밀도 렌더 후 리사이즈 → 크리스프)
const ICONS = [
  ['favicon-48.png', 48], ['favicon-96.png', 96],
  ['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180],
];
for (const [name, size] of ICONS) {
  await sharp(favSvg, { density: 2400 }).resize(size, size).png().toFile(path.join(PUB, name));
  console.log('아이콘', name, `${size}x${size}`);
}

// 2) 심플 OG — 클린 배경 + 'Crama' 워드마크(a=액센트). 뱃지/장식 없음.
const ogSvg =
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">` +
  `<rect width="1200" height="630" fill="#fcfcfd"/>` +
  `<text x="600" y="358" font-family="Georgia,'Times New Roman',serif" font-size="170" font-weight="700" ` +
  `fill="#1b1b22" text-anchor="middle" letter-spacing="-5">Cr<tspan fill="#6c5ce7">a</tspan>ma</text>` +
  `</svg>`;
await fs.writeFile(path.join(PUB, 'og-default.svg'), ogSvg);
await sharp(Buffer.from(ogSvg)).png().toFile(path.join(PUB, 'og-home.png'));
console.log('OG  og-default.svg + og-home.png (1200x630)');
console.log('완료');
