// 팟캐스트 RSS 피드 — 글마다 생성한 오디오(MP3)를 에피소드로. 스포티파이·애플 팟캐스트 제출용.
//   주소: https://crama.app/podcast.xml
import { getCollection } from 'astro:content';
import { SITE } from '../consts';

const OWNER_EMAIL = 'gmlthd94@gmail.com';
const COVER = `${SITE.url}/podcast-cover.jpg`; // 1400~3000px 정사각 JPG/PNG 필요(애플 제출 요건)

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// 본문 길이로 재생시간 추정(정확값은 추후 백필 가능). 한국어 TTS 대략치.
const estSeconds = (post) => Math.max(60, Math.round((post.body || '').length / 9));
const hhmmss = (sec) => {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
};

export async function GET(context) {
  const site = context.site?.toString().replace(/\/$/, '') ?? SITE.url;
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.draft && p.data.audio)
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  const items = posts.map((post) => {
    const url = `${site}/blog/${post.id}/`;
    const sec = estSeconds(post);
    const bytes = sec * 6000; // 48kbps mono 추정 바이트
    return `    <item>
      <title>${esc(post.data.title)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${post.data.pubDate.toUTCString()}</pubDate>
      <description><![CDATA[${post.data.description}]]></description>
      <itunes:summary><![CDATA[${post.data.description}]]></itunes:summary>
      <itunes:author>${esc(SITE.author)}</itunes:author>
      <itunes:duration>${hhmmss(sec)}</itunes:duration>
      <itunes:explicit>false</itunes:explicit>
      <itunes:episodeType>full</itunes:episodeType>
      <enclosure url="${esc(post.data.audio)}" length="${bytes}" type="audio/mpeg" />
    </item>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>크라마 오디오 — 트렌드를 읽다</title>
    <link>${esc(site)}</link>
    <language>ko-kr</language>
    <description>${esc('주식·재테크와 AI 트렌드를 깊이 있게 읽어 주는 오디오 매거진 크라마(Crama). 이동하며·일하며 듣는 한 편의 인사이트.')}</description>
    <copyright>© ${new Date().getUTCFullYear()} Crama</copyright>
    <itunes:author>${esc(SITE.author)}</itunes:author>
    <itunes:summary>${esc('주식·재테크와 AI 트렌드를 깊이 있게 읽어 주는 오디오 매거진. 이동하며·일하며 듣는 한 편의 인사이트.')}</itunes:summary>
    <itunes:type>episodic</itunes:type>
    <itunes:explicit>false</itunes:explicit>
    <itunes:owner>
      <itunes:name>${esc(SITE.author)}</itunes:name>
      <itunes:email>${esc(OWNER_EMAIL)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${esc(COVER)}" />
    <image>
      <url>${esc(COVER)}</url>
      <title>크라마 오디오</title>
      <link>${esc(site)}</link>
    </image>
    <itunes:category text="Business">
      <itunes:category text="Investing" />
    </itunes:category>
    <itunes:category text="News" />
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
