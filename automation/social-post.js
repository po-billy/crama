// 인스타그램 캐러셀 자동 게시 — output/cards/<slug>/ 의 01~.png + caption.txt(인스타 블록)를
// R2 공개 URL로 올린 뒤 Instagram Graph API로 캐러셀을 발행하고, posted.json에 기록한다.
//   node social-post.js <slug>          실제 게시
//   node social-post.js <slug> --dry    이미지 업로드·캡션·URL만 확인(게시 안 함, 토큰 불필요)
//   node social-post.js <slug> --no-mark  게시하되 기록은 생략
//
// 필요 env(.env): R2_*(이미지 호스팅, 기존 것 재사용) + IG_USER_ID, IG_ACCESS_TOKEN
//   IG_USER_ID      = 인스타 비즈니스 계정의 Graph user-id
//   IG_ACCESS_TOKEN = 장기/시스템 사용자 액세스 토큰(instagram_basic, instagram_content_publish)
//   (선택) IG_GRAPH_VERSION 기본 v21.0
import 'dotenv/config';
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT_DIR, log } from './lib/util.js';
import { putObject, r2Configured } from './lib/r2.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const V = process.env.IG_GRAPH_VERSION || 'v21.0';
const G = `https://graph.facebook.com/${V}`;
const IG = process.env.IG_USER_ID;
const TOKEN = process.env.IG_ACCESS_TOKEN;

const slug = process.argv[2];
const dry = process.argv.includes('--dry');
const noMark = process.argv.includes('--no-mark');
if (!slug || slug.startsWith('--')) { console.error('사용법: node social-post.js <slug> [--dry] [--no-mark]'); process.exit(1); }

const cardDir = path.join(OUTPUT_DIR, 'cards', slug);
if (!existsSync(cardDir)) { console.error(`카드 폴더 없음: ${cardDir}\n  먼저: node gen-cards.js ${slug}`); process.exit(1); }

// 인스타 캡션 블록만 추출(caption.txt: '인스타그램 캡션' ~ '스레드 캡션' 사이)
function readIgCaption() {
  const p = path.join(cardDir, 'caption.txt');
  if (!existsSync(p)) { console.error(`caption.txt 없음 → node gen-cards.js ${slug} 먼저`); process.exit(1); }
  const lines = readFileSync(p, 'utf8').split('\n');
  const s = lines.findIndex((l) => l.includes('인스타그램 캡션'));
  const e = lines.findIndex((l) => l.includes('스레드 캡션'));
  return lines.slice(s < 0 ? 0 : s + 1, e < 0 ? undefined : e).join('\n').trim();
}

function markPosted() {
  const dir = path.join(HERE, 'social'); mkdirSync(dir, { recursive: true });
  const lp = path.join(dir, 'posted.json');
  let o = {}; try { o = JSON.parse(readFileSync(lp, 'utf8')); } catch (e) {}
  o[slug] = new Date().toISOString().slice(0, 10);
  writeFileSync(lp, JSON.stringify(o, null, 2) + '\n', 'utf8');
}

async function fb(pathSeg, params) {
  const res = await fetch(`${G}/${pathSeg}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: TOKEN }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`Graph API 오류: ${JSON.stringify(j.error || j)}`);
  return j;
}
async function getField(id, fields) {
  const res = await fetch(`${G}/${id}?fields=${fields}&access_token=${TOKEN}`);
  return res.json().catch(() => ({}));
}
async function waitReady(id) {
  for (let i = 0; i < 12; i++) {
    const s = await getField(id, 'status_code');
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR') throw new Error('미디어 컨테이너 처리 오류(ERROR)');
    await new Promise((r) => setTimeout(r, 2500));
  }
  log('경고: 컨테이너가 아직 FINISHED가 아니지만 발행을 시도합니다');
}

async function main() {
  const imgs = readdirSync(cardDir).filter((f) => /^\d+\.png$/.test(f)).sort();
  if (imgs.length < 2) { console.error(`캐러셀은 이미지 2장 이상 필요(현재 ${imgs.length}).`); process.exit(1); }
  const caption = readIgCaption();

  log(`인스타 게시 준비: ${slug} — 카드 ${imgs.length}장`);
  console.log('\n----- 캡션 -----\n' + caption + '\n----------------\n');

  if (!r2Configured()) { console.error('R2_* 환경변수가 없습니다(.env). 이미지 호스팅에 필요합니다.'); process.exit(1); }

  // 1) 카드 PNG → R2 공개 URL
  const urls = [];
  for (const f of imgs) {
    const url = await putObject({
      key: `cards/${slug}/${f}`,
      body: readFileSync(path.join(cardDir, f)),
      contentType: 'image/png',
      bucket: process.env.R2_CARDS_BUCKET,         // 없으면 R2_BUCKET
      publicBase: process.env.R2_CARDS_PUBLIC_BASE, // 없으면 R2_PUBLIC_BASE (공개 버킷 도메인이어야 함)
      cache: false,
    });
    if (!/^https?:\/\//.test(url)) { console.error(`R2 공개 URL이 아닙니다(${url}). R2_PUBLIC_BASE(공개 버킷 도메인)를 .env에 설정하세요.`); process.exit(1); }
    urls.push(url);
    log(`업로드 ${f} → ${url}`);
  }

  if (dry) {
    console.log('\n[--dry] 업로드까지만 완료. 실제 게시는 생략했습니다.');
    console.log('이미지 URL:\n' + urls.map((u, i) => `  ${i + 1}. ${u}`).join('\n'));
    return;
  }

  if (!IG || !TOKEN) { console.error('IG_USER_ID / IG_ACCESS_TOKEN 이 .env에 없습니다(셋업 후 다시 시도).'); process.exit(1); }

  // 2) 각 이미지 → 캐러셀 자식 컨테이너
  const children = [];
  for (const url of urls) {
    const c = await fb(`${IG}/media`, { image_url: url, is_carousel_item: 'true' });
    children.push(c.id);
    log(`자식 컨테이너 ${c.id}`);
  }
  // 3) 캐러셀 컨테이너(캡션 포함)
  const carousel = await fb(`${IG}/media`, { media_type: 'CAROUSEL', children: children.join(','), caption });
  log(`캐러셀 컨테이너 ${carousel.id} — 처리 대기`);
  await waitReady(carousel.id);
  // 4) 발행
  const pub = await fb(`${IG}/media_publish`, { creation_id: carousel.id });
  const info = await getField(pub.id, 'permalink');
  log(`게시 완료! media id=${pub.id}`);
  if (info.permalink) console.log('  ' + info.permalink);

  if (!noMark) { markPosted(); log(`기록됨(posted.json): ${slug}`); }
}

main().catch((e) => { console.error('\n실패:', e.message); process.exit(1); });
