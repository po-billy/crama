// 크라미(Crami) 마스코트 기능 10종 양산 — 베이비 미어캣 골드마스터 레퍼런스.
//   좁쌀 점눈 + 머리캡 + 크레용 덜칠 질감 + 통통몸, 투명배경, 크기 통일(트림 후 정사각 패딩).
//   사용법: node gen-crami.js [key ...]
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');
const REF_FILES = [
  path.join(OUT, 'meerkat-baby-announce.webp'),
  path.join(OUT, 'meerkat-baby-stand.webp'),
];

const CHARACTER =
  'Use the reference images for the EXACT character identity, coloring and the loose hand-drawn crayon ink style — keep them the same. ' +
  'The character: a cute chubby baby meerkat mascot named Crami, chunky rounded potato-shaped body, short stubby arms, two short stubby legs, ' +
  'big round head about 2.5 heads tall. ' +
  'EYES: the TINIEST possible solid black pinprick dots, like poppy seeds — barely two little dots, no white highlight, no iris, NO outline ring, ' +
  'the smaller the cuter. Keep the thin little black eyebrow marks. ' +
  'HEAD: the top of the head is covered by a black fur cap dipping to a small point in the center of the forehead (widow-peak shape). ' +
  'Keep the small pointy snout with a black nose, small upright ears, the terracotta-orange (#b04a2f) knitted scarf, black hands, black feet, black tail tip. ' +
  'Fill ALL black areas with rough, uneven, scribbled crayon strokes that do NOT fully cover — visible white streaks and sketchy texture, not solid flat black. ' +
  'Thick rough hand-drawn black ink outline, flat two-tone (white body + black markings) with only the scarf in terracotta. ' +
  'Draw the character LARGE so it fills most of the frame. ' +
  'Output on a FULLY TRANSPARENT background: no background color, no ground, NO shadow under the feet, nothing behind the character.';

const POSES = [
  { key: 'notice', subject: 'holding a terracotta-orange megaphone up with one stubby arm and shouting an announcement, mouth open, energetic "listen up!" pose' },
  { key: 'newsletter', subject: 'cheerfully holding out a terracotta-orange sealed envelope with both stubby arms toward the viewer, warm inviting smile' },
  { key: 'vote', subject: 'dropping a small folded paper ballot into a terracotta-orange ballot box, looking pleased and a little smug' },
  { key: 'recommend', subject: 'holding up a small folded newspaper in one stubby arm and a big thumbs-up with the other, happy approving grin' },
  { key: 'live', subject: 'holding small terracotta-orange binoculars up to both eyes with both stubby arms, alert curious "I spot it first" look' },
  { key: 'think', subject: 'tilting its head with one stubby arm up near its cheek, puzzled curious look with a small floating question mark' },
  { key: 'love', subject: 'happily holding a terracotta-orange heart with both stubby arms over its chest, blushing happy face' },
  { key: 'sleep', subject: 'sitting and dozing, eyes closed as little curved lines, a small sleepy bubble at its nose, peaceful sleeping pose' },
  { key: 'celebrate', subject: 'both stubby arms thrown up cheering with a big happy open grin, a few terracotta-orange confetti pieces around' },
  { key: 'peace', subject: 'flashing a cheeky V peace sign with one stubby arm and a playful happy face, confident "done!" pose' },
];

async function loadRefs() {
  const blobs = [];
  for (const f of REF_FILES) {
    const png = await sharp(await fs.readFile(f)).png().toBuffer();
    blobs.push(new Blob([png], { type: 'image/png' }));
  }
  return blobs;
}

async function editImage(prompt, refBlobs) {
  const fd = new FormData();
  fd.set('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  fd.set('prompt', prompt);
  fd.set('size', '1024x1024');
  fd.set('background', 'transparent');
  for (const b of refBlobs) fd.append('image[]', b, 'ref.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error('OpenAI edits error: ' + (await res.text()));
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI edits: 빈 응답');
  return Buffer.from(b64, 'base64');
}

// 반투명(옅은 그림자/헤일로) 픽셀 제거 → 진짜 투명 배경.
async function cleanAlpha(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] < 70) data[i + 3] = 0;
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

// 알파정리 → 투명 여백 트림 → 700px contain → 768 정사각 패딩. 크기 통일.
const PAD = { r: 0, g: 0, b: 0, alpha: 0 };
async function normalize(buf, file) {
  const inner = await sharp(await cleanAlpha(buf))
    .trim({ threshold: 10 })
    .resize({ width: 700, height: 700, fit: 'contain', background: PAD })
    .toBuffer();
  await sharp(inner)
    .extend({ top: 34, bottom: 34, left: 34, right: 34, background: PAD })
    .webp({ quality: 82, alphaQuality: 100 })
    .toFile(file);
}

const only = process.argv.slice(2);
const targets = only.length ? POSES.filter((p) => only.includes(p.key)) : POSES;
const refs = await loadRefs();

await fs.mkdir(OUT, { recursive: true });
for (const p of targets) {
  const prompt = `${CHARACTER} Pose: ${p.subject}`;
  process.stdout.write(`▶ crami-${p.key} ... `);
  try {
    const buf = await editImage(prompt, refs);
    await normalize(buf, path.join(OUT, `crami-${p.key}.webp`));
    console.log('완료 →', `/img/generated/crami-${p.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
