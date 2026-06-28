// 메인 HERO용 실사 기반 고퀄 배너 — PC 와이드 + 모바일 2종 자동 출력.
//   사용법: node gen-banner.js "<영문 장면 프롬프트>" <slug>
//   → site/public/img/generated/<slug>-hero.webp (PC, 1600x460)
//                                <slug>-hero-m.webp (모바일, 1080x620)
//   헤드라인/CTA는 이미지에 굽지 않고 CSS 오버레이(좌측)로 얹는다 → 좌측 여백 확보 프리셋.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../site/public/img/generated');

// 실사·시네마틱 프리셋 + '우측 피사체 / 좌측 여백(헤드라인 오버레이용)' 구도 강제, 텍스트/로고 금지
const PRESET =
  'ultra high quality cinematic editorial photograph, photorealistic, premium magazine-cover aesthetic, ' +
  'dramatic soft lighting, shallow depth of field, rich natural color grade, clean composition. ' +
  'The main subject is placed on the RIGHT side of the frame; the LEFT third is kept calm and simple ' +
  'with smooth negative space for a headline overlay. ' +
  'No text, no words, no letters, no logo, no watermark, no UI elements.';

async function genImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt, size: '1536x1024', n: 1, output_format: 'png', quality: 'high',
    }),
  });
  if (!res.ok) throw new Error('OpenAI image error: ' + (await res.text()));
  const j = await res.json();
  const b64 = j.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: 빈 응답');
  return Buffer.from(b64, 'base64');
}

const scene = process.argv[2];
const slug = process.argv[3];
if (!scene || !slug) {
  console.error('사용법: node gen-banner.js "<영문 장면 프롬프트>" <slug>');
  process.exit(1);
}

const buf = await genImage(`${scene}. ${PRESET}`);
await fs.mkdir(OUT, { recursive: true });
// PC(≈2.34:1, 홈 배너 표시비율에 맞춤 — 크롭 최소화) — 좌측 여백에 헤드라인 오버레이
await sharp(buf).resize(1500, 640, { fit: 'cover', position: 'right' }).webp({ quality: 82 }).toFile(path.join(OUT, `${slug}-hero.webp`));
// 모바일(≈2.1:1, dropshot식 와이드 배너)
await sharp(buf).resize(1040, 495, { fit: 'cover', position: 'right' }).webp({ quality: 82 }).toFile(path.join(OUT, `${slug}-hero-m.webp`));
console.log(`완료 → /img/generated/${slug}-hero.webp (PC) + ${slug}-hero-m.webp (모바일)`);
