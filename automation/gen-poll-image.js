// 투표(poll)별 커버 이미지 — 깔끔한 흑백 + 1~2색 강조(브랜드 톤 아님) → R2 → polls.image 업데이트
//   CLI:
//     node gen-poll-image.js <pollId>                  poll 질문을 주제로 생성
//     node gen-poll-image.js <pollId> --prompt "주제"   주제 직접 지정
//     node gen-poll-image.js <pollId> --ref <이미지경로> 레퍼런스 이미지를 깔끔 스타일로 재해석
//     node gen-poll-image.js --latest                   가장 최근 활성 투표
//     node gen-poll-image.js --all-missing              이미지 없는 활성 투표 전부
//     (옵션) --accent "deep blue"
//   프로그램: import { generatePollImage } from './gen-poll-image.js'  (gen-poll.js가 새 투표에 자동 첨부)
import 'dotenv/config';
import dotenv from 'dotenv';
import pg from 'pg';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { putObject } from './lib/r2.js';

dotenv.config({ path: '../supabase/.env' });

export function pollDbClient() {
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  const ref = process.env.SUPABASE_PROJECT_REF || 'dqwzqirrzelzfngyrcmw';
  const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-2.pooler.supabase.com';
  if (!pwd) throw new Error('SUPABASE_DB_PASSWORD 없음(.env)');
  return new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password: pwd, database: 'postgres', ssl: { rejectUnauthorized: false } });
}

const STYLE = (subject, accent) =>
  `A clean, minimal, modern conceptual cover illustration representing: "${subject}". ` +
  `Strictly black and white with ${accent ? `"${accent}" as the only accent color` : 'just one or two bold accent colors that suit the topic'}. ` +
  'Flat simple geometric shapes, bold high contrast, lots of negative space, crisp and tidy, a single clear visual metaphor. ' +
  'Modern editorial / app illustration look. No heavy gradients, no warm earth tones, NO terracotta, no brown, no beige. ' +
  'Clean white or very light background. No text, no words, no letters, no numbers, no logos.';

async function genImageBuf(subject, { accent, refPath } = {}) {
  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const key = process.env.OPENAI_API_KEY;
  if (refPath) {
    const fd = new FormData();
    fd.append('model', model);
    fd.append('prompt', `Restyle this into: ${STYLE(subject, accent)}`);
    fd.append('size', '1536x1024');
    fd.append('image', new Blob([readFileSync(refPath)]), 'ref.png');
    const r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
    if (!r.ok) throw new Error('OpenAI edits: ' + (await r.text()));
    return Buffer.from((await r.json()).data[0].b64_json, 'base64');
  }
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt: STYLE(subject, accent), size: '1536x1024', n: 1, output_format: 'png' }),
  });
  if (!r.ok) throw new Error('OpenAI gen: ' + (await r.text()));
  return Buffer.from((await r.json()).data[0].b64_json, 'base64');
}

/** 이미 연결된 pg 클라이언트로 한 투표의 커버를 생성·업로드·DB반영. URL 반환. */
export async function generatePollImage(c, id, question, opts = {}) {
  const subject = opts.prompt || question;
  const raw = await genImageBuf(subject, opts);
  const webp = await sharp(raw).resize(1200, 800, { fit: 'cover' }).webp({ quality: 86 }).toBuffer();
  const url = await putObject({
    key: `polls/${id}.webp`, body: webp, contentType: 'image/webp',
    bucket: process.env.R2_CARDS_BUCKET, publicBase: process.env.R2_CARDS_PUBLIC_BASE, cache: false,
  });
  if (!/^https?:\/\//.test(url)) throw new Error('R2 공개 URL 아님 — R2_CARDS_PUBLIC_BASE 확인');
  await c.query('update polls set image=$1 where id=$2', [url, id]);
  return url;
}

// ── CLI ──
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const has = (k) => args.includes(k);
  const opts = { prompt: flag('--prompt'), refPath: flag('--ref'), accent: flag('--accent') };
  (async () => {
    const c = pollDbClient();
    await c.connect();
    try {
      await c.query('alter table polls add column if not exists image text');
      let targets = [];
      if (has('--latest')) targets = (await c.query('select id, question from polls where active order by created_at desc limit 1')).rows;
      else if (has('--all-missing')) targets = (await c.query("select id, question from polls where active and (image is null or image='') order by created_at desc")).rows;
      else {
        const id = Number(args.find((a) => /^\d+$/.test(a)));
        if (!id) { console.error('사용법: node gen-poll-image.js <pollId> | --latest | --all-missing'); process.exit(1); }
        targets = (await c.query('select id, question from polls where id=$1', [id])).rows;
        if (!targets.length) throw new Error('해당 id의 투표 없음');
      }
      if (!targets.length) { console.log('대상 없음'); return; }
      for (const t of targets) {
        process.stdout.write(`▶ poll ${t.id} — ${String(t.question).slice(0, 36)} ... `);
        try { console.log('완료 →', await generatePollImage(c, t.id, t.question, opts)); }
        catch (e) { console.log('실패:', e.message); }
      }
    } finally { await c.end(); }
  })().catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
