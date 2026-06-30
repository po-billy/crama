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

async function recentArticles(n) {
  const files = (await fs.readdir(BLOG_DIR)).filter((f) => f.endsWith('.mdx'));
  const list = [];
  for (const f of files) {
    const fmd = parseFm(await fs.readFile(path.join(BLOG_DIR, f), 'utf8'));
    if (!fmd) continue;
    list.push({ t: Date.parse(fmd.pubDate) || 0, slug: f.replace(/\.mdx$/, ''), ...fmd });
  }
  return list.sort((a, b) => b.t - a.t).slice(0, n);
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = path.join(__dirname, 'output');
  await fs.mkdir(outDir, { recursive: true });

  // --batch [N] : 최근 N개 글(기본 7)의 드래프트를 한 파일로 — 즉시 게시용 탄약
  const bi = args.indexOf('--batch');
  if (bi !== -1) {
    const n = parseInt(args[bi + 1], 10) || 7;
    const arts = await recentArticles(n);
    const blocks = [];
    for (const a of arts) {
      const url = `https://crama.app/blog/${a.slug}/`;
      console.log('[threads] 생성:', a.title);
      const draft = await generateThreadsDraft({ title: a.title, description: a.description, url });
      if (draft) blocks.push(`### ${a.title}\n\n${draft}`);
    }
    const out = path.join(outDir, 'threads-batch.txt');
    const body = blocks.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n');
    await fs.writeFile(out, body + '\n', 'utf8');
    console.log(`\n[threads] ${blocks.length}개 드래프트 저장: ${out}`);
    return;
  }

  const art = await pickArticle(args[0]);
  if (!art) throw new Error('대상 글을 찾지 못했습니다.');
  const url = `https://crama.app/blog/${art.slug}/`;
  console.log('[threads] 대상 글:', art.title);
  const draft = await generateThreadsDraft({ title: art.title, description: art.description, url });
  if (!draft) throw new Error('드래프트 생성 실패(API 키 확인).');
  // 서비스 CTA 자동 첨부
  const svcLine = '\n\n💰 나에게 해당되는 지원금 찾기 → crama.app/benefits\n🩺 재무 건강 체크업 → crama.app/checkup';
  const out = path.join(outDir, 'threads-draft.txt');
  await fs.writeFile(out, draft + svcLine + '\n', 'utf8');
  console.log('\n──────── 스레드 초안 ────────\n' + draft + '\n────────────────────────────\n');
  console.log('저장:', out);
}

main().catch((e) => { console.error('[threads] 실패:', e.message || e); process.exit(1); });
