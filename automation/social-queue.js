// 소셜 게시 큐 — 인스타/스레드에 '다음에 올릴 글'을 추천하고, 올린 글을 기록한다.
//   node social-queue.js                  다음 후보 N개 추천(미게시·칼럼·최신 우선)
//   node social-queue.js -n 12            추천 개수 지정
//   node social-queue.js --mark <slug>    올렸다고 기록(오늘 날짜)  / --mark <slug> 2026-06-20
//   node social-queue.js --unmark <slug>  기록 취소
//   node social-queue.js --posted         올린 글 목록
// 기록은 automation/social/posted.json (git 추적 — 이력이 사라지지 않게 output/ 바깥).
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BLOG_DIR, log } from './lib/util.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOCIAL_DIR = path.join(HERE, 'social');
const LOG = path.join(SOCIAL_DIR, 'posted.json');

function loadPosted() { try { return JSON.parse(readFileSync(LOG, 'utf8')); } catch (e) { return {}; } }
function savePosted(obj) { mkdirSync(SOCIAL_DIR, { recursive: true }); writeFileSync(LOG, JSON.stringify(obj, null, 2) + '\n', 'utf8'); }

function fm(slug) {
  const raw = readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const f = m ? m[1] : '';
  const pick = (k) => (f.match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, 'm')) || [])[1] || '';
  return { title: pick('title'), pubDate: pick('pubDate'), category: pick('category'), format: pick('format') || 'guide', draft: /^draft:\s*true/m.test(f) };
}
const allSlugs = () => readdirSync(BLOG_DIR).filter((f) => f.endsWith('.mdx')).map((f) => f.replace(/\.mdx$/, ''));
const today = () => new Date().toISOString().slice(0, 10);

const args = process.argv.slice(2);
const posted = loadPosted();

if (args[0] === '--mark') {
  const slug = args[1];
  if (!slug) { console.error('사용법: node social-queue.js --mark <slug> [YYYY-MM-DD]'); process.exit(1); }
  posted[slug] = args[2] || today();
  savePosted(posted);
  log(`기록됨: ${slug} → ${posted[slug]}  (누적 ${Object.keys(posted).length}건)`);
  process.exit(0);
}
if (args[0] === '--unmark') {
  const slug = args[1];
  if (slug && posted[slug]) { delete posted[slug]; savePosted(posted); log(`기록 취소: ${slug}`); }
  else log(`기록 없음: ${slug}`);
  process.exit(0);
}
if (args[0] === '--posted') {
  const rows = Object.entries(posted).sort((a, b) => (a[1] < b[1] ? 1 : -1));
  console.log(`\n올린 글 ${rows.length}건\n`);
  rows.forEach(([s, d]) => { let t = ''; try { t = fm(s).title; } catch (e) {} console.log(`  ${d}  ${s}${t ? '  — ' + t : ''}`); });
  console.log('');
  process.exit(0);
}

// 기본: 다음에 올릴 후보 추천
const nIdx = args.indexOf('-n');
const N = nIdx >= 0 ? (parseInt(args[nIdx + 1], 10) || 8) : 8;

const unposted = allSlugs()
  .filter((s) => !posted[s])
  .map((s) => { try { return { slug: s, ...fm(s) }; } catch (e) { return null; } })
  .filter((c) => c && !c.draft && c.title);

unposted.sort((a, b) => {
  const fa = a.format === 'column' ? 0 : 1, fb = b.format === 'column' ? 0 : 1; // 칼럼이 소셜에서 더 잘 퍼짐 → 우선
  if (fa !== fb) return fa - fb;
  return a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : 0;          // 최신 우선
});

const total = allSlugs().length;
console.log(`\n다음에 올릴 후보 — 미게시 ${unposted.length} / 전체 ${total} (칼럼·최신 우선), 게시 완료 ${Object.keys(posted).length}건\n`);
unposted.slice(0, N).forEach((c, i) => {
  console.log(`  ${String(i + 1).padStart(2)}. [${c.format === 'column' ? '칼럼' : '가이드'}] ${c.title}`);
  console.log(`      node gen-cards.js ${c.slug}   (${c.category} · ${c.pubDate})`);
});
console.log(`\n  카드 생성 → output/cards/<slug>/ 의 01~.png + caption.txt 업로드 → node social-queue.js --mark <slug>\n`);
