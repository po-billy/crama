// 앱 아이콘 원본(play-store/assets/icon-512.png, 보라 배경 + "Crama") → 사이트 파비콘·홈화면 아이콘 PNG 생성
// favicon.svg는 손으로 관리(같은 디자인). icon-maskable-512.png는 원본을 그대로 복사.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, '../play-store/assets/icon-512.png');
const outDir = path.join(__dirname, '../site/public');

// [크기, 파일명, 모서리 둥글게 여부] — apple-touch-icon·maskable은 OS가 자르므로 사각 그대로
const targets = [
  [48, 'favicon-48.png', true],
  [96, 'favicon-96.png', true],
  [192, 'icon-192.png', true],
  [512, 'icon-512.png', true],
  [180, 'apple-touch-icon.png', false],
  [512, 'icon-maskable-512.png', false],
];

for (const [size, name, rounded] of targets) {
  let img = sharp(src).resize(size, size);
  if (rounded) {
    const r = Math.round(size * 0.22);
    const mask = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="#fff"/></svg>`
    );
    img = sharp(await img.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }]);
  }
  await img.png().toFile(path.join(outDir, name));
  console.log('생성 →', name, `(${size}x${size})`);
}
