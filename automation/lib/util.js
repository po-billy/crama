import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');
export const BLOG_DIR = path.join(ROOT, 'site', 'src', 'content', 'blog');
export const PUBLIC_IMG = path.join(ROOT, 'site', 'public', 'img', 'generated');
export const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// 영문 kebab 슬러그 정리 (한글만 있으면 타임스탬프 fallback)
export function safeSlug(raw, category) {
  const s = String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const ascii = s.replace(/[^a-z0-9-]/g, '');
  if (ascii.replace(/-/g, '').length >= 4) return ascii;
  return `${category}-${Date.now().toString(36)}`;
}

// 기존 발행 글의 frontmatter(title/category) 가볍게 파싱
export async function readExistingPosts() {
  let files = [];
  try {
    files = await fs.readdir(BLOG_DIR);
  } catch {
    return [];
  }
  const posts = [];
  for (const f of files) {
    if (!/\.(md|mdx)$/.test(f)) continue;
    const text = await fs.readFile(path.join(BLOG_DIR, f), 'utf8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) continue;
    const title = (fm[1].match(/title:\s*['"]?(.+?)['"]?\s*$/m) || [])[1] || '';
    const category = (fm[1].match(/category:\s*['"]?(\w+)['"]?/m) || [])[1] || '';
    posts.push({ file: f, slug: f.replace(/\.(md|mdx)$/, ''), title, category });
  }
  return posts;
}

// 토큰 자카드 유사도 (간단 중복 게이트)
export function similarity(a, b) {
  const tok = (s) =>
    new Set(
      String(s)
        .toLowerCase()
        .replace(/[^\w가-힣\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 1),
    );
  const A = tok(a);
  const B = tok(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export const log = (...m) => console.log('[crama]', ...m);
