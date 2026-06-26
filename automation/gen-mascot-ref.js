// Crama 마스코트 — 레퍼런스 컨디셔닝 버전.
//   announce(골드 마스터) 이미지를 레퍼런스로 첨부해 '같은 캐릭터, 포즈만 변경'.
//   OpenAI /images/edits (gpt-image-1) 사용.
//   사용법: node gen-mascot-ref.js [pose1 pose2 ...]   (생략 시 전체)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

// 골드 마스터 레퍼런스 (announce + think). PNG로 변환해 첨부.
const REF_FILES = [
  path.join(OUT, 'mascot-ink-announce.webp'),
  path.join(OUT, 'mascot-ink-think.webp'),
];

const CHARACTER =
  'Keep the EXACT same character as the reference image: the same friendly meerkat mascot, same face shape, ' +
  'same simple black eye markings, same black ears/paws/feet/tail-tip, same pure white body, same terracotta-orange knitted scarf, ' +
  'same thick rough hand-drawn black ink outline, same flat black-and-white two-tone style (no beige, no gray, no panda look). ' +
  'VERY IMPORTANT — match the loose hand-colored FILL of the reference: fill the black areas (ears, hands/paws, feet, tail tip) with ' +
  'ROUGH, uneven, scribbled crayon/marker strokes that do NOT fully cover the shape — leave visible white streaks, patchy gaps and ' +
  'sketchy directional texture inside the black fills, like quickly hand-colored crayon, NOT a clean solid flat black. ' +
  'Do NOT redesign the character. Only change the pose and expression as described. ' +
  'Centered full body, transparent background, no text, no extra props except the ones described.';

const POSES = [
  { key: 'notice', subject: 'holding a megaphone up with one paw and shouting an announcement, mouth open, energetic "listen up!" pose. The megaphone is terracotta-orange.' },
  { key: 'newsletter', subject: 'cheerfully holding out a sealed envelope letter with both paws toward the viewer, warm inviting smile. The envelope is terracotta-orange.' },
  { key: 'vote', subject: 'dropping a folded paper ballot into a ballot box, looking pleased and a little smug. The ballot box is terracotta-orange.' },
  { key: 'recommend', subject: 'holding up a folded newspaper in one paw and giving an enthusiastic thumbs-up with the other, big approving grin.' },
  { key: 'live', subject: 'standing on tiptoes holding small binoculars up to BOTH eyes evenly with both paws, alert curious look. The binoculars are terracotta-orange. Keep both eyes the same size.' },
  { key: 'think', subject: 'tilting its head with one paw on its chin, puzzled curious look with a small floating question mark, "hmm" pose.' },
  { key: 'love', subject: 'happily holding a terracotta-orange heart shape with both paws over its chest, blushing with closed happy eyes. Keep the top of the head pure white.' },
  { key: 'sleep', subject: 'sitting and dozing, eyes closed, a small sleepy bubble at its nose, peaceful sleeping pose.' },
  { key: 'celebrate', subject: 'both paws thrown up cheering with a huge open joyful grin, a few terracotta-orange confetti pieces around, "results are in!" pose.' },
  { key: 'peace', subject: 'flashing a cheeky V peace sign with one paw and a playful wink with tongue slightly out, confident "done!" pose.' },
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

const only = process.argv.slice(2);
const targets = only.length ? POSES.filter((p) => only.includes(p.key)) : POSES;
const refs = await loadRefs();

await fs.mkdir(OUT, { recursive: true });
for (const p of targets) {
  const prompt = `${CHARACTER} New pose: ${p.subject}`;
  process.stdout.write(`▶ mascot-ref-${p.key} ... `);
  try {
    const buf = await editImage(prompt, refs);
    const file = path.join(OUT, `mascot-ref-${p.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/mascot-ref-${p.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
