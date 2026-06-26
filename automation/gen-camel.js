// Crama 마스코트 — 낙타(camel) 컨셉 베이스 시안. 2등신 댕청美 + 덜칠한 크레용 질감.
//   사용법: node gen-camel.js [pose1 pose2 ...]
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

const CHAR =
  'a cute chibi CAMEL mascot character named Crama, super-deformed 2-head-tall proportions: a big round head and a tiny short stubby body, ' +
  'one small rounded camel hump on its back, short stubby legs, long curly eyelashes, a goofy derpy dopey-but-adorable happy expression ' +
  '(trendy silly cute vibe like a golden retriever or a quokka), buck-tooth or slightly droopy lip, ' +
  'pure white body with rough black markings only (black hooves, black ear insides, black hump tip, black nose, small black tail tuft), ' +
  'wearing a small terracotta-orange (#b04a2f) knitted scarf';

const STYLE =
  'bold hand-drawn marker and ink illustration in the style of a Korean editorial cartoon mascot like Newneek gosum, ' +
  'thick rough black brush outline, flat two-tone (pure white body + black markings) with a single terracotta-orange scarf accent, ' +
  'IMPORTANT: fill the black areas with ROUGH, uneven, scribbled crayon strokes that do NOT fully cover — leave visible white streaks, ' +
  'patchy gaps and sketchy directional texture inside the black fills, like quickly hand-colored crayon, not clean solid flat black. ' +
  'No gradients, no shading, chunky rounded sticker-like body, super cute, centered full body, ' +
  'no text, no words, isolated on a fully transparent background, no scenery, no floor, no shadow';

const POSES = [
  { key: 'hello', subject: 'standing facing forward, one little hoof waving hello, big derpy happy open smile, sleepy half-lidded cute eyes' },
  { key: 'announce', subject: 'one little hoof thrown up energetically as if rallying people, cheeky open-mouth grin, lively "hey, come check this out" pose' },
  { key: 'derp', subject: 'a maximally silly derpy pose, tongue slightly out, googly happy eyes looking different ways, totally goofy adorable dummy energy' },
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
const targets = only.length ? POSES.filter((p) => only.includes(p.key)) : POSES;

await fs.mkdir(OUT, { recursive: true });
for (const p of targets) {
  const prompt = `${CHAR}, ${p.subject}. ${STYLE}`;
  process.stdout.write(`▶ camel-${p.key} ... `);
  try {
    const buf = await openaiImage(prompt);
    const file = path.join(OUT, `camel-${p.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/camel-${p.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
