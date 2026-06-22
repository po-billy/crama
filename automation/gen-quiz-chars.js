// 머니 캐릭터 테스트용 캐릭터 일러스트 생성(정사각 → 투명 webp).
//   사용법: node gen-quiz-chars.js [key1 key2 ...]   (키 생략 시 전체)
//   - OpenAI 이미지 API 사용(automation/.env의 OPENAI_API_KEY)
//   - 밈/드립 컨셉: 동물 베이스 + 웃기고 역동적인 포즈
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

const STYLE =
  'cute 3D rendered claymation toy figurine character, soft rounded clay material, smooth studio lighting, ' +
  'exaggerated comedic dynamic pose, funny expressive face, full of personality, centered full body, high detail, ' +
  'no text, no words, no letters, isolated on a fully transparent background, no scenery, no floor, no shadow';

const CHARS = [
  { key: 'turtle', subject: 'a paranoid turtle hiding inside a tiny metal safe vault, hugging a thick stack of cash, only its wide-eyed nervous head and arms poking out, "protect my money at all costs" vibe' },
  { key: 'squirrel', subject: 'a squirrel with a blank thousand-yard stare, mechanically and obsessively stacking a tall tower of gold coins like acorns, completely unbothered, deadpan determined face' },
  { key: 'bull', subject: 'a cartoon bull kneeling and praying devotedly to a glowing golden rising stock chart arrow on an altar, hooves clasped, eyes shining with faith' },
  { key: 'moth', subject: 'a reckless moth with a manic excited grin diving headfirst with arms spread wide into a flaming rocket shooting upward, motion lines, all-in gambler energy' },
  { key: 'fox', subject: 'a mystical fortune-teller fox shaman waving its paws dramatically over a glowing crystal ball that shows a red and green candlestick chart, mysterious confident expression' },
  { key: 'owl', subject: 'an enthusiastic professor owl wearing round glasses, surrounded by floating newspapers and economic charts, pointing at a graph mid-lecture, know-it-all expression' },
  { key: 'hedgehog', subject: 'an over-cautious hedgehog completely wrapped in bubble wrap wearing a safety helmet, holding several umbrellas and a tiny shield, nervous careful smile' },
  { key: 'bee', subject: 'a busy efficient bee standing at a control panel directing streams of gold coins into several labeled jars, boss-like confident pose, organized energy' },
  { key: 'ant', subject: 'a frazzled overworked ant with many arms juggling a laptop, a delivery box, a coffee cup and gold coins all at once, tired eye bags but hustling hard' },
  { key: 'grasshopper', subject: 'a carefree grasshopper lounging on a beach chair with sunglasses and an iced drink, surrounded by shopping bags, totally relaxed broke-but-happy vibe' },
  { key: 'rabbit', subject: 'a hyper trendy rabbit zooming forward with speed motion lines, excitedly holding the newest shiny gadget, neon early-adopter energy' },
  { key: 'dolphin', subject: 'a cheerful dolphin playfully balancing a gold coin, a small clock, and a heart on its nose and flippers at once, joyful well-balanced pose' },
];

async function openaiImage(prompt) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model, prompt, size: '1024x1024', n: 1, background: 'transparent', output_format: 'png' }),
  });
  if (!res.ok) throw new Error('OpenAI image error: ' + (await res.text()));
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: 빈 응답');
  return Buffer.from(b64, 'base64');
}

const only = process.argv.slice(2);
const targets = only.length ? CHARS.filter((c) => only.includes(c.key)) : CHARS;

await fs.mkdir(OUT, { recursive: true });
for (const c of targets) {
  const prompt = `${c.subject}. ${STYLE}`;
  process.stdout.write(`▶ ${c.key} ... `);
  try {
    const buf = await openaiImage(prompt);
    const file = path.join(OUT, `quiz-${c.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/quiz-${c.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
