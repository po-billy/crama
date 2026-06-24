// 카드뉴스 자동생성 — MDX 글 → Claude가 캐러셀 카피로 압축 → 브랜드 템플릿 PNG(1080×1350, 인스타/스레드 4:5)
//   node gen-cards.js <slug>           예) node gen-cards.js youth-future-savings-2026
//   결과: automation/output/cards/<slug>/01.png ...
import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { BLOG_DIR, OUTPUT_DIR, ROOT, log } from './lib/util.js';

const MODEL = process.env.CARDS_MODEL || 'claude-opus-4-8'; // 짧은 카피라 비용 적고, 보이스 품질이 중요
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

// 본문 인라인 하이라이트: **강조** 구간을 테라코타 굵게. 줄바꿈 자동 래핑.
function parseHL(s) {
  const out = [], re = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ t: s.slice(last, m.index), hl: false });
    out.push({ t: m[1], hl: true });
    last = re.lastIndex;
  }
  if (last < s.length) out.push({ t: s.slice(last), hl: false });
  return out;
}
function richText(body, x, y0, lh, fs, baseFill, max) {
  // 토큰화: **강조** 경계에서 원문에 공백이 없으면 glue=true(조사·부호가 앞에 붙음)
  const segs = parseHL(body);
  const words = [];
  for (let si = 0; si < segs.length; si++) {
    const parts = segs[si].t.split(' ');
    for (let pi = 0; pi < parts.length; pi++) {
      if (parts[pi] === '') continue;
      const glue = pi === 0 && si > 0 && !/\s$/.test(segs[si - 1].t) && !/^\s/.test(segs[si].t);
      words.push({ w: parts[pi], hl: segs[si].hl, glue });
    }
  }
  const lines = [];
  let cur = [], len = 0;
  for (const tok of words) {
    const add = len === 0 ? tok.w.length : tok.w.length + 1;
    if (len + add > max && len > 0 && !tok.glue) { lines.push(cur); cur = []; len = 0; }
    cur.push(tok); len += len === 0 ? tok.w.length : tok.w.length + 1;
  }
  if (cur.length) lines.push(cur);
  const inner = lines.map((line, i) => {
    const y = y0 + i * lh;
    return line.map((tok, j) => {
      const pos = j === 0 ? ` x="${x}" y="${y}"` : '';
      const st = tok.hl ? ` fill="${ACCENT}" font-weight="bold"` : '';
      // 다음 토큰이 문장부호이거나 glue(조사 등)면 후행 공백 생략. xml:space=preserve로 간격 유지
      const next = line[j + 1];
      const noSpace = next && (next.glue || /^[,.!?)\]·%」』]/.test(next.w));
      const txt = esc(tok.w) + (j < line.length - 1 && !noSpace ? ' ' : '');
      return `<tspan${pos}${st}>${txt}</tspan>`;
    }).join('');
  }).join('');
  return { svg: `<text xml:space="preserve" font-family="${SANS}" font-size="${fs}" fill="${baseFill}">${inner}</text>`, lines: lines.length };
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

function pointSVG({ n, total, heading, stat, body }) {
  const parts = [];
  let y = 250;
  // 번호 (작게)
  parts.push(`<text x="90" y="${y}" font-family="${SERIF}" font-size="62" font-weight="bold" fill="${ACCENT}">${String(n).padStart(2, '0')}</text>`);
  parts.push(`<rect x="92" y="${y + 24}" width="56" height="7" rx="3" fill="${ACCENT}"/>`);
  y += 118;
  // 제목 (라벨)
  const hLines = wrap(heading, 16), hFs = 52, hLh = hFs * 1.24;
  parts.push(`<text font-family="${SANS}" font-size="${hFs}" font-weight="bold" fill="${INK}">${tspans(hLines, 90, y, hLh)}</text>`);
  y += hLines.length * hLh + 18;
  // 핵심 수치 (큰 강조) — 있으면
  if (stat) {
    const sFs = stat.length > 7 ? 92 : 122;
    parts.push(`<text x="86" y="${y + sFs * 0.82}" font-family="${SERIF}" font-size="${sFs}" font-weight="bold" fill="${ACCENT}">${esc(stat)}</text>`);
    y += sFs * 0.82 + 56;
  } else { y += 8; }
  // 본문 (핵심어 하이라이트)
  const rt = richText(body, 90, y + 8, 58, 39, INK_SOFT, 24);
  parts.push(rt.svg);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    ${parts.join('')}
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
  return { title: pick('title'), description: pick('description'), category: pick('category'), heroImage: pick('heroImage'), body: body.slice(0, 6000) };
}

