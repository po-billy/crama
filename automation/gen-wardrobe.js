// Crama 옷장 파츠 생성 — gpt-image-1.
//   - 모자/안경: 투명 배경 단독 오브젝트(얹는 느낌) — /images/generations
//   - 의상/스카프: 마스코트(스카프 제거본)를 레퍼런스로 '몸에 핏'하게 생성 — /images/edits (풀캔버스 정렬 오버레이)
//   - 바닥/벽지: 불투명 배경 이미지
//   사용법: node gen-wardrobe.js [id1 id2 ...]  (생략 시 전체)
//   출력: ../site/public/img/wardrobe/<id>.webp
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/wardrobe');
const BASE_REF = path.resolve('../site/public/img/generated/meerkat-baby-stand-noscarf.webp');

const STYLE =
  'Cute hand-drawn cartoon style with a rough black ink outline and flat colors with light crayon texture, ' +
  'matching a children-book mascot sticker look. Front view, centered, simple, no shadow, no text.';

const BG_STYLE =
  'Flat hand-drawn cartoon background surface with a soft crayon paper texture. ' +
  'ABSOLUTELY NO characters, NO animals, NO faces, NO objects, NO mascots — ' +
  'ONLY the flat background surface filling the entire frame edge to edge. No text, no shadow.';

// 의상/스카프 컨디셔닝 공통 문구
const GUIDE = 'The attached image is a baby meerkat character used ONLY as a body-shape/position guide. Output a transparent PNG on the SAME canvas and SAME scale.';
const NEG_GARMENT = 'Do NOT draw the meerkat, its head, face, eyes, ears, legs or tail — ONLY the garment, everything else fully transparent. Rough hand-drawn crayon ink cartoon style, bold black outline matching the reference line weight.';
const NEG_SCARF = 'Do NOT draw the meerkat head/face/body, and do NOT draw any part that loops BEHIND the neck or behind the head — only the front-facing visible portion of the scarf. Everything else fully transparent. Rough hand-drawn crayon ink cartoon style, bold black outline.';

// 모자/안경 — 단독 오브젝트(투명)
const PARTS = [
  { id: 'hat_beanie', kind: 'part', desc: 'a chunky knitted beanie hat in warm brown (#8a5a3b) with a folded knit cuff, just the hat' },
  { id: 'hat_cap', kind: 'part', desc: 'a baseball cap in blue (#34568a) with a curved brim, front view, just the cap' },
  { id: 'hat_crown', kind: 'part', desc: 'a small cute golden crown (#e2b13a) with rounded points and tiny round gems, just the crown' },
  { id: 'gls_round', kind: 'part', desc: 'a pair of round eyeglasses with thin dark frames (#2b2b2b) and clear lenses, front view, just the glasses' },
  { id: 'gls_sun', kind: 'part', desc: 'a pair of cool sunglasses with solid black lenses (#111111) and dark frames, front view, just the sunglasses' },
  // 추가 모자
  { id: 'hat_cowboy', kind: 'part', desc: 'a brown leather cowboy hat with a wide curved brim and a band, front view, just the hat' },
  { id: 'hat_party', kind: 'part', desc: 'a colorful cone-shaped birthday party hat with diagonal stripes and a small pom-pom on top, front view, just the hat' },
  { id: 'hat_chef', kind: 'part', desc: 'a tall puffy white chef toque hat, front view, just the hat' },
  // 추가 안경
  { id: 'gls_heart', kind: 'part', desc: 'a pair of cute pink heart-shaped sunglasses with rosy tinted lenses, front view, just the glasses' },
  { id: 'gls_3d', kind: 'part', desc: 'a pair of retro paper 3D glasses with one red lens and one cyan-blue lens, dark frame, front view, just the glasses' },
  { id: 'gls_star', kind: 'part', desc: 'a pair of playful yellow star-shaped novelty sunglasses, front view, just the glasses' },
];

// 스카프 — 몸에 핏(레퍼런스 컨디셔닝). (의상 out_*은 사용자 제작 이미지 사용 → 여기 없음)
const FITTED = [
  { id: 'scf_terra', kind: 'fitted', prompt: `${GUIDE} Draw ONLY the FRONT of a chunky knitted scarf in terracotta orange (#b04a2f) wrapping the front of the neck and draping down the chest. ${NEG_SCARF}` },
  { id: 'scf_blue', kind: 'fitted', prompt: `${GUIDE} Draw ONLY the FRONT of a chunky knitted scarf in teal blue (#2a6f97) wrapping the front of the neck and draping down the chest. ${NEG_SCARF}` },
];

