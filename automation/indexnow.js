// IndexNow CLI — 배포 후 새/변경 URL 을 검색엔진(Bing·Naver·Yandex 등)에 즉시 색인 푸시.
//
//   node indexnow.js <slug|/path|https://...> ...   특정 글/URL 제출
//   node indexnow.js --all                          현재 발행된 전체 글 제출
//
// ⚠️ 반드시 '배포가 끝나 실제 URL 이 200 으로 응답하는 상태'에서 실행할 것(404 푸시 방지).
import 'dotenv/config';
import { readExistingPosts } from './lib/util.js';
import { submit, postUrl } from './lib/indexnow.js';

const HOST = process.env.INDEXNOW_HOST || 'crama.app';
const args = process.argv.slice(2);

function toUrl(a) {
  if (/^https?:\/\//.test(a)) return a;                 // 절대 URL
  if (a.startsWith('/')) return `https://${HOST}${a}`;  // 사이트 경로
  return postUrl(a);                                    // slug
}

async function main() {
  let urls = [];
  if (args.includes('--all')) {
    const posts = await readExistingPosts();
    urls = posts.map((p) => postUrl(p.slug));
    console.log(`[indexnow] 전체 글 ${urls.length}개 제출`);
  } else {
    const items = args.filter((a) => !a.startsWith('--'));
    if (!items.length) {
      console.error('사용법: node indexnow.js <slug|/path|url> ...  |  --all');
      process.exit(1);
    }
    urls = items.map(toUrl);
  }

  const r = await submit(urls);
  if (r.skipped) { console.log('[indexnow] 제출할 URL 이 없습니다.'); return; }
  console.log(`[indexnow] ${r.ok ? '성공' : '실패'} (status ${r.status}, ${r.count}개)`);
  if (!r.ok) process.exit(1);
}

main().catch((e) => { console.error('[indexnow] 오류:', e.message || e); process.exit(1); });
