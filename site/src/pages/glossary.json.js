// 앱용 글래서리(용어집) 피드 — 본문 툴팁/용어 매칭에 사용. 빌드시 정적 생성.
import { money, ai, economy } from '../data/glossary.ts';

export async function GET() {
  const tag = (arr, category) => arr.map((t) => ({ ...t, category }));
  const terms = [...tag(money, 'money'), ...tag(ai, 'ai'), ...tag(economy, 'economy')];

  return new Response(JSON.stringify({ count: terms.length, terms }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
