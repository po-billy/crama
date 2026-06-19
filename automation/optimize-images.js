// 기존 PNG 히어로 이미지를 webp로 일괄 변환하고, 글 frontmatter의 heroImage 경로를 갱신한다.
//   사용법: node optimize-images.js
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PUBLIC_IMG, BLOG_DIR } from './lib/util.js';

const files = await fs.readdir(PUBLIC_IMG).catch(() => []);
const pngs = files.filter((f) => f.toLowerCase().endsWith('.png'));
console.log(`PNG ${pngs.length}개 변환 시작`);

let saved = 0;
for (const png of pngs) {
  const src = path.join(PUBLIC_IMG, png);
  const webp = png.replace(/\.png$/i, '.webp');
  const dst = path.join(PUBLIC_IMG, webp);
  const before = (await fs.stat(src)).size;
  await sharp(src).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 80 }).toFile(dst);
  const after = (await fs.stat(dst)).size;
  await fs.unlink(src);
  saved += before - after;
  console.log(`  ${png}  ${(before / 1e6).toFixed(1)}MB → ${webp}  ${(after / 1e3).toFixed(0)}KB`);
}

// 글 frontmatter heroImage: .png → .webp
const blog = (await fs.readdir(BLOG_DIR)).filter((f) => /\.mdx?$/.test(f));
for (const f of blog) {
  const p = path.join(BLOG_DIR, f);
  const t = await fs.readFile(p, 'utf8');
  const nt = t.replace(/(heroImage:\s*['"]\/img\/generated\/[^'"]+)\.png(['"])/, '$1.webp$2');
  if (nt !== t) {
    await fs.writeFile(p, nt, 'utf8');
    console.log('  heroImage 갱신:', f);
  }
}

console.log(`완료. 총 절감 ${(saved / 1e6).toFixed(1)}MB`);
