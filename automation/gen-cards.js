// 카드뉴스 자동생성 — MDX 글 → Claude가 캐러셀 카피로 압축 → 브랜드 템플릿 PNG(1080×1350, 인스타/스레드 4:5)
//   node gen-cards.js <slug>           예) node gen-cards.js youth-future-savings-2026
//   결과: automation/output/cards/<slug>/01.png ...
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { BLOG_DIR, OUTPUT_DIR, log } from './lib/util.js';

const MODEL = process.env.CARDS_MODEL || process.env.WRITE_MODEL || 'claude-sonnet-4-6';
const client = new Anthropic();

// ── 브랜드 토큰
const W = 1080, H = 1350;
const PAPER = '#fbfaf8', INK = '#1a1a1a', INK_SOFT = '#3c3a37', MUTED = '#6b6862';
const ACCENT = '#b04a2f', DARK = '#15120e', CREAM = '#f4f1ea';
const SERIF = 'HANBatang';     // 한글 명조 (헤드라인)
const SANS = 'Malgun Gothic';  // 한글 고딕 (본문)

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// SVG는 자동 줄바꿈이 없어 직접 래핑(공백 우선, 너무 길면 강제 분할)
function wrap(text, max) {
  const out = [];
  for (const rawLine of String(text).split('\n')) {
    const words = rawLine.split(' ');
    let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (next.length <= max) { cur = next; continue; }
      if (cur) out.push(cur);
      if (w.length > max) { let s = w; while (s.length > max) { out.push(s.slice(0, max)); s = s.slice(max); } cur = s; }
      else cur = w;
    }
    out.push(cur);
  }
  return out;
}
// <text> 안에 여러 줄(tspan). x,y=첫 줄 기준, lh=줄간격(px)
function tspans(lines, x, y, lh) {
  return lines.map((ln, i) => `<tspan x="${x}" y="${y + i * lh}">${esc(ln)}</tspan>`).join('');
}

// 페이지 점 인디케이터
function dots(total, active, cx, y) {
  let s = '';
  const gap = 26, w = (total - 1) * gap, start = cx - w / 2;
  for (let i = 0; i < total; i++) {
    const on = i === active;
    s += `<circle cx="${start + i * gap}" cy="${y}" r="${on ? 7 : 5}" fill="${on ? ACCENT : '#d8d2c6'}"/>`;
  }
  return s;
}

function wordmark(x, y, color = INK, sub = true) {
  return `<text x="${x}" y="${y}" font-family="${SERIF}" font-size="40" font-weight="bold" fill="${color}">Crama</text>` +
    (sub ? `<text x="${x + 138}" y="${y}" font-family="${SANS}" font-size="24" fill="${MUTED}">트렌드를 읽다</text>` : '');
}

// ── 카드 SVG 빌더들
function coverSVG({ kicker, hook }) {
  const lines = wrap(hook, 11); // 큰 명조 헤드라인
  const fs = lines.length > 3 ? 92 : 104;
  const lh = fs * 1.18;
  const blockH = lines.length * lh;
  const startY = Math.max(360, (H - blockH) / 2 - 40) + fs * 0.8;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <rect x="0" y="0" width="${W}" height="14" fill="${ACCENT}"/>
    <text x="90" y="170" font-family="${SANS}" font-size="30" font-weight="bold" letter-spacing="6" fill="${ACCENT}">${esc((kicker || 'CRAMA').toUpperCase())}</text>
    <text font-family="${SERIF}" font-size="${fs}" font-weight="bold" fill="${INK}">${tspans(lines, 90, startY, lh)}</text>
    <rect x="92" y="${startY + blockH - fs * 0.5}" width="120" height="9" rx="4" fill="${ACCENT}"/>
    ${wordmark(90, H - 110)}
    <text x="${W - 90}" y="${H - 110}" text-anchor="end" font-family="${SANS}" font-size="30" font-weight="bold" fill="${INK_SOFT}">넘겨보기 →</text>
  </svg>`;
}

function pointSVG({ n, total, heading, body }) {
  const hLines = wrap(heading, 15);
  const hFs = 64, hLh = hFs * 1.22;
  const hStart = 430;
  const bStart = hStart + hLines.length * hLh + 36;
  const bLines = wrap(body, 24);
  const bFs = 38, bLh = bFs * 1.5;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <text x="90" y="270" font-family="${SERIF}" font-size="150" font-weight="bold" fill="${ACCENT}" opacity="0.95">${String(n).padStart(2, '0')}</text>
    <rect x="92" y="305" width="64" height="8" rx="4" fill="${ACCENT}"/>
    <text font-family="${SANS}" font-size="${hFs}" font-weight="bold" fill="${INK}">${tspans(hLines, 90, hStart, hLh)}</text>
    <text font-family="${SANS}" font-size="${bFs}" fill="${INK_SOFT}">${tspans(bLines, 90, bStart, bLh)}</text>
    <text x="90" y="${H - 90}" font-family="${SERIF}" font-size="30" font-weight="bold" fill="${MUTED}">Crama</text>
    ${dots(total, n, W / 2, H - 100)}
    <text x="${W - 90}" y="${H - 90}" text-anchor="end" font-family="${SANS}" font-size="26" fill="${MUTED}">crama.app</text>
  </svg>`;
}

