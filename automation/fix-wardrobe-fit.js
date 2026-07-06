// 신규 의상 핏 보정 — 알파메일 정장(out_alpha, 수동 정렬 골드 스탠더드)의 알파 bbox 기준으로
// 폭 정규화(uniform scale) + 상단(목선)·중심 X 앵커 정렬. 멱등(원본은 .orig 백업에서 재보정).
// + 한쪽 눈 안경(모노클→오른눈, 안대→왼눈) 콘텐츠 시프트.
// 사용법: node fix-wardrobe-fit.js [--dry] [id...]
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const DIR = path.resolve('../site/public/img/wardrobe');
const BACKUP = path.resolve('output/wardrobe-orig');
const GOLD = 'out_alpha';

// 보정 대상: 신규 생성 의상 22종(기존 수동 정렬 6종 제외)
const OUTFITS = ['out_hanbok','out_tux','out_track','out_pajama','out_raincoat','out_lifevest','out_soccer','out_baseball','out_taekwondo','out_apron','out_hero','out_dracula','out_santa','out_cowboy','out_doctor','out_police','out_fire','out_space','out_hoodie','out_vest','out_reindeer','out_hawaii','out_padding','out_school'];
// 한쪽 눈 액세서리: 캔버스 내 콘텐츠를 눈 위치로 시프트(안경 박스에서 눈 중심 ≈ 30%/70%)
const ONE_EYE = { gls_monocle: +0.20, gls_patch: -0.20 };

async function bbox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = 0, maxY = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 20) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  return { w: info.width, h: info.height, minX, minY, maxX, maxY, bw: maxX - minX + 1, bh: maxY - minY + 1 };
}

async function loadSource(id) {
  // 백업이 있으면 백업(진짜 원본)에서, 없으면 현재 파일을 백업 후 사용 → 재실행해도 이중 보정 없음
  const cur = path.join(DIR, `${id}.webp`);
  const bak = path.join(BACKUP, `${id}.webp`);
  try { await fs.access(bak); } catch { await fs.mkdir(BACKUP, { recursive: true }); await fs.copyFile(cur, bak); }
  return await fs.readFile(bak);
}

const dry = process.argv.includes('--dry');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// ── 기준: 알파 정장 bbox ──
const goldBuf = await fs.readFile(path.join(DIR, `${GOLD}.webp`));
const g = await bbox(goldBuf);
const target = { cx: (g.minX + g.maxX) / 2, top: g.minY, w: g.bw, canvas: g.w };
console.log(`기준(${GOLD}): 폭 ${g.bw} · 목선 y ${g.minY} · 중심 x ${Math.round(target.cx)} (캔버스 ${g.w})`);

// ── 의상 보정 ──
for (const id of only.length ? OUTFITS.filter((i) => only.includes(i)) : OUTFITS) {
  const src = await loadSource(id);
  const b = await bbox(src);
  let s = target.w / b.bw;
  s = Math.max(0.55, Math.min(1.25, s));
  if (dry) { console.log(`${id}: bbox ${b.bw}x${b.bh} → scale ${s.toFixed(3)}`); continue; }
  // bbox 영역만 추출 → 스케일 → 목표 위치에 배치(캔버스 밖은 클리핑)
  const regW = Math.round(b.bw * s), regH = Math.round(b.bh * s);
  let region = await sharp(src).extract({ left: b.minX, top: b.minY, width: b.bw, height: b.bh }).resize(regW, regH).png().toBuffer();
  let left = Math.round(target.cx - regW / 2);
  let top = Math.round(target.top);
  let cw = regW, chh = regH, cropX = 0, cropY = 0;
  if (left < 0) { cropX = -left; cw += left; left = 0; }
  if (top < 0) { cropY = -top; chh += top; top = 0; }
  if (left + cw > target.canvas) cw = target.canvas - left;
  if (top + chh > target.canvas) chh = target.canvas - top;
  if (cropX || cropY || cw !== regW || chh !== regH) {
    region = await sharp(region).extract({ left: cropX, top: cropY, width: cw, height: chh }).png().toBuffer();
  }
  console.log(`${id}: bbox ${b.bw}x${b.bh} → scale ${s.toFixed(3)}, place(${left},${top}) ${cw}x${chh}`);
  await sharp({ create: { width: target.canvas, height: target.canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: region, left, top }])
    .webp({ quality: 84, alphaQuality: 100 })
    .toFile(path.join(DIR, `${id}.webp`));
}

// ── 한쪽 눈 안경 시프트 ──
for (const [id, dxRatio] of Object.entries(ONE_EYE)) {
  if (only.length && !only.includes(id)) continue;
  const src = await loadSource(id);
  const meta = await sharp(src).metadata();
  const dx = Math.round(meta.width * dxRatio);
  console.log(`${id}: ${dx > 0 ? '오른눈' : '왼눈'}으로 ${dx}px 시프트`);
  if (dry) continue;
  await sharp({ create: { width: meta.width, height: meta.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: await sharp(src).png().toBuffer(), left: dx, top: 0 }])
    .webp({ quality: 84, alphaQuality: 100 })
    .toFile(path.join(DIR, `${id}.webp`));
}
console.log(dry ? '(dry-run — 파일 미변경)' : '완료');
