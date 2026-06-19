import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 히어로 이미지 생성. provider = openai | stability | placeholder
 * 반환: { file: 저장경로, publicPath: 사이트에서 참조할 경로 }
 */
export async function generateHero({ prompt, slug, outDir, provider }) {
  provider = provider || process.env.IMAGE_PROVIDER || 'placeholder';
  await fs.mkdir(outDir, { recursive: true });

  if (provider === 'openai') {
    const file = path.join(outDir, `${slug}-hero.png`);
    await openai(prompt, file);
    return { file, publicPath: `/img/generated/${slug}-hero.png` };
  }
  if (provider === 'stability') {
    const file = path.join(outDir, `${slug}-hero.png`);
    await stability(prompt, file);
    return { file, publicPath: `/img/generated/${slug}-hero.png` };
  }
  // 키 없이 테스트: SVG 더미
  const file = path.join(outDir, `${slug}-hero.svg`);
  await fs.writeFile(file, placeholderSvg(prompt));
  return { file, publicPath: `/img/generated/${slug}-hero.svg` };
}

async function openai(prompt, file) {
  // gpt-image-1: 최신 이미지 모델. b64_json 기본 반환(response_format 없음).
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      size: '1536x1024', // 가로형(≈3:2) 히어로
      n: 1,
    }),
  });
  if (!res.ok) throw new Error('OpenAI image error: ' + (await res.text()));
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image: 빈 응답');
  await fs.writeFile(file, Buffer.from(b64, 'base64'));
}

async function stability(prompt, file) {
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
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
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
