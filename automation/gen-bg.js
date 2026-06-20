// 장식용 배경 이미지 1장 생성(블로그 글과 무관) → site/public/img/generated/<slug>-hero.webp
// 사용: node gen-bg.js "<영문 프롬프트>" <slug>
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateHero } from './lib/image.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../site/public/img/generated');
const prompt = process.argv[2];
const slug = process.argv[3] || 'rotator-bg';
if (!prompt) { console.error('프롬프트가 필요합니다'); process.exit(1); }

const r = await generateHero({ prompt, slug, outDir, provider: 'openai' });
console.log('생성 완료 →', r.publicPath);
