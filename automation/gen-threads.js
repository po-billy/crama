// 스레드(Threads) 배포 드래프트 생성기 — "오늘의 이슈, 돈으로 읽다" 보이스.
//   복붙용 초안만 생성(외부 자동 게시 안 함). 사용: node gen-threads.js [slug]
//   slug 생략 시 최신 발행 글 사용. 결과: automation/output/threads-draft.txt
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateThreadsDraft } from './lib/claude.js';
import { BLOG_DIR } from './lib/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseFm(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = m[1];
  const pick = (k) => {
    const r = fm.match(new RegExp('^' + k + ':\\s*(.+)$', 'm'));
    if (!r) return '';
    return r[1].trim().replace(/^["']|["']$/g, '');
  };
  return { title: pick('title'), description: pick('description'), pubDate: pick('pubDate') };
}

async function pickArticle(slugArg) {
  const files = (await fs.readdir(BLOG_DIR)).filter((f) => f.endsWith('.mdx'));
  if (slugArg) {
    const f = `${slugArg}.mdx`;
    if (!files.includes(f)) throw new Error(`글 없음: ${slugArg}`);
    const fmd = parseFm(await fs.readFile(path.join(BLOG_DIR, f), 'utf8'));
    return { slug: slugArg, ...fmd };
  }
  let best = null;
  for (const f of files) {
    const fmd = parseFm(await fs.readFile(path.join(BLOG_DIR, f), 'utf8'));
    if (!fmd) continue;
    const t = Date.parse(fmd.pubDate) || 0;
    if (!best || t > best.t) best = { t, slug: f.replace(/\.mdx$/, ''), ...fmd };
  }
  return best;
}

async function main() {
  const slugArg = process.argv[2];
  const art = await pickArticle(slugArg);
  if (!art) throw new Error('대상 글을 찾지 못했습니다.');
  const url = `https://crama.app/blog/${art.slug}/`;
  console.log('[threads] 대상 글:', art.title);
  const draft = await generateThreadsDraft({ title: art.title, description: art.description, url });
  if (!draft) throw new Error('드래프트 생성 실패(API 키 확인).');
  const outDir = path.join(__dirname, 'output');
  await fs.mkdir(outDir, { recursive: true });
  const out = path.join(outDir, 'threads-draft.txt');
  await fs.writeFile(out, draft + '\n', 'utf8');
  console.log('\n──────── 스레드 초안 ────────\n' + draft + '\n────────────────────────────\n');
  console.log('저장:', out);
}

main().catch((e) => { console.error('[threads] 실패:', e.message || e); process.exit(1); });
