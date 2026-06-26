// 마스코트(스카프 제거본)를 머리/몸통 두 레이어로 분리.
//   z순서 합성: 몸통 < 의상·스카프 < 머리 < 안경·모자  (옷이 몸에 자연스럽게 겹침)
//   사용법: node gen-mascot-split.js [cutFraction]   (기본 0.52 — 목/턱 라인)
import sharp from 'sharp';
const G = '../site/public/img/generated/';
const SRC = G + 'meerkat-baby-stand-noscarf.webp';
const CUTF = parseFloat(process.argv[2]) || 0.52;
const { width: W, height: H } = await sharp(SRC).metadata();
const CUT = Math.round(H * CUTF);
const T = { r: 0, g: 0, b: 0, alpha: 0 };
await sharp(SRC).extract({ left: 0, top: 0, width: W, height: CUT })
  .extend({ top: 0, bottom: H - CUT, left: 0, right: 0, background: T })
  .webp({ quality: 90, alphaQuality: 100 }).toFile(G + 'meerkat-head.webp');
await sharp(SRC).extract({ left: 0, top: CUT, width: W, height: H - CUT })
  .extend({ top: CUT, bottom: 0, left: 0, right: 0, background: T })
  .webp({ quality: 90, alphaQuality: 100 }).toFile(G + 'meerkat-body.webp');
console.log(`머리/몸통 분리 완료 (cut y=${CUT}/${H}, ${CUTF})`);
