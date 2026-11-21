// 분야 표지 그림(site/public/img/portal/g-{slug}.webp) 생성. 기존 표지와 같은 '부드러운 단색 배경 + 광택 3D 소품' 톤.
//   사용법: node gen-portal-cover.js mom
import 'dotenv/config';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/portal');
const STYLE =
  'polished glossy 3D app illustration, soft rounded shapes, gentle studio lighting, a few small white sparkle stars, ' +
  'objects grouped in the center, plain soft solid pastel background with one large faint rounded blob shape, ' +
  'no text, no words, no letters, no numbers, no people faces';

const COVERS = {
  party: { subject: 'three shiny colorful glass marbles rolling down a small curved track, a tiny checkered finish flag, and a little round bomb toy with a short fuse', bg: 'soft pastel lavender background' },
  live: { subject: 'a small retro streaming camera with a red recording light, a round microphone on a short stand, and a small round countdown stopwatch, no logos', bg: 'soft pastel coral pink background' },
  mom: { subject: 'a cute pastel pink baby bottle, a small folded baby onesie, and a calendar card with a heart mark', bg: 'soft pastel pink background' },
};

const slug = process.argv[2];
const c = COVERS[slug];
if (!c) { console.log('알 수 없는 slug:', slug, '— 가능한 값:', Object.keys(COVERS).join(', ')); process.exit(1); }

const res = await fetch('https://api.openai.com/v1/images/generations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  body: JSON.stringify({ model: process.env.OPENAI_PORTAL_MODEL || 'gpt-image-2.6-sunburst', prompt: `${c.subject}, ${c.bg}. ${STYLE}`, size: '1024x1024', quality: 'high', n: 1 }),
});
if (!res.ok) { console.log('OpenAI 오류:', await res.text()); process.exit(1); }
const b64 = (await res.json()).data?.[0]?.b64_json;
if (!b64) { console.log('빈 응답'); process.exit(1); }
const file = path.join(OUT, `g-${slug}.webp`);
await sharp(Buffer.from(b64, 'base64')).resize(640, 640).webp({ quality: 82 }).toFile(file);
console.log('완료 →', file);
