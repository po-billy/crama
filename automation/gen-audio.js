// 발행 글 오디오 생성: 본문 → Azure Neural TTS(mp3 + 청크 타임스탬프) → R2 업로드 → frontmatter 의 audio: 갱신
//   사용법: node gen-audio.js <slug>
//   필요 env: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, R2_*( + R2_AUDIO_BUCKET / R2_AUDIO_PUBLIC_BASE )
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { BLOG_DIR } from './lib/util.js';
import { synthesize, buildSsml } from './lib/azure-tts.js';
import { putObject, r2Configured } from './lib/r2.js';

const VOICE = process.env.AZURE_TTS_VOICE || 'ko-KR-SunHiNeural';
const AUDIO_BUCKET = process.env.R2_AUDIO_BUCKET || process.env.R2_BUCKET;
const AUDIO_BASE = process.env.R2_AUDIO_PUBLIC_BASE || process.env.R2_PUBLIC_BASE || '';

// 본문(MDX) → 읽을 수 있는 평문 (마크다운/JSX 제거)
function mdxToText(src) {
  let s = src.replace(/^---[\s\S]*?\n---\n/, ''); // frontmatter
  s = s.replace(/^import .*$/gm, ''); // import 라인
  s = s.replace(/```[\s\S]*?```/g, ' '); // 코드블록
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, ' '); // 이미지
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // 링크 → 텍스트
  s = s.replace(/<[^>]+>/g, ' '); // JSX/HTML 태그(안쪽 텍스트 유지)
  s = s.replace(/\{[^}]*\}/g, ' '); // JSX 표현식
  s = s.replace(/^#{1,6}\s*/gm, ''); // 헤딩 마커
  s = s.replace(/^>\s?/gm, ''); // 인용
  s = s.replace(/^\s*[-*+]\s+/gm, ''); // 불릿
  s = s.replace(/^\s*\d+\.\s+/gm, ''); // 번호목록
  s = s.replace(/[*_`~]/g, ''); // 강조/코드 마커
  return s.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

// 클라이언트 플레이어의 pushSentences 와 동일한 청크 분할(하이라이트 인덱스 일치용)
function splitChunks(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const sentences = t.replace(/\s+/g, ' ').match(/[^.!?。…\n]+[.!?。…]?/g) || [t];
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
  return out;
}

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('사용법: node gen-audio.js <slug>'); process.exit(1); }
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    console.error('환경변수 누락: AZURE_SPEECH_KEY / AZURE_SPEECH_REGION (.env)'); process.exit(1);
  }
  if (!r2Configured()) { console.error('환경변수 누락: R2_* (.env)'); process.exit(1); }
  if (!AUDIO_BASE) { console.error('환경변수 누락: R2_AUDIO_PUBLIC_BASE(또는 R2_PUBLIC_BASE)'); process.exit(1); }

  // 글 파일 로드(.mdx 우선, .md 폴백)
  let mdxPath = path.join(BLOG_DIR, `${slug}.mdx`);
  let mdx = await fs.readFile(mdxPath, 'utf8').catch(() => null);
  if (mdx == null) {
    mdxPath = path.join(BLOG_DIR, `${slug}.md`);
    mdx = await fs.readFile(mdxPath, 'utf8').catch(() => null);
  }
  if (mdx == null) { console.error('글을 찾을 수 없음:', slug); process.exit(1); }

  const title = (mdx.match(/title:\s*['"]?(.+?)['"]?\s*$/m) || [])[1] || slug;
  const bodyText = mdxToText(mdx);
  // 클라이언트는 제목을 먼저 읽으므로 동일하게 제목을 0번 청크로
  const chunks = [title, ...splitChunks(bodyText)].filter(Boolean);
  const totalChars = chunks.reduce((n, c) => n + c.length, 0);
  console.log(`[audio] ${slug} — 청크 ${chunks.length}개 / ${totalChars}자 / 음성 ${VOICE}`);

  const ssml = buildSsml(chunks, VOICE);
  const { audio, marks, durationMs } = await synthesize({
    key: process.env.AZURE_SPEECH_KEY,
    region: process.env.AZURE_SPEECH_REGION,
    ssml,
  });
  console.log(`[audio] 합성 완료 — ${(audio.length / 1024).toFixed(0)}KB / ${(durationMs / 1000).toFixed(0)}초 / 마크 ${marks.length}개`);

  const markTime = {};
  for (const m of marks) markTime[m.mark] = m.t;
  const timed = chunks.map((text, i) => ({ t: markTime['c' + i] ?? null, text }));

  const mp3Key = `audio/${slug}.mp3`;
  const jsonKey = `audio/${slug}.json`;
  const audioUrl = await putObject({ key: mp3Key, body: audio, contentType: 'audio/mpeg', bucket: AUDIO_BUCKET, publicBase: AUDIO_BASE });
  await putObject({
    key: jsonKey,
    body: JSON.stringify({ voice: VOICE, durationMs, chunks: timed }),
    contentType: 'application/json',
    bucket: AUDIO_BUCKET,
    publicBase: AUDIO_BASE,
  });
  console.log('[audio] 업로드 완료 →', audioUrl);

  // frontmatter 의 audio: 갱신(있으면 교체, 없으면 title 아래 삽입)
  if (/^\s*audio:.*$/m.test(mdx)) mdx = mdx.replace(/^\s*audio:.*$/m, `audio: '${audioUrl}'`);
  else mdx = mdx.replace(/^(title:.*)$/m, `$1\naudio: '${audioUrl}'`);
  await fs.writeFile(mdxPath, mdx, 'utf8');
  console.log('[audio] frontmatter audio: 갱신 완료 →', path.basename(mdxPath));
}

main().catch((e) => { console.error('[audio] 실패:', e.message || e); process.exit(1); });
