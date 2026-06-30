import 'dotenv/config';
import sharp from 'sharp';
const OUT = '../site/public/img/generated';
const BASE = "Cinematic premium hero-banner image for a modern money & AI magazine, like a sleek film poster. Dramatic rim lighting, real depth and scale, sophisticated and aspirational, photorealistic cinematic (NOT cartoon, not 3D render, no illustration). Keep the LEFT THIRD noticeably darker and uncluttered for white headline text overlay. Absolutely no text, no letters, no logos, no watermark, no charts. Subtle film grain.";
const jobs = [
  { file: 'rotator-column-hero', grade: "Warm amber and honey-gold color grade, cozy and contemplative.", subj: "A person sitting quietly reading by soft warm window light in a calm modern study, seen from the side, reflective mood." },
  { file: 'rotator-tools-hero', grade: "Cool electric blue and cyan color grade, clean and precise.", subj: "An elegant dark desk with a single glowing smartphone and faint blue light streaks reflecting on a glossy surface, sleek fintech mood." },
  { file: 'rotator-glossary-hero', grade: "Deep violet and indigo color grade, mysterious and intellectual.", subj: "A vast dramatic interior of towering library bookshelves receding into the distance, bathed in violet light, sense of knowledge and depth." },
  { file: 'rotator-guide-hero', grade: "Emerald green and warm gold sunrise color grade, hopeful and upward.", subj: "An aspirational cinematic sunrise over a modern city skyline of skyscrapers, golden-green light breaking through, a sense of a new beginning." },
  { file: 'rotator-quiz-hero', grade: "Vibrant magenta and pink neon color grade, playful and energetic.", subj: "A modern minimalist scene glowing with playful magenta and pink neon light against deep shadow, dynamic and fun, abstract energetic mood." },
];
for (const j of jobs) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-2', prompt: `${BASE} ${j.grade} Subject: ${j.subj}`, size: '1536x1024', quality: 'high', n: 1 }),
  });
  if (!res.ok) { console.log('[ERROR]', j.file, res.status, (await res.text()).slice(0,200)); continue; }
  const b64 = (await res.json()).data?.[0]?.b64_json;
  if (!b64) { console.log('[빈응답]', j.file); continue; }
  const buf = Buffer.from(b64, 'base64');
  await sharp(buf).resize(1536, 864, { fit: 'cover', position: 'left' }).webp({ quality: 86 }).toFile(`${OUT}/${j.file}.webp`);
  await sharp(buf).resize(1080, 1350, { fit: 'cover', position: 'attention' }).webp({ quality: 84 }).toFile(`${OUT}/${j.file}-m.webp`);
  console.log('[OK]', j.file);
}
