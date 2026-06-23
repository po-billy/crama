import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const DIR = path.resolve('../site/public/img/generated');
const files = (await fs.readdir(DIR)).filter((f) => /-hero\.webp$/.test(f));
let n = 0, saved = 0;
for (const f of files) {
  const out = f.replace(/-hero\.webp$/, '-hero-thumb.webp');
  const buf = await fs.readFile(path.join(DIR, f));
  const data = await sharp(buf).resize({ width: 160, height: 160, fit: 'cover' }).webp({ quality: 72 }).toBuffer();
  await fs.writeFile(path.join(DIR, out), data);
  n++; saved += data.length;
}
console.log(`썸네일 ${n}개 생성, 총 ${Math.round(saved/1024)}KB (개당 ~${Math.round(saved/1024/n)}KB)`);
