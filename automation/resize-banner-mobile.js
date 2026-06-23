import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
const DIR = path.resolve('../site/public/img/generated');
const SRC = [
  'lifestyle-inflation-trap-hero.webp',
  'rotator-tools-hero.webp',
  'rotator-glossary-hero.webp',
  'rotator-guide-hero.webp',
  'rotator-quiz-hero.webp',
];
for (const f of SRC) {
  const p = path.join(DIR, f);
  const out = f.replace(/\.webp$/, '-m.webp');
  const op = path.join(DIR, out);
  const buf = await fs.readFile(p);
  const data = await sharp(buf).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  await fs.writeFile(op, data);
  console.log(out, Math.round((await fs.stat(p)).size/1024)+'KB →', Math.round(data.length/1024)+'KB');
}
