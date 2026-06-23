// 수동 모드 전용: 이미지만 OpenAI로 생성해 글에 붙인다 (Anthropic API 미사용).
//   사용법: node add-image.js <slug> "<영문 이미지 프롬프트>"
//   - 프롬프트를 주면 Claude 호출 없이 OpenAI 이미지 1콜만 과금 (가장 저렴)
//   - 프롬프트를 생략하면 제목으로 자동 생성(이 경우만 Claude 소량 사용)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { generateHero } from './lib/image.js';
import { PUBLIC_IMG, BLOG_DIR } from './lib/util.js';

const CAT_NAME = { money: '주식·재테크', ai: 'AI 트렌드' };

const slug = process.argv[2];
const manualPrompt = process.argv[3];
if (!slug) {
  console.error('사용법: node add-image.js <slug> "<영문 이미지 프롬프트>"');
  process.exit(1);
}

const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
let mdx = await fs.readFile(mdxPath, 'utf8');
const title = (mdx.match(/title:\s*['"]?(.+?)['"]?\s*$/m) || [])[1] || slug;
const category = (mdx.match(/category:\s*['"]?(\w+)/) || [])[1] || 'money';

let prompt = manualPrompt;
if (!prompt) {
  // 프롬프트 미지정 시에만 Claude로 생성(소량 과금)
  const { imagePrompt } = await import('./lib/claude.js');
  prompt = await imagePrompt({ title, categoryName: CAT_NAME[category] || '주식·재테크' });
}

console.log('제목   :', title);
console.log('프롬프트:', prompt);

const hero = await generateHero({ prompt, slug, outDir: PUBLIC_IMG, provider: 'openai' });
// heroImage 줄이 있으면 교체, 없으면(수동 작성 글) title 아래에 새로 삽입
if (/^\s*heroImage:.*$/m.test(mdx)) mdx = mdx.replace(/^\s*heroImage:.*$/m, `heroImage: '${hero.publicPath}'`);
else mdx = mdx.replace(/^(title:.*)$/m, `$1\nheroImage: '${hero.publicPath}'`);
await fs.writeFile(mdxPath, mdx, 'utf8');

console.log('이미지 :', hero.file);
console.log('heroImage 업데이트 완료 →', hero.publicPath);
