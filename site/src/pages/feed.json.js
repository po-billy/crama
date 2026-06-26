// 앱(Crama 모바일)용 콘텐츠 피드 — 빌드시 정적 생성.
// 메타데이터 + 본문(bodyHtml: MDX를 안전하게 마크다운→HTML 변환).
// 사이트 빌드를 깨지 않도록 외부 의존성 없이 자체 변환만 사용한다.
import { getCollection } from 'astro:content';

/** MDX 전용 구문 제거: import 라인, self-closing 컴포넌트, 컴포넌트 래퍼 태그(내용은 보존) */
function stripMdx(src) {
  let s = src;
  // import ... ; / export ... ; 라인 제거
  s = s.replace(/^\s*import\s.+$/gm, '');
  s = s.replace(/^\s*export\s.+$/gm, '');
  // self-closing 컴포넌트 <KeyTakeaways ... /> 제거 (대문자 시작 태그)
  s = s.replace(/<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g, '');
  // 래퍼 컴포넌트 여는/닫는 태그 제거 (내부 텍스트는 유지) <Callout ...> ... </Callout>
  s = s.replace(/<\/?[A-Z][A-Za-z0-9]*\b[^>]*>/g, '');
  return s;
}

function esc(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** 인라인 마크다운: **굵게**, [링크](url), `코드` */
function inline(t) {
  let s = esc(t);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

/** 아주 가벼운 마크다운 → HTML (이 블로그가 쓰는 구문만 커버) */
function mdToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let para = [];
  let list = null; // 'ul'

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${inline(para.join(' ').trim())}</p>`);
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      out.push(`</${list}>`);
      list = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    let m;
    if ((m = line.match(/^(#{2,4})\s+(.*)$/))) {
      flushPara();
      flushList();
      const depth = m[1].length; // 2..4
      out.push(`<h${depth}>${inline(m[2])}</h${depth}>`);
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flushPara();
      flushList();
      out.push(`<blockquote>${inline(m[1])}</blockquote>`);
    } else if ((m = line.match(/^[-*]\s+(.*)$/))) {
      flushPara();
      if (list !== 'ul') {
        flushList();
        list = 'ul';
        out.push('<ul>');
      }
      out.push(`<li>${inline(m[1])}</li>`);
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara();
  flushList();
  return out.join('\n');
}

/** 본문에서 헤딩 목록 추출 (쇼츠 분절용) */
function extractHeadings(md) {
  const heads = [];
  const re = /^(#{2,3})\s+(.*)$/gm;
  let m;
  while ((m = re.exec(md))) {
    const text = m[2].replace(/[*`]/g, '').trim();
    heads.push({
      depth: m[1].length,
      text,
      slug: text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, ''),
    });
  }
  return heads;
}

export async function GET() {
  const posts = (await getCollection('blog'))
    .filter((p) => !p.data.draft)
    .sort((a, b) => +new Date(b.data.pubDate) - +new Date(a.data.pubDate));

  const articles = posts.map((p) => {
    const cleaned = stripMdx(p.body ?? '');
    return {
      slug: p.id,
      title: p.data.title,
      description: p.data.description,
      category: p.data.category,
      tags: p.data.tags ?? [],
      pubDate: p.data.pubDate,
      updatedDate: p.data.updatedDate,
      heroImage: p.data.heroImage,
      audio: p.data.audio,
      premium: p.data.premium ?? false,
      format: p.data.format ?? 'guide',
      author: p.data.author,
      bodyHtml: mdToHtml(cleaned),
      headings: extractHeadings(cleaned),
    };
  });

  return new Response(JSON.stringify({ generatedAt: new Date().toISOString(), count: articles.length, articles }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
