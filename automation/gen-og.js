// 메인 OG 이미지 (1200x630) — 크라미 마스코트 활용, 재밌는 느낌.
//   출력: ../site/public/og-home.png
import sharp from 'sharp';
import path from 'node:path';

const OUT = path.resolve('../site/public/og-home.png');
const MASCOT = path.resolve('../site/public/img/generated/meerkat-baby-wave.webp');

const W = 1200, H = 630;

// 배경 + 텍스트 + 말풍선 (텍스트는 시스템 한글 폰트 사용)
const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fbf4ee"/>
      <stop offset="1" stop-color="#f5e6dc"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <!-- 점 장식 -->
  <circle cx="980" cy="90" r="10" fill="#e6b9a6"/>
  <circle cx="1080" cy="180" r="6" fill="#e6b9a6"/>
  <circle cx="120" cy="540" r="8" fill="#e6b9a6"/>
  <!-- 말풍선 -->
  <g transform="translate(640,120)">
    <rect x="0" y="0" rx="22" ry="22" width="300" height="86" fill="#ffffff" stroke="#e6e2d9" stroke-width="2"/>
    <path d="M40 86 L40 116 L78 86 Z" fill="#ffffff" stroke="#e6e2d9" stroke-width="2"/>
    <text x="150" y="54" font-family="'Malgun Gothic','Apple SD Gothic Neo','Noto Sans CJK KR',sans-serif" font-size="30" font-weight="700" fill="#1a1a1a" text-anchor="middle">먼저 읽는 사람들</text>
  </g>
  <!-- 워드마크 -->
  <text x="90" y="300" font-family="Georgia,'Times New Roman',serif" font-size="120" font-weight="700" fill="#1a1a1a">Cr<tspan fill="#b04a2f">a</tspan>ma</text>
  <!-- 태그라인 -->
  <text x="96" y="372" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="40" font-weight="600" fill="#b04a2f">트렌드를 읽다</text>
  <text x="96" y="430" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="27" fill="#6b6862">읽고 밀웜 모아 나만의 크라미 꾸미기</text>
</svg>`;

const mascot = await sharp(MASCOT).resize(460, 460, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

await sharp(Buffer.from(svg))
  .composite([{ input: mascot, left: W - 470, top: H - 470 }])
  .png()
  .toFile(OUT);

console.log('OG 생성 완료 →', OUT);
