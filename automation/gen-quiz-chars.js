// 머니 캐릭터 테스트용 캐릭터 일러스트 생성(정사각 1024 → webp).
//   사용법: node gen-quiz-chars.js
//   - OpenAI 이미지 API 사용(automation/.env의 OPENAI_API_KEY)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

const STYLE =
  'cute 3D rendered claymation toy figurine character, soft rounded clay material, smooth studio lighting, ' +
  'pastel lavender and peach gradient background, centered full body, friendly and charming, high detail, no text, no words';

const CHARS = [
  { key: 'turtle', subject: 'a calm sturdy turtle character gently hugging a golden piggy bank, content and reassuring expression' },
  { key: 'squirrel', subject: 'a cheerful squirrel character holding and neatly stacking shiny gold coins like acorns' },
  { key: 'hawk', subject: 'a bold confident hawk character standing proudly with a small upward trending arrow beside it, adventurous pose' },
  { key: 'fox', subject: 'a clever fox character wearing round glasses, holding a small tablet that shows a rising chart, smart thoughtful expression' },
  { key: 'grasshopper', subject: 'a relaxed happy grasshopper character lounging with tiny sunglasses and a takeaway coffee cup, easygoing cheerful mood' },
  { key: 'ant', subject: 'a diligent hardworking ant character carrying several small money bags and gold coins, busy energetic pose' },
];

async function openaiImage(prompt) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt, size: '1024x1024', n: 1 }),
  });
  if (!res.ok) throw new Error('OpenAI image error: ' + (await res.text()));
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: 빈 응답');
  return Buffer.from(b64, 'base64');
}

await fs.mkdir(OUT, { recursive: true });
for (const c of CHARS) {
  const prompt = `${c.subject}. ${STYLE}`;
  process.stdout.write(`▶ ${c.key} ... `);
  const buf = await openaiImage(prompt);
  const file = path.join(OUT, `quiz-${c.key}.webp`);
  await sharp(buf).resize({ width: 768, height: 768, fit: 'cover' }).webp({ quality: 82 }).toFile(file);
  console.log('완료 →', `/img/generated/quiz-${c.key}.webp`);
}
console.log('\n전체 완료');
