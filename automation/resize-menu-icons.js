import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const DIR = path.resolve('../site/public/img/generated');
const files = (await fs.readdir(DIR)).filter((f) => /^menu-.*\.webp$/.test(f));
for (const f of files) {
  const p = path.join(DIR, f);
  const before = (await fs.stat(p)).size;
  const buf = await fs.readFile(p);
  const out = await sharp(buf)
    .resize({ width: 144, height: 144, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 82, alphaQuality: 100 })
    .toBuffer();
  await fs.writeFile(p, out);
  console.log(f, Math.round(before/1024)+'KB →', Math.round(out.length/1024)+'KB');
}