function ctaSVG({ cta }) {
  const lines = wrap(cta || '흐름을 먼저 읽는 사람들', 13);
  const fs = 74, lh = fs * 1.2;
  const startY = 470;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${DARK}"/>
    <rect x="0" y="0" width="${W}" height="14" fill="${ACCENT}"/>
    <text x="90" y="250" font-family="${SANS}" font-size="30" font-weight="bold" letter-spacing="6" fill="#e07a57">READ THE TRENDS</text>
    <text font-family="${SERIF}" font-size="${fs}" font-weight="bold" fill="#ffffff">${tspans(lines, 90, startY, lh)}</text>
    <text x="90" y="${startY + lines.length * lh + 70}" font-family="${SANS}" font-size="40" fill="${CREAM}">전문은 <tspan fill="#e07a57" font-weight="bold">crama.app</tspan> 에서.</text>
    <text x="90" y="${H - 150}" font-family="${SERIF}" font-size="48" font-weight="bold" fill="#fff">Crama</text>
    <text x="90" y="${H - 100}" font-family="${SANS}" font-size="30" fill="#bdb7ad">주식·재테크 · AI 트렌드 · 지원금</text>
  </svg>`;
}

// ── MDX 로드 & 본문 정리
function loadArticle(slug) {
  const raw = readFileSync(path.join(BLOG_DIR, `${slug}.mdx`), 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const fm = m ? m[1] : '';
  let body = m ? m[2] : raw;
  const pick = (k) => (fm.match(new RegExp(`^${k}:\\s*["']?(.*?)["']?\\s*$`, 'm')) || [])[1] || '';
  body = body
    .replace(/^import .*$/gm, '')
    .replace(/<[^>]+>/g, ' ')           // JSX/HTML 제거
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|]/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return { title: pick('title'), description: pick('description'), category: pick('category'), body: body.slice(0, 6000) };
}

async function condense(art) {
  const system =
    '너는 한국어 소셜 카드뉴스 에디터다. 매거진 "크라마"의 톤(차분하고 신뢰감 있으며, 과장·낚시·이모지 남발 없음, ' +
    '"먼저 읽는다/쉽게 풀어준다"는 결)으로, 주어진 글을 인스타그램 캐러셀 카드용 카피로 압축한다. ' +
    '문장은 짧고 또렷하게. 숫자·핵심만. 반드시 JSON만 출력한다.';
  const user =
    `제목: ${art.title}\n설명: ${art.description}\n\n본문:\n${art.body}\n\n` +
    '아래 JSON 스키마로만 답해라(설명·코드펜스 금지):\n' +
    '{\n' +
    '  "kicker": "상단 영문/한글 라벨 한 단어~두 단어 (예: 청년 정책, AI 트렌드)",\n' +
    '  "hook": "커버 카드 헤드라인. 호기심을 끄는 한 문장, 24자 이내, 낚시 금지",\n' +
    '  "cards": [ { "heading": "핵심 포인트 제목 18자 이내", "body": "1~2문장 설명 70자 이내" } ],   // 3~4개\n' +
    '  "cta": "마지막 카드용 한 줄 (16자 이내)"\n' +
    '}\n' +
    '카드는 글의 가장 중요한 3~4개 포인트만. 정확한 수치가 있으면 살려라.';
  const resp = await client.messages.create({ model: MODEL, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] });
  const text = resp.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(json);
}

// 렌더 디자인 확인용 목업(크레딧 없이 테스트). 실제 카피는 Claude가 생성.
const MOCK = {
  kicker: '청년 정책',
  hook: '몰라서 못 받는 연 19.4%, 청년미래적금',
  cards: [
    { heading: '세 가지 조건, 다 충족해야', body: '만 19~34세 · 본인 총급여 7,500만원 이하 · 가구 중위소득 200% 이하. 병역 기간(최대 6년)은 나이에서 빼줍니다.' },
    { heading: '정부가 얹어주는 6~12%', body: '월 최대 50만원을 3년. 일반형 6%, 중소기업 재직자 등 우대형은 12%를 정부가 더해줍니다.' },
    { heading: '실질효과 연 최대 19.4%', body: '은행금리(최고 8%)에 정부기여금과 비과세까지 더한 환산 수익률. 일반 적금과 비교가 안 되는 이유.' },
    { heading: '신청은 7월 3일까지', body: '단 2주. 첫 주는 출생연도 끝자리 5부제로 운영됩니다. 대상이면 서둘러 확인하세요.' },
  ],
  cta: '흐름을 먼저 읽는 사람들',
};

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('사용법: node gen-cards.js <slug> [--mock]'); process.exit(1); }
  const mock = process.argv.includes('--mock');
  const art = loadArticle(slug);
  log(`카드 생성: ${art.title}${mock ? ' (목업)' : ''}`);
  const data = mock ? MOCK : await condense(art);
  const points = (data.cards || []).slice(0, 4);
  const total = points.length + 2; // 커버 + 포인트들 + CTA

  const outDir = path.join(OUTPUT_DIR, 'cards', slug);
  mkdirSync(outDir, { recursive: true });

  const svgs = [
    coverSVG({ kicker: data.kicker, hook: data.hook }),
    ...points.map((p, i) => pointSVG({ n: i + 1, total: total - 1, heading: p.heading, body: p.body })),
    ctaSVG({ cta: data.cta }),
  ];
  for (let i = 0; i < svgs.length; i++) {
    const out = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
    await sharp(Buffer.from(svgs[i])).png().toFile(out);
  }
  log(`완료: ${svgs.length}장 → ${outDir}`);
  console.log('  hook:', data.hook);
  points.forEach((p, i) => console.log(`  ${i + 1}. ${p.heading}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
