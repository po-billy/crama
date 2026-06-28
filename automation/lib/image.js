import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * 히어로 이미지 생성. provider = openai | stability | placeholder
 * 생성 후 webp(가로 1200, 품질 80)로 변환해 페이지 속도/SEO 최적화.
 * 반환: { file, publicPath }
 */
export async function generateHero({ prompt, slug, outDir, provider }) {
  provider = provider || process.env.IMAGE_PROVIDER || 'placeholder';
  await fs.mkdir(outDir, { recursive: true });

  if (provider === 'placeholder') {
    const file = path.join(outDir, `${slug}-hero.svg`);
    await fs.writeFile(file, placeholderSvg(prompt));
    return { file, publicPath: `/img/generated/${slug}-hero.svg` };
  }

  let buf;
  if (provider === 'openai') buf = await openai(prompt);
  else if (provider === 'stability') buf = await stability(prompt);
  else throw new Error('unknown image provider: ' + provider);

  const file = path.join(outDir, `${slug}-hero.webp`);
  // 16:9로 통일 — 카드(.card__media 16/9)·썸네일(1280×720)과 동일 비율. gpt-image-1은 3:2 생성이라 위아래만 약간 크롭.
  await sharp(buf)
    .resize(1536, 864, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80 })
    .toFile(file);
  return { file, publicPath: `/img/generated/${slug}-hero.webp` };
}

async function openai(prompt) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, prompt, size: '1536x1024', n: 1 }),
  });
  if (!res.ok) throw new Error('OpenAI image error: ' + (await res.text()));
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: 빈 응답');
  return Buffer.from(b64, 'base64');
}

async function stability(prompt) {
  const res = await fetch(
    'https://api.stability.ai/v2beta/stable-image/generate/core',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
        Accept: 'image/*',
      },
      body: (() => {
        const fd = new FormData();
        fd.set('prompt', prompt);
        fd.set('aspect_ratio', '16:9');
        fd.set('output_format', 'png');
        return fd;
      })(),
    },
  );
  if (!res.ok) throw new Error('Stability image error: ' + (await res.text()));
  return Buffer.from(await res.arrayBuffer());
}

function placeholderSvg(prompt) {
  const label = (prompt || 'Crama').slice(0, 40).replace(/[<>&]/g, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#f3f1ec"/>
  <rect width="1600" height="12" fill="#b04a2f"/>
  <text x="80" y="470" font-family="Georgia, serif" font-size="54" fill="#1a1a1a">Crama</text>
  <text x="80" y="540" font-family="sans-serif" font-size="26" fill="#6b6862">${label}…</text>
</svg>`;
}
