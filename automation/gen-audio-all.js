// 모든 발행 글을 오디오로 일괄 변환. 이미 audio: 있는 글은 건너뜀(--force 로 재생성).
//   사용량만 집계:  node gen-audio-all.js --dry
//   실제 변환:      node gen-audio-all.js   ( [--force] )
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BLOG_DIR } from './lib/util.js';
import { generateAudio, articleChunks } from './gen-audio.js';

const force = process.argv.includes('--force');
const dry = process.argv.includes('--dry') || process.argv.includes('--count');

const files = (await fs.readdir(BLOG_DIR)).filter((f) => /\.(md|mdx)$/.test(f)).sort();
const todo = [];
let alreadyDone = 0;
let pendingChars = 0;

for (const f of files) {
  const slug = f.replace(/\.(md|mdx)$/, '');
  const mdx = await fs.readFile(path.join(BLOG_DIR, f), 'utf8');
  if (/^\s*draft:\s*true/m.test(mdx)) continue; // 초안 제외
  const hasAudio = /^\s*audio:/m.test(mdx);
  if (hasAudio && !force) { alreadyDone++; continue; }
  let chars = 0;
  try { chars = articleChunks(slug).join('').length; }
  catch (e) { console.log(`  ! ${slug}: ${e.message}`); continue; }
  todo.push({ slug, chars });
  pendingChars += chars;
}

console.log(`전체 ${files.length}편 · 이미 완료 ${alreadyDone}편 · 변환 대상 ${todo.length}편`);
console.log(`예상 사용량(이번 실행): ${pendingChars.toLocaleString()}자  (Azure F0 무료 한도 500,000자/월)`);
if (pendingChars > 500000) console.log('⚠️ 이번 실행이 월 무료 한도를 초과합니다 — 절반만 하고 다음 달에 이어서 하세요.');

if (dry) {
  todo.forEach((t) => console.log(`  - ${t.slug} (${t.chars.toLocaleString()}자)`));
  process.exit(0);
}

let ok = 0, fail = 0, usedChars = 0;
for (let i = 0; i < todo.length; i++) {
  const { slug } = todo[i];
  process.stdout.write(`[${i + 1}/${todo.length}] ${slug} … `);
  try {
    const r = await generateAudio(slug, { force });
    if (r.skipped) { console.log('건너뜀'); }
    else { ok++; usedChars += r.chars; console.log(`완료 (${r.chars.toLocaleString()}자 / ${(r.durationMs / 1000).toFixed(0)}초)`); }
  } catch (e) {
    fail++; console.log('실패:', e.message || e);
  }
}
console.log(`\n끝 — 성공 ${ok}편 / 실패 ${fail}편 / 사용 ${usedChars.toLocaleString()}자`);
console.log('이제 git add/commit/push 하면 반영됩니다.');
