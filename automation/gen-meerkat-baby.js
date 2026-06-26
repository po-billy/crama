// 미어캣 골드 마스터 — announce 캐릭터 + 통통 감자몸 + 짧은팔/두발 + 크레용 덜칠 + 점눈(테두리X) 아기동물.
//   레퍼런스: mascot-ink-announce(얼굴/캐릭터) + body-meerkat(체형/질감)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');
const REF_FILES = [
  path.join(OUT, 'meerkat-baby-stand.webp'),
  path.join(OUT, 'meerkat-baby-announce.webp'),
];

const CHARACTER =
  'Use the reference images for the character identity and the loose hand-drawn crayon ink style. ' +
  'Draw the SAME meerkat mascot Crama, but redesign the BODY to be a chunky rounded potato-shaped body standing upright on two short stubby legs, ' +
  'short stubby little arms, a big round head, about 2.5 heads tall, like a cute chubby baby animal, soft and huggable. ' +
  'EYES must be EXTREMELY TINY tiny pinprick black DOTS — like two small seeds, even smaller than the reference, almost like sesame seeds, ' +
  'no white highlight, no iris, NO eye outline ring, just minimal little dots, maximally cute and ppojjak. ' +
  'Keep the thin little black eyebrow marks above the eyes. ' +
  'HEAD: the top of the head is covered by a black fur cap that comes down to a small point in the center of the forehead (a widow-peak / heart-dip shape), ' +
  'unify this head shape for every pose. Keep the small pointy snout with a black nose, small upright ears, ' +
  'the terracotta-orange (#b04a2f) knitted scarf, black hands, black feet and a black tail tip. ' +
  'Fill ALL black areas with rough, uneven, scribbled crayon strokes that do NOT fully cover — leave visible white streaks and sketchy ' +
  'texture inside the black fills, not clean solid flat black. Thick rough hand-drawn black ink outline, flat two-tone (white body + black markings) ' +
  'with only the scarf in terracotta. Centered full body, transparent background, no text, no scenery, no shadow.';

const POSES = [
  { key: 'wave', subject: 'standing happily, one little stubby arm waving hello, cheerful tiny-dot-eyed baby face' },
  { key: 'announce', subject: 'one little stubby arm thrown up energetically, cheeky open-mouth grin, lively "come check this out" pose' },
  { key: 'stand', subject: 'standing cute and neutral facing forward, both little arms down, calm happy baby face' },
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
  process.stdout.write(`▶ meerkat-baby-${p.key} ... `);
  try {
    const buf = await editImage(prompt, refs);
    const file = path.join(OUT, `meerkat-baby-${p.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/meerkat-baby-${p.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