// 표지: 글의 히어로 이미지 + 다크 그라데이션 + 텍스트 (매거진 표지). 이미지 없으면 coverSVG 폴백.
async function renderCover(out, { kicker, hook, heroPath }) {
  const base = await sharp(heroPath).resize(W, H, { fit: 'cover', position: 'attention' }).toBuffer();
  const lines = wrap(hook, 13);
  const fs = lines.length > 2 ? 80 : 92, lh = fs * 1.16;
  const wmY = H - 96;
  const hookBottom = wmY - 88;
  const startY = hookBottom - (lines.length - 1) * lh;
  const kickerY = startY - fs - 34;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${DARK}" stop-opacity="0.28"/>
      <stop offset="0.42" stop-color="${DARK}" stop-opacity="0.05"/>
      <stop offset="0.72" stop-color="${DARK}" stop-opacity="0.7"/>
      <stop offset="1" stop-color="${DARK}" stop-opacity="0.96"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect x="0" y="0" width="${W}" height="14" fill="${ACCENT}"/>
    <text x="90" y="${kickerY}" font-family="${SANS}" font-size="30" font-weight="bold" letter-spacing="6" fill="#f4c9b8">${esc((kicker || 'CRAMA').toUpperCase())}</text>
    <text font-family="${SERIF}" font-size="${fs}" font-weight="bold" fill="#ffffff">${tspans(lines, 90, startY, lh)}</text>
    <rect x="92" y="${hookBottom + 26}" width="110" height="9" rx="4" fill="${ACCENT}"/>
    <text x="90" y="${wmY}" font-family="${SERIF}" font-size="40" font-weight="bold" fill="#ffffff">Crama</text>
    <text x="${228}" y="${wmY}" font-family="${SANS}" font-size="24" fill="#e7e1d6">트렌드를 읽다</text>
    <text x="${W - 90}" y="${wmY}" text-anchor="end" font-family="${SANS}" font-size="30" font-weight="bold" fill="#ffffff">넘겨보기 →</text>
  </svg>`;
  await sharp(base).composite([{ input: Buffer.from(overlay) }]).png().toFile(out);
}

async function condense(art) {
  const system = [
    '너는 매거진 "크라마(Crama)"의 카피라이터다. 크라마는 돈·AI 트렌드를 "남보다 먼저, 쉽게 읽어주는" 매거진이다.',
    '톤: 차분한 자신감 + 친근하지만 군더더기 없음 + 절제된 위트. 신뢰가 핵심이라 과장·낚시는 절대 안 쓴다.',
    '인스타그램 캐러셀 카드용 한국어 카피를 쓴다.',
    '',
    '[목소리 규칙]',
    '- 사람이 쓴 것처럼 자연스럽게. AI 특유의 대구("A가 아니라 B다", "~할 뿐이다")·판박이 표현 금지.',
    '- 후킹은 낚시가 아니라 "구체적 이득"이나 "작은 궁금증"으로. 숫자와 생활감을 살려라.',
    '- 짧고 리듬감 있게. 한 카드엔 한 메시지. 수식어 남발·이모지 금지.',
    '- "최고/대박/무조건" 같은 과장 금지. 담백하게, 그러나 또렷하게. 독자에게 말 걸듯 해요체도 좋다.',
    '',
    '[후킹 예시]',
    '- 밋밋(나쁨): "청년미래적금 총정리"',
    '- 느낌있음(좋음): "3년 부으면 400만원이 더 붙어요" / "은행엔 없는 적금, 연 19.4%"',
    '',
    '반드시 JSON만 출력한다.',
  ].join('\n');
  const user =
    `제목: ${art.title}\n설명: ${art.description}\n\n본문:\n${art.body}\n\n` +
    '아래 JSON 스키마로만 답해라(설명·코드펜스 금지):\n' +
    '{\n' +
    '  "kicker": "상단 영문/한글 라벨 한 단어~두 단어 (예: 청년 정책, AI 트렌드)",\n' +
    '  "hook": "커버 카드 헤드라인. 호기심을 끄는 한 문장, 24자 이내, 낚시 금지",\n' +
    '  "cards": [ { "heading": "핵심 포인트 제목 16자 이내", "stat": "그 포인트의 핵심 수치/키워드 7자 이내 (예: 6~12%, 연 19.4%, ~7/3, 월 50만). 없으면 빈 문자열", "body": "1~2문장 설명 65자 이내. 가장 중요한 키워드 1~2개를 **별표 두개**로 감싸 강조" } ],   // 3~4개\n' +
    '  "cta": "마지막 카드용 한 줄 (16자 이내)"\n' +
    '}\n' +
    '카드는 글의 가장 중요한 3~4개 포인트만. stat에는 숫자가 있으면 반드시 큰 수치로 뽑고, body의 핵심어는 **이렇게** 강조해라.';
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
    { heading: '세 가지 조건을 모두 충족', stat: '19~34세', body: '나이 **만 19~34세**, 본인 총급여 **7,500만원 이하**, 가구 **중위소득 200% 이하**. 병역 기간은 나이에서 빼줍니다.' },
    { heading: '정부가 얹어주는 기여금', stat: '6~12%', body: '월 최대 **50만원**을 3년. 일반형 6%, 중소기업 재직자 등 **우대형은 12%**를 정부가 더해줍니다.' },
    { heading: '실질 가입효과', stat: '연 19.4%', body: '은행금리(최고 8%)에 **정부기여금**과 **이자 비과세**까지 더한 환산 수익률. 일반 적금과 비교 불가.' },
    { heading: '신청 기간은 단 2주', stat: '~7/3', body: '첫 주는 출생연도 끝자리 **5부제**로 운영. 대상이면 **서둘러** 확인하세요.' },
  ],
  cta: '흐름을 먼저 읽는 사람들',
};

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('사용법: node gen-cards.js <slug> [--mock]'); process.exit(1); }
  const mock = process.argv.includes('--mock');
  const di = process.argv.indexOf('--data');
  const dataFile = di >= 0 ? process.argv[di + 1] : null; // 손으로 쓴 카피 JSON 주입(무료)
  const art = loadArticle(slug);
  log(`카드 생성: ${art.title}${dataFile ? ' (수동 카피)' : mock ? ' (목업)' : ''}`);
  const data = dataFile ? JSON.parse(readFileSync(dataFile, 'utf8')) : mock ? MOCK : await condense(art);
  const points = (data.cards || []).slice(0, 4);
  const total = points.length + 2; // 커버 + 포인트들 + CTA

  const outDir = path.join(OUTPUT_DIR, 'cards', slug);
  mkdirSync(outDir, { recursive: true });

  const num = (i) => path.join(outDir, `${String(i).padStart(2, '0')}.png`);
  // 01) 표지 — 히어로 이미지 있으면 합성, 없으면 타이포 폴백
  const heroPath = art.heroImage ? path.join(ROOT, 'site', 'public', art.heroImage) : null;
  if (heroPath && existsSync(heroPath)) {
    await renderCover(num(1), { kicker: data.kicker, hook: data.hook, heroPath });
  } else {
    if (heroPath) log(`히어로 이미지 없음(${art.heroImage}) → 타이포 표지로 대체`);
    await sharp(Buffer.from(coverSVG({ kicker: data.kicker, hook: data.hook }))).png().toFile(num(1));
  }
  // 02..) 포인트 + CTA
  const rest = [
    ...points.map((p, i) => pointSVG({ n: i + 1, total: total - 1, heading: p.heading, stat: p.stat, body: p.body })),
    ctaSVG({ cta: data.cta }),
  ];
  for (let i = 0; i < rest.length; i++) {
    await sharp(Buffer.from(rest[i])).png().toFile(num(i + 2));
  }
  log(`완료: ${rest.length + 1}장 → ${outDir}`);
  console.log('  hook:', data.hook);
  points.forEach((p, i) => console.log(`  ${i + 1}. ${p.heading}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
