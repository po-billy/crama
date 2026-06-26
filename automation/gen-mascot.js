// Crama 마스코트(미어캣 '크라미') 시안 생성 — 정사각 투명 webp.
//   사용법: node gen-mascot.js [pose1 pose2 ...]   (생략 시 전체)
//   - OpenAI 이미지 API(automation/.env의 OPENAI_API_KEY)
//   - 스타일: 사이트 기존 캐릭터와 동일한 claymation 3D 토이 룩
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('../site/public/img/generated');

// 크라미 고정 외형: 사막 모래색 미어캣 + 테라코타(#b04a2f) 머플러 + 작은 망원경
const CHAR =
  'a cute friendly meerkat mascot character named Krami, sandy tan soft fur, big curious shiny eyes, ' +
  'small upright body, wearing a small terracotta-orange (#b04a2f) knitted neck scarf as its signature brand item';

const STYLE =
  'bold hand-drawn marker and ink illustration in the style of a Korean editorial cartoon mascot like Newneek gosum, ' +
  'thick rough black brush outline, completely flat two-tone: PURE WHITE body with bold SOLID BLACK markings only (black ears, black paws and feet, black eye patches, black tail tip), ' +
  'absolutely no beige, tan, gray or brown fur fill anywhere, only a single terracotta-orange (#b04a2f) flat accent color used on the knitted scarf and on any small held prop, ' +
  'no gradients, no shading, high contrast, playful exaggerated comedic expression, simple dot eyes and a small nose, ' +
  'chunky rounded sticker-like body, iconic minimal look, centered full body, consistent character design, ' +
  'no text, no words, no letters, no speech bubbles, isolated on a fully transparent background, no scenery, no floor, no shadow';

const POSES = [
  { key: 'notice', subject: 'holding a megaphone up with one paw and shouting an announcement, mouth wide open, eyebrows up, energetic "listen up!" pose' },
  { key: 'newsletter', subject: 'cheerfully holding out a sealed envelope letter toward the viewer with both paws, warm inviting smile, "here is your newsletter" gesture' },
  { key: 'vote', subject: 'dropping a folded paper ballot into a ballot box, looking pleased and a little smug, civic "cast your vote" pose' },
  { key: 'recommend', subject: 'holding up an open newspaper in one paw and giving an enthusiastic thumbs-up with the other, big approving grin, "you gotta read this" pose' },
  { key: 'live', subject: 'standing on tiptoes holding small binoculars up to its eyes with both paws, peeking far away, alert curious "I spot it first" vibe' },
  { key: 'think', subject: 'tilting its head with one paw on its chin, puzzled curious squint and a small question-mark expression, "hmm, let me think" pose' },
  { key: 'love', subject: 'happily holding up a big heart shape with both paws over its chest, blushing delighted face with closed happy eyes, adorable "love it" reaction' },
  { key: 'sleep', subject: 'curled up dozing while sitting, eyes closed, a little sleepy bubble at its nose, peaceful "nothing here yet" sleeping pose' },
  { key: 'celebrate', subject: 'both paws thrown up in the air cheering with a huge open joyful grin, confetti bursting around, triumphant "the results are in!" celebration pose' },
  { key: 'peace', subject: 'flashing a cheeky V peace sign with one paw and giving a playful wink with its tongue slightly out, confident "done, voted!" pose' },
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
  process.stdout.write(`▶ mascot-ink-${p.key} ... `);
  try {
    const buf = await openaiImage(prompt);
    const file = path.join(OUT, `mascot-ink-${p.key}.webp`);
    await sharp(buf)
      .resize({ width: 768, height: 768, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 82, alphaQuality: 100 })
      .toFile(file);
    console.log('완료 →', `/img/generated/mascot-ink-${p.key}.webp`);
  } catch (e) {
    console.log('실패:', e.message);
  }
}
console.log('\n전체 완료');
