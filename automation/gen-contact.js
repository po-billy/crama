// crami 10종을 5x2 그리드 컨택트시트로 합쳐 미리보기 PNG 생성.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');
const KEYS = ['notice','newsletter','vote','recommend','live','think','love','sleep','celebrate','peace'];
const CELL = 300, COLS = 5, ROWS = 2, LABEL = 26;
const CW = CELL, CH = CELL + LABEL;

const cells = [];
for (let i = 0; i < KEYS.length; i++) {
  const k = KEYS[i];
  const img = await sharp(path.join(OUT, `crami-${k}.webp`))
    .resize(CELL - 20, CELL - 20, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${CW}" height="${LABEL}"><text x="${CW/2}" y="${LABEL-7}" font-family="sans-serif" font-size="18" fill="#444" text-anchor="middle">${i+1}. ${k}</text></svg>`
  );
  const cell = await sharp({ create: { width: CW, height: CH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: img, gravity: 'north' }, { input: label, top: CELL, left: 0 }])
    .png().toBuffer();
  cells.push({ input: cell, top: Math.floor(i / COLS) * CH, left: (i % COLS) * CW });
}

await sharp({ create: { width: CW * COLS, height: CH * ROWS, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
  .composite(cells)
  .png()
  .toFile(path.join(OUT, 'crami-contact-sheet.png'));
console.log('완료 → /img/generated/crami-contact-sheet.png');
