// 발행 글 오디오 생성: 빌드된 HTML(실제 화면) → Azure Neural TTS(mp3 + 청크 타임스탬프) → R2 업로드 → frontmatter audio: 갱신
//   단건:   node gen-audio.js <slug>
//   전체:   node gen-audio-all.js
//   ※ 추출은 site/dist 의 빌드 결과에서 하므로, 먼저 `cd site && npm run build` 가 되어 있어야 한다.
//   필요 env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, R2_*( + R2_AUDIO_BUCKET / R2_AUDIO_PUBLIC_BASE )
import 'dotenv/config';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from 'node-html-parser';
import { ROOT, BLOG_DIR } from './lib/util.js';
import { synthesize, buildSsml } from './lib/azure-tts.js';
import { putObject, r2Configured } from './lib/r2.js';

const VOICE = process.env.AZURE_TTS_VOICE || 'ko-KR-SunHiNeural';
const AUDIO_BUCKET = process.env.R2_AUDIO_BUCKET || process.env.R2_BUCKET;
const AUDIO_BASE = process.env.R2_AUDIO_PUBLIC_BASE || process.env.R2_PUBLIC_BASE || '';
const BATCH_CHARS = 2600; // Azure 단일 요청(~10분 오디오) 안전 한도로 청크를 묶어 분할 합성
const DIST = path.join(ROOT, 'site', 'dist');
const BLOCK_SEL = 'p, li, h2, h3, h4, blockquote, summary, figcaption';

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&hellip;/g, '…');
}

// 문장 단위 분할 — 클라이언트 플레이어의 pushSentences 와 동일(하이라이트 인덱스 일치)
function pushSentences(out, text) {
  const sentences = String(text).replace(/\s+/g, ' ').match(/[^.!?。…\n]+[.!?。…]?/g) || [text];
  for (let s of sentences) {
    s = s.trim();
    if (!s) continue;
    if (s.length <= 180) { out.push(s); continue; }
    let buf = '';
    for (const part of s.split(/(?<=[,;:、])\s*/)) {
      if ((buf + part).length > 180) { if (buf) out.push(buf.trim()); buf = part; }
      else buf += part;
    }
    if (buf.trim()) out.push(buf.trim());
  }
}

// 빌드된 글 HTML에서 제목 + 본문 블록을 클라이언트 buildChunks 와 동일 규칙으로 추출
export function articleChunks(slug) {
  const file = path.join(DIST, 'blog', slug, 'index.html');
  let html;
  try { html = readFileSync(file, 'utf8'); }
  catch (e) { throw new Error('빌드 HTML 없음(먼저 site 빌드): ' + path.relative(ROOT, file)); }
  const dom = parse(html);
  const out = [];
  const titleEl = dom.querySelector('.article-head h1');
  if (titleEl) pushSentences(out, decodeEntities(titleEl.text.trim()));
  const prose = dom.querySelector('.prose');
  if (prose) {
    for (const el of prose.querySelectorAll(BLOCK_SEL)) {
      if (el.querySelector(BLOCK_SEL)) continue; // 말단 블록만(중첩 중복 방지)
      const t = decodeEntities(el.text.trim());
      if (t) pushSentences(out, t);
    }
  }
  return out;
}

// 청크 배열을 BATCH_CHARS 단위로 나눠 합성 후 오디오 이어붙이고, 전역 타임스탬프(ms) 계산
async function synthChunks(chunks, key, region) {
  const batches = [];
  let cur = [], curLen = 0, startIdx = 0;
  for (let i = 0; i < chunks.length; i++) {
    if (curLen + chunks[i].length > BATCH_CHARS && cur.length) { batches.push({ startIdx, chunks: cur }); cur = []; curLen = 0; startIdx = i; }
    cur.push(chunks[i]); curLen += chunks[i].length;
  }
  if (cur.length) batches.push({ startIdx, chunks: cur });

  const parts = [];
  const timed = chunks.map((text) => ({ t: null, text }));
  let offset = 0;
  for (let b = 0; b < batches.length; b++) {
    const { startIdx: si, chunks: bc } = batches[b];
    const { audio, marks, durationMs } = await synthesize({ key, region, ssml: buildSsml(bc, VOICE) });
    parts.push(audio);
    for (const mk of marks) {
      const gi = si + parseInt(String(mk.mark).slice(1), 10);
      if (gi >= 0 && gi < timed.length) timed[gi].t = offset + mk.t;
    }
    offset += durationMs;
    if (batches.length > 1) console.log(`  · 배치 ${b + 1}/${batches.length} 합성(${bc.length}청크)`);
  }
  return { audio: Buffer.concat(parts), timed, durationMs: offset };
}

// 한 글의 오디오 생성/업로드/frontmatter 갱신. 이미 audio: 있으면 force 아닐 때 건너뜀.
export async function generateAudio(slug, { force = false } = {}) {
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) throw new Error('AZURE_SPEECH_KEY/REGION 누락(.env)');
  if (!r2Configured()) throw new Error('R2_* 누락(.env)');
  if (!AUDIO_BASE) throw new Error('R2_AUDIO_PUBLIC_BASE 누락(.env)');

  let mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
  let mdx = await fs.readFile(mdxPath, 'utf8').catch(() => null);
  if (mdx == null) { mdxPath = path.join(BLOG_DIR, `${slug}.md`); mdx = await fs.readFile(mdxPath, 'utf8').catch(() => null); }
  if (mdx == null) throw new Error('글을 찾을 수 없음: ' + slug);
  if (/^\s*audio:/m.test(mdx) && !force) return { slug, skipped: true };

  const chunks = articleChunks(slug);
  if (!chunks.length) throw new Error('본문 추출 0청크: ' + slug);
  const totalChars = chunks.reduce((n, c) => n + c.length, 0);

  const { audio, timed, durationMs } = await synthChunks(chunks, process.env.AZURE_SPEECH_KEY, process.env.AZURE_SPEECH_REGION);

  const audioUrl = await putObject({ key: `audio/${slug}.mp3`, body: audio, contentType: 'audio/mpeg', bucket: AUDIO_BUCKET, publicBase: AUDIO_BASE });
  await putObject({ key: `audio/${slug}.json`, body: JSON.stringify({ voice: VOICE, durationMs, chunks: timed }), contentType: 'application/json', bucket: AUDIO_BUCKET, publicBase: AUDIO_BASE });

  if (/^\s*audio:.*$/m.test(mdx)) mdx = mdx.replace(/^\s*audio:.*$/m, `audio: '${audioUrl}'`);
  else mdx = mdx.replace(/^(title:.*)$/m, `$1\naudio: '${audioUrl}'`);
  await fs.writeFile(mdxPath, mdx, 'utf8');

  return { slug, chars: totalChars, durationMs, url: audioUrl };
}

// CLI 단건 실행
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const slug = process.argv[2];
  if (!slug) { console.error('사용법: node gen-audio.js <slug>'); process.exit(1); }
  const force = process.argv.includes('--force');
  generateAudio(slug, { force })
    .then((r) => {
      if (r.skipped) console.log('[audio] 이미 있음(건너뜀):', slug, '— 다시 만들려면 --force');
      else console.log(`[audio] 완료 ${slug} — ${r.chars}자 / ${(r.durationMs / 1000).toFixed(0)}초 →`, r.url);
    })
    .catch((e) => { console.error('[audio] 실패:', e.message || e); process.exit(1); });
}
