import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { research, writeArticle, imagePrompt } from './lib/claude.js';
import { generateHero } from './lib/image.js';
import {
  BLOG_DIR,
  PUBLIC_IMG,
  OUTPUT_DIR,
  readExistingPosts,
  safeSlug,
  similarity,
  log,
} from './lib/util.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forced = (args.find((a) => a.startsWith('--category=')) || '').split('=')[1];

async function loadThemes() {
  const raw = await fs.readFile(path.join(__dirname, 'config', 'themes.json'), 'utf8');
  return JSON.parse(raw);
}

// 토픽 권위 집중: targetPosts 미달 카테고리를 먼저 채우고, 모두 차면 가장 적은 곳
function pickCategory(themes, existing) {
  const count = (slug) => existing.filter((p) => p.category === slug).length;
  if (forced) {
    const c = themes.categories.find((x) => x.slug === forced);
    if (!c) throw new Error(`알 수 없는 카테고리: ${forced}`);
    return c;
  }
  const under = themes.categories.find((c) => count(c.slug) < c.targetPosts);
  if (under) return under;
  return [...themes.categories].sort((a, b) => count(a.slug) - count(b.slug))[0];
}

async function main() {
  log(dryRun ? 'DRY RUN 시작' : '발행 파이프라인 시작');
  const themes = await loadThemes();
  const existing = await readExistingPosts();

  const category = pickCategory(themes, existing);
  const used = existing.filter((p) => p.category === category.slug).length;
  const cluster = category.clusters[used % category.clusters.length];
  log(`카테고리=${category.name} / 클러스터="${cluster}" (기존 ${used}/${category.targetPosts})`);

  // 1) 리서치
  log('① 리서치(web_search) …');
  const brief = await research({ topic: `${category.name} - ${cluster}`, keywords: [cluster] });

  // 2) 작성
  log('② 원본 글 작성 …');
  const art = await writeArticle({ brief, cluster, categoryName: category.name, lang: category.lang });
  let slug = safeSlug(art.slug || art.title, category.slug);

  // 3) 중복 게이트
  const dup = existing
    .filter((p) => p.category === category.slug)
    .map((p) => similarity(art.title, p.title))
    .reduce((m, v) => Math.max(m, v), 0);
  log(`③ 품질·중복 게이트: 최대 유사도 ${(dup * 100).toFixed(0)}%`);
  if (dup > 0.7) {
    log('⚠️ 기존 글과 너무 유사 → 발행 중단(다음 실행에서 다른 클러스터 시도).');
    return;
  }
  if ((art.body || '').length < 800) {
    log('⚠️ 본문이 너무 짧음 → 발행 중단.');
    return;
  }

  // 4) 이미지
  log('④ 히어로 이미지 생성 …');
  const imgDir = dryRun ? path.join(OUTPUT_DIR, 'img') : PUBLIC_IMG;
  let heroImage = '/img/sample-money-1.svg';
  try {
    const prompt = await imagePrompt({ title: art.title, categoryName: category.name });
    const hero = await generateHero({ prompt, slug, outDir: imgDir });
    heroImage = hero.publicPath;
    log(`   이미지 저장: ${hero.file}`);
  } catch (e) {
    log('   이미지 생성 실패(샘플 이미지로 대체):', e.message);
  }

  // 5) MDX 조립 + 발행
  const today = new Date().toISOString().slice(0, 10);
  const fm =
    `---\n` +
    `title: ${JSON.stringify(art.title)}\n` +
    `description: ${JSON.stringify(art.description)}\n` +
    `pubDate: ${today}\n` +
    `category: '${category.slug}'\n` +
    `tags: ${JSON.stringify(art.tags || [])}\n` +
    `heroImage: '${heroImage}'\n` +
    `author: 'Crama 편집부'\n` +
    `affiliate: ${Boolean(category.affiliate)}\n` +
    `---\n\n`;
  const imports =
    `import KeyTakeaways from '../../components/KeyTakeaways.astro';\n` +
    `import Callout from '../../components/Callout.astro';\n` +
    `import Checklist from '../../components/Checklist.astro';\n` +
    `import FAQ from '../../components/FAQ.astro';\n\n`;
  const mdx = fm + imports + art.body.trim() + '\n';

  const targetDir = dryRun ? OUTPUT_DIR : BLOG_DIR;
  await fs.mkdir(targetDir, { recursive: true });
  const outFile = path.join(targetDir, `${slug}.mdx`);
  await fs.writeFile(outFile, mdx, 'utf8');

  log(`⑤ ${dryRun ? '미리보기 저장' : '발행 완료'}: ${outFile}`);
  log(`   제목: ${art.title}`);
  if (dryRun) log('DRY RUN — 사이트에는 반영되지 않았습니다. git push 시 자동 배포됩니다.');
}

main().catch((e) => {
  console.error('[crama] 실패:', e);
  process.exit(1);
});
