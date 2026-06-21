// favicon.svg → 구글 친화 raster 파비콘(PNG) 생성
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svg = path.join(__dirname, '../site/public/favicon.svg');
const outDir = path.join(__dirname, '../site/public');

const targets = [
  [48, 'favicon-48.png'],
  [96, 'favicon-96.png'],
  [192, 'icon-192.png'],
  [512, 'icon-512.png'],
  [180, 'apple-touch-icon.png'],
];

for (const [size, name] of targets) {
  await sharp(svg, { density: 512 })
    .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .png()
    .toFile(path.join(outDir, name));
  console.log('생성 →', name, `(${size}x${size})`);
}
