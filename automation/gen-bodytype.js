// 체형 비교용 — 고슴이st 통통 2.5등신 직립 체형 + 크레용 덜칠 질감. 미어캣 vs 낙타.
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

// 고슴이st 공통 체형/질감
const BODY =
  'chunky rounded potato-shaped compact body standing upright on two short stubby legs, short stubby arms, ' +
  'a big round head, about 2.5 heads tall, cute and huggable, like the body proportions of the Newneek gosum mascot';

const STYLE =
  'bold hand-drawn marker and ink illustration like a Korean editorial cartoon mascot, thick rough black brush outline, ' +
  'flat two-tone: pure white body with black markings, a single terracotta-orange (#b04a2f) scarf accent. ' +
  'IMPORTANT: fill the black areas with ROUGH, uneven, scribbled crayon strokes that do NOT fully cover — leave visible white streaks, ' +
  'patchy gaps and sketchy directional texture inside the black fills, like quickly hand-colored crayon, not clean solid flat black. ' +
  'No gradients, no shading, super cute, centered full body, one little hand waving hello with a cheerful face, ' +
  'no text, no words, isolated on a fully transparent background, no scenery, no floor, no shadow';

const CHARS = [
  { key: 'meerkat', subject:
    'a cute meerkat mascot named Crama with the following body: ' + BODY +
    ', meerkat features: small upright ears, black eye patches, a pointy little snout, black hands and feet, a black tail tip, ' +
    'wearing a small terracotta-orange knitted scarf' },
  { key: 'camel', subject:
    'a cute derpy chibi camel mascot named Crama with the following body: ' + BODY +
    ', camel features: one small rounded hump on its back, long curly eyelashes, a goofy buck-tooth dopey-adorable smile, ' +
    'black hooves, black ear insides, black hump tip and small black tail tuft, wearing a small terracotta-orange knitted scarf' },
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
  process.stdout.write(`▶ body-${c.key} ... `);
  try {
    const buf = await openaiImage(prompt);
    const file = path.join(OUT, `body-${c.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/body-${c.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