// 바닥/벽지 — 불투명 배경
const BACKDROPS = [
  { id: 'flr_wood', kind: 'floor', desc: 'a simple flat warm tan wooden plank floor (#caa472), gentle top-down angle, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_grass', kind: 'floor', desc: 'simple cute cartoon green grass ground (#7da453) with a few tiny blades, hand-drawn, seamless horizontal' },
  { id: 'flr_tile', kind: 'floor', desc: 'a clean checkerboard tile floor in soft cream and warm gray, gentle top-down angle, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_carpet', kind: 'floor', desc: 'a cozy plush carpet floor in warm dusty-rose with a simple woven pattern, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_sand', kind: 'floor', desc: 'a sunny beach sand floor in light golden tan with a few tiny pebbles and ripples, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_marble', kind: 'floor', desc: 'a polished white marble floor with subtle soft gray veins, hand-drawn cartoon, seamless horizontal' },
  { id: 'flr_cloud', kind: 'floor', desc: 'a dreamy floor made of fluffy soft white clouds on pale blue, pastel, hand-drawn cartoon, seamless horizontal' },
  { id: 'wal_cream', kind: 'wall', desc: 'a plain cozy cream-colored wall (#f0e4cf) with a very subtle soft polka pattern, flat hand-drawn cartoon background' },
  { id: 'wal_night', kind: 'wall', desc: 'a cute deep navy night-sky wall (#27314a) with small simple white stars, flat hand-drawn cartoon background' },
  { id: 'wal_sky', kind: 'wall', desc: 'a bright cheerful blue daytime sky wall with a few fluffy white clouds, flat hand-drawn cartoon background' },
  { id: 'wal_pink', kind: 'wall', desc: 'a soft pastel pink wall with a scattered tiny heart pattern, flat hand-drawn cartoon background' },
  { id: 'wal_mint', kind: 'wall', desc: 'a fresh mint-green wall with subtle soft vertical stripes, flat hand-drawn cartoon background' },
  { id: 'wal_forest', kind: 'wall', desc: 'a cozy forest-green wall with simple leaf and foliage silhouettes, flat hand-drawn cartoon background' },
  { id: 'wal_space', kind: 'wall', desc: 'a deep purple outer-space wall with small twinkling stars and one tiny cute planet, flat hand-drawn cartoon background' },
];

const ALL = [...PARTS, ...FITTED, ...BACKDROPS];

async function genImage(prompt, transparent) {
  const body = { model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1', prompt, size: '1024x1024', n: 1 };
  if (transparent) body.background = 'transparent';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('OpenAI error: ' + (await res.text()));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}

async function editFitted(prompt) {
  const png = await sharp(await fs.readFile(BASE_REF)).png().toBuffer();
  const fd = new FormData();
  fd.set('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  fd.set('prompt', prompt);
  fd.set('size', '1024x1024');
  fd.set('background', 'transparent');
  fd.append('image[]', new Blob([png], { type: 'image/png' }), 'ref.png');
  const res = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: fd,
  });
  if (!res.ok) throw new Error('OpenAI edits error: ' + (await res.text()));
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) throw new Error('빈 응답');
  return Buffer.from(b64, 'base64');
}

async function save(item, buf) {
  const file = path.join(OUT, `${item.id}.webp`);
  let img = sharp(buf);
  if (item.kind === 'part') img = img.resize({ width: 512, height: 512, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  else if (item.kind === 'fitted') img = img.resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  else if (item.kind === 'floor') img = img.resize({ width: 768, height: 320, fit: 'cover', position: 'centre' });
  else img = img.resize({ width: 768, height: 960, fit: 'cover', position: 'centre' });
  await img.webp({ quality: 84, alphaQuality: 100 }).toFile(file);
}

const only = process.argv.slice(2);
const targets = only.length ? ALL.filter((p) => only.includes(p.id)) : ALL;
await fs.mkdir(OUT, { recursive: true });

for (const item of targets) {
  process.stdout.write(`▶ ${item.id} ... `);
  try {
    let buf;
    if (item.kind === 'fitted') buf = await editFitted(item.prompt);
    else if (item.kind === 'part') {
      // 안경류는 다리(템플) 없이 — 걸치듯 앞면만
      const extra = item.id.startsWith('gls_') ? ' Show ONLY the FRONT of the glasses (the two lenses and the bridge) with NO side temple arms or legs at all, as if just the front is perched on the face.' : '';
      buf = await genImage(`${item.desc}.${extra} ${STYLE} On a fully transparent background — only the object, nothing else, no character, no background.`, true);
    }
    else buf = await genImage(`${item.desc}. ${BG_STYLE}`, false);
    await save(item, buf);
    console.log('완료 → /img/wardrobe/' + item.id + '.webp');
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n완료');
