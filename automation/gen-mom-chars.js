// 크라마 맘(/mom/) 캐릭터·배경 생성 — 3D 클레이 피규어 톤.
//   몽이(구름 모양 엄마 캐릭터)·콩이(뱃속 아기 콩)를 먼저 정면 기본 포즈로 만들고,
//   나머지 포즈는 그 그림을 레퍼런스로 붙여 '같은 캐릭터, 포즈만 변경'(/images/edits)으로 만든다.
//   결과: site/public/mom/char/{char}-{pose}.webp (Mascot.astro 가 파일이 있으면 SVG 대신 자동 사용)
//         site/public/mom/scene-{day|night}-{wide|tall}.webp (첫 화면 하늘·초원 배경)
//   사용법: node gen-mom-chars.js            전체(이미 있는 파일은 건너뜀)
//           node gen-mom-chars.js mong-hi scene-day-wide   지정한 것만 다시
import 'dotenv/config';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const CHAR_OUT = path.resolve('../site/public/mom/char');
const SCENE_OUT = path.resolve('../site/public/mom');
const MODEL = process.env.OPENAI_MOM_MODEL || process.env.OPENAI_PORTAL_MODEL || 'gpt-image-2.6-sunburst';
const KEY = process.env.OPENAI_API_KEY;

const CLAY =
  '3D clay figurine render, soft matte plasticine clay texture with very subtle handmade surface, kawaii chibi proportions, ' +
  'soft warm studio lighting, gentle pastel colors, smooth rounded shapes, centered full body, ' +
  'isolated on a FULLY TRANSPARENT background: no background color, no ground, no floor, NO shadow, no text, no letters.';

const CHARS = {
  mong:
    'an original cute chubby mascot shaped like a puffy cloud: creamy-white fluffy body with a bumpy rounded cloud outline on top, ' +
    'a small mint-green two-leaf sprout growing from the top of its head, big glossy black bead eyes with tiny white highlights, ' +
    'soft pink blush cheeks, a tiny "w"-shaped smiling mouth, tiny stubby round arms and two small round feet. It is NOT a rabbit, NOT a cat, no ears',
  kong:
    'an original tiny cute baby mascot shaped like a round jelly bean: smooth butter-yellow round body, one small curl of hair on top, ' +
    'big glossy black bead eyes with tiny white highlights, soft pink blush cheeks, a tiny smile, tiny stubby arms and feet, ' +
    'wearing a small mint-green baby bib. It is NOT a chick, no beak, no ears',
};

const POSES = {
  idle: 'standing calmly facing the viewer with a gentle happy smile',
  hi: 'waving hello with one raised arm, cheerful smile',
  cheer: 'both arms thrown up in celebration, eyes closed in happy upturned arcs, mouth open in a joyful laugh, two small yellow sparkle stars nearby',
  sleep: 'sitting and dozing peacefully, eyes closed, a tiny soft blue "z" floating above',
  hold: 'hugging a glossy pastel-pink heart in front of its tummy with both arms, blushing',
};

const JOBS = [
  ...['idle', 'hi', 'cheer', 'sleep', 'hold'].map((p) => ({ key: `mong-${p}`, char: 'mong', pose: p })),
  ...['idle', 'hi', 'cheer', 'sleep'].map((p) => ({ key: `kong-${p}`, char: 'kong', pose: p })),
];

const SCENE_BASE =
  'a cozy 3D clay diorama landscape in soft kawaii style, rolling soft green meadow hills with tiny white daisies in the lower part, ' +
  'distant soft blue rounded mountains and a small calm lake, a couple of round clay trees at the far left and right edges, ' +
  'the UPPER HALF is open sky kept simple so white text can be placed on it, NO characters, NO animals, NO people, NO text, no letters, no logo';
const SCENES = [
  { key: 'scene-day-wide', size: '1536x1024', out: [1600, 1067], prompt: `${SCENE_BASE}, bright clear blue sky with big fluffy white clouds, sunny afternoon light, wide landscape composition` },
  { key: 'scene-day-tall', size: '1024x1536', out: [900, 1350], prompt: `${SCENE_BASE}, bright clear blue sky with big fluffy white clouds, sunny afternoon light, tall portrait phone-screen composition with the meadow in the bottom 40%` },
  { key: 'scene-night-wide', size: '1536x1024', out: [1600, 1067], prompt: `${SCENE_BASE}, calm deep navy-blue night sky with small soft glowing stars and a round crescent moon, meadow lit by soft moonlight in muted blue-green, wide landscape composition` },
  { key: 'scene-night-tall', size: '1024x1536', out: [900, 1350], prompt: `${SCENE_BASE}, calm deep navy-blue night sky with small soft glowing stars and a round crescent moon, meadow lit by soft moonlight in muted blue-green, tall portrait phone-screen composition with the meadow in the bottom 40%` },
];

async function generate(prompt, size, transparent) {
  const body = { model: MODEL, prompt, size, n: 1, quality: transparent ? 'medium' : 'high', output_format: 'png' };
  if (transparent) body.background = 'transparent';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}

async function edit(prompt, refPng) {
  const fd = new FormData();
  fd.set('model', MODEL);
  fd.set('prompt', prompt);
  fd.set('size', '1024x1024');
  fd.set('quality', 'medium');
  fd.set('background', 'transparent');
  fd.append('image[]', new Blob([refPng], { type: 'image/png' }), 'ref.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: fd });
  if (!res.ok) throw new Error(await res.text());
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}

const saveChar = (buf, file) =>
  sharp(buf).trim({ threshold: 1 }).resize({ width: 400, height: 400, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 84, alphaQuality: 100 }).toFile(file);

const only = process.argv.slice(2);
const want = (k, file) => (only.length ? only.includes(k) : !existsSync(file));

await fs.mkdir(CHAR_OUT, { recursive: true });

// 1) 캐릭터 — idle 이 레퍼런스(골드 마스터)
for (const j of JOBS) {
  const file = path.join(CHAR_OUT, `${j.key}.webp`);
  if (!want(j.key, file)) continue;
  process.stdout.write(`▶ ${j.key} ... `);
  try {
    let buf;
    if (j.pose === 'idle') {
      buf = await generate(`${CHARS[j.char]}, ${POSES.idle}. ${CLAY}`, '1024x1024', true);
    } else {
      const ref = path.join(CHAR_OUT, `${j.char}-idle.webp`);
      if (!existsSync(ref)) throw new Error(`${j.char}-idle 이 먼저 있어야 해요`);
      const refPng = await sharp(ref).png().toBuffer();
      buf = await edit(`Keep the EXACT same character as the reference image (same body shape, colors, face, clay texture). Do NOT redesign it. Only change the pose: ${POSES[j.pose]}. ${CLAY}`, refPng);
    }
    await saveChar(buf, file);
    console.log('완료');
  } catch (e) { console.log('실패:', String(e.message).slice(0, 300)); }
}

// 2) 배경
for (const s of SCENES) {
  const file = path.join(SCENE_OUT, `${s.key}.webp`);
  if (!want(s.key, file)) continue;
  process.stdout.write(`▶ ${s.key} ... `);
  try {
    const buf = await generate(s.prompt, s.size, false);
    await sharp(buf).resize(s.out[0], s.out[1], { fit: 'cover' }).webp({ quality: 78 }).toFile(file);
    console.log('완료');
  } catch (e) { console.log('실패:', String(e.message).slice(0, 300)); }
}
console.log('\n전체 완료');
