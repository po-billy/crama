// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── 사이트맵 SEO: 글별 최종 수정일(updatedDate > pubDate)을 slug 로 매핑 → <lastmod> ──
const blogDir = fileURLToPath(new URL('./src/content/blog', import.meta.url));
function buildLastmodMap() {
  const map = new Map();
  let files = [];
  try { files = fs.readdirSync(blogDir).filter((f) => /\.(md|mdx)$/.test(f)); } catch { return map; }
  const dateOf = (fm, key) => {
    const m = fm.match(new RegExp('^' + key + ":\\s*['\"]?(\\d{4}-\\d{2}-\\d{2})", 'm'));
    return m ? m[1] : null;
  };
  for (const f of files) {
    let raw = '';
    try { raw = fs.readFileSync(path.join(blogDir, f), 'utf8'); } catch { continue; }
    const parts = raw.split(/^---\s*$/m);
    const fm = parts.length >= 3 ? parts[1] : '';
    if (/^\s*draft:\s*true/m.test(fm)) continue; // 드래프트는 사이트맵에서 제외
    const d = dateOf(fm, 'updatedDate') || dateOf(fm, 'pubDate');
    if (d) map.set(f.replace(/\.(md|mdx)$/, ''), d);
  }
  return map;
}
const lastmodBySlug = buildLastmodMap();
const buildDate = new Date().toISOString().slice(0, 10); // 동적/목록 페이지 기본 수정일(빌드일)

// https://astro.build/config
export default defineConfig({
  site: 'https://crama.app',
  integrations: [
    mdx(),
    sitemap({
      // 검색 결과/오류 등 색인 가치 없는 유틸 페이지는 사이트맵에서 제외
      filter: (page) => !/\/(search|404)\/?$/.test(new URL(page).pathname),
      // 페이지 유형별 lastmod·changefreq·priority 차등(검색엔진 우선순위 신호)
      serialize(item) {
        const p = new URL(item.url).pathname;
        const set = (changefreq, priority, lastmod) => {
          item.changefreq = changefreq;
          item.priority = priority;
          item.lastmod = lastmod || buildDate;
          return item;
        };
        // 개별 글: 글별 실제 작성/수정일 + 높은 우선순위(핵심 콘텐츠)
        const blog = p.match(/^\/blog\/([^/]+)\/$/);
        if (blog) return set('monthly', 0.8, lastmodBySlug.get(blog[1]));
        // 홈
        if (p === '/') return set('daily', 1.0, buildDate);
        // 목록·허브(블로그/카테고리/태그/칼럼/가이드/퀴즈): 새 글마다 갱신
        if (/^\/(blog|category|tag|column|guides|quiz)(\/|$)/.test(p)) return set('weekly', 0.6, buildDate);
        // 계산기 도구 페이지
        if (/^\/tools(\/|$)/.test(p)) return set('monthly', 0.5, buildDate);
        // 용어집
        if (p === '/glossary/') return set('weekly', 0.5, buildDate);
        // 정적 안내(about·privacy·contact·membership 등)
        return set('yearly', 0.3, buildDate);
      },
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-light' },
  },
});
