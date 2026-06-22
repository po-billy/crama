// 홈 원형 퀵메뉴 아이콘 생성(정사각 → 투명 webp). 캐릭터와 같은 클레이 톤.
//   사용법: node gen-menu-icons.js [key1 key2 ...]
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

const STYLE =
  'cute 3D rendered claymation icon, single object, soft rounded clay material, smooth studio lighting, ' +
  'simple and clear, centered, high detail, no text, no words, no letters, ' +
  'isolated on a fully transparent background, no scenery, no floor, no shadow';

const ICONS = [
  { key: 'test', subject: 'a playful golden coin character with a friendly smiling face next to a magnifying glass, fun quiz vibe' },
  { key: 'quiz', subject: 'a red and white dartboard target with a dart hitting the bullseye' },
  { key: 'column', subject: 'a fountain pen writing on a small sheet of paper' },
  { key: 'guide', subject: 'an open book with a small glowing compass on top' },
  { key: 'calc', subject: 'a cute pocket calculator with simple buttons' },
  { key: 'glossary', subject: 'a thick dictionary book with a small magnifying glass' },
  { key: 'money', subject: 'a chubby pink piggy bank with a single gold coin going in' },
  { key: 'ai', subject: 'a cute friendly little robot head with round eyes' },
  { key: 'income', subject: 'a small briefcase open with a few gold coins and a tiny upward arrow' },
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
const targets = only.length ? ICONS.filter((c) => only.includes(c.key)) : ICONS;

await fs.mkdir(OUT, { recursive: true });
for (const c of targets) {
  const prompt = `${c.subject}. ${STYLE}`;
  process.stdout.write(`▶ ${c.key} ... `);
  try {
    const buf = await openaiImage(prompt);
    const file = path.join(OUT, `menu-${c.key}.webp`);
    await sharp(buf)
      .resize({ width: 320, height: 320, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 84, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/menu-${c.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
