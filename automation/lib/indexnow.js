// IndexNow — 새/변경 URL 을 IndexNow 참여 검색엔진(Bing·Naver·Yandex·Seznam)에 즉시 푸시한다.
// Google 은 IndexNow 미참여 → 사이트맵 + Search Console 색인요청으로 커버.
// 키는 site/public/<KEY>.txt 로 서빙되어 소유권이 검증된다. 키 변경 시 두 곳을 함께 바꿀 것.
const HOST = process.env.INDEXNOW_HOST || 'crama.app';
const KEY = process.env.INDEXNOW_KEY || 'b779c70440e54e62e4ebeb255bddf222';
const SITE_URL = `https://${HOST}`;

// slug → 글 URL
export function postUrl(slug) {
  return `${SITE_URL}/blog/${slug}/`;
}

// urls: 절대 URL 배열(최대 10,000개/요청). 중복 제거 후 IndexNow 에 일괄 제출.
export async function submit(urls) {
  const list = [...new Set((urls || []).filter(Boolean))];
  if (!list.length) return { ok: false, skipped: true, reason: 'no urls', count: 0 };

  const body = {
    host: HOST,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: list,
  };

  let res;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch('https://api.indexnow.org/IndexNow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
      break;
    } catch (e) {
      if (attempt === 2) return { ok: false, status: 0, count: list.length, error: e.message };
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }

  // 200=수락, 202=수락(키 검증 대기). 4xx=키/URL/호스트 문제.
  return { ok: res.status === 200 || res.status === 202, status: res.status, count: list.length };
}
