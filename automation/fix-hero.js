import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { imagePrompt } from './lib/claude.js';
import { generateHero } from './lib/image.js';
import { PUBLIC_IMG, BLOG_DIR } from './lib/util.js';

const slug = process.argv[2] || 'us-stock-investment-beginners-guide';
const mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
let mdx = await fs.readFile(mdxPath, 'utf8');
const title = (mdx.match(/title:\s*['"]?(.+?)['"]?\s*$/m) || [])[1] || slug;

console.log('제목:', title);
const prompt = await imagePrompt({ title, categoryName: '주식·재테크' });
console.log('이미지 프롬프트:', prompt);

const hero = await generateHero({ prompt, slug, outDir: PUBLIC_IMG, provider: 'openai' });
console.log('이미지 저장:', hero.file);

mdx = mdx.replace(/heroImage:.*$/m, `heroImage: '${hero.publicPath}'`);
await fs.writeFile(mdxPath, mdx, 'utf8');
console.log('heroImage 업데이트 완료:', hero.publicPath);
