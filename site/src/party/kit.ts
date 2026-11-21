// 방송·회식 추첨 게임(/party/*) 공용 도구 — 이름 입력, 방송 모드, 효과음, 꽃가루, 흔들기, 결과 창.
// 서버로 아무것도 보내지 않는다. 이름은 이 기기(localStorage crama:party:<game>)에만 저장.

export const PALETTE = ['#6C5CE7', '#FF6B6B', '#20C997', '#FFB020', '#3B82F6', '#EC4899', '#14B8A6', '#F97316', '#8B5CF6', '#84CC16', '#06B6D4', '#EF4444'];

/** 줄바꿈·쉼표로 나눈 이름 목록(빈칸 제거, 최대 max개) */
export function parseList(text: string, max = 30): string[] {
  return text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).slice(0, max);
}

/**
 * 참가자 목록: 한 줄(또는 쉼표)에 한 명. '민수 x3', '민수*3', '민수×3'처럼 쓰면 같은 이름으로 여러 개를 넣는다.
 * 같은 이름이 여러 개면 '민수 #1', '민수 #2'로 구분한다. 최대 max개.
 */
export function parseEntries(text: string, max = 300): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[\n,]/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(/^(.*?)\s*[xX×*]\s*(\d{1,3})$/);
    const name = (m ? m[1] : t).trim() || t;
    const n = m ? Math.max(1, Math.min(300, +m[2])) : 1;
    for (let i = 0; i < n && out.length < max; i++) out.push(name);
    if (out.length >= max) break;
  }
  const total: Record<string, number> = {}, seen: Record<string, number> = {};
  out.forEach((n) => { total[n] = (total[n] || 0) + 1; });
  return out.map((n) => (total[n] > 1 ? `${n} #${(seen[n] = (seen[n] || 0) + 1)}` : n));
}

/** 주소의 ?names= 가 있으면 그 값을, 없으면 저장된 값을 입력칸에 넣는다 */
export function initNames(game: string, el: HTMLTextAreaElement, fallback: string, param = 'names') {
  const q = new URLSearchParams(location.search).get(param);
  let v = q ? q.split(',').join('\n') : '';
  if (!v) { try { v = localStorage.getItem(`crama:party:${game}:${param}`) || ''; } catch { /* 저장소 막힘 */ } }
  el.value = v || fallback;
  el.addEventListener('change', () => { try { localStorage.setItem(`crama:party:${game}:${param}`, el.value); } catch { /* 무시 */ } });
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const pickOne = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle<T>(arr: T[]): T[] { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ── 효과음: 파일 없이 WebAudio로 합성 ──
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem('crama:party:mute') === '1'; } catch { /* 무시 */ }
if (new URLSearchParams(location.search).get('mute') === '1') muted = true;
export const isMuted = () => muted;
export function setMuted(v: boolean) { muted = v; try { localStorage.setItem('crama:party:mute', v ? '1' : '0'); } catch { /* 무시 */ } }
function ac() { if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.15, slideTo?: number, delay = 0) {
  if (muted) return;
  const a = ac(); const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur: number, vol = 0.3, delay = 0) {
  if (muted) return;
  const a = ac(); const t = a.currentTime + delay;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const s = a.createBufferSource(); const g = a.createGain(); const f = a.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900; s.buffer = buf; g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}
export const sfx = {
  tick: (hi = false) => tone(hi ? 1400 : 950, 0.05, 'square', 0.06),
  click: () => tone(600, 0.04, 'triangle', 0.08),
  pop: () => tone(500, 0.12, 'sine', 0.12, 900),
  boost: () => tone(300, 0.25, 'sawtooth', 0.06, 1200),
  slip: () => tone(700, 0.3, 'triangle', 0.08, 150),
  peg: () => tone(rand(1200, 1800), 0.03, 'sine', 0.035),
  land: () => { tone(420, 0.1, 'square', 0.07); tone(630, 0.14, 'square', 0.06, undefined, 0.08); },
  drum: (n = 1) => { for (let i = 0; i < n; i++) noise(0.06, 0.18, i * 0.07); },
  fanfare: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i === 3 ? 0.5 : 0.16, 'triangle', 0.12, undefined, i * 0.13)),
  sad: () => [392, 370, 349, 262].forEach((f, i) => tone(f, i === 3 ? 0.6 : 0.22, 'sawtooth', 0.06, undefined, i * 0.22)),
  boom: () => { noise(1.1, 0.7); tone(120, 0.9, 'sine', 0.35, 30); },
  coin: () => { tone(988, 0.08, 'square', 0.06); tone(1319, 0.25, 'square', 0.06, undefined, 0.08); },
};

// ── 화면 효과 ──
export function shake(el: HTMLElement, power = 12, ms = 500) {
  const t0 = performance.now();
  const step = (t: number) => {
    const k = 1 - (t - t0) / ms;
    if (k <= 0) { el.style.transform = ''; return; }
    el.style.transform = `translate(${(Math.random() - 0.5) * power * k}px, ${(Math.random() - 0.5) * power * k}px)`;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
export function flash(color = '#fff', ms = 350) {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;inset:0;background:${color};z-index:9998;pointer-events:none;opacity:.85;transition:opacity ${ms}ms`;
  document.body.appendChild(d); requestAnimationFrame(() => { d.style.opacity = '0'; }); setTimeout(() => d.remove(), ms + 50);
}
export function confetti(n = 160) {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999';
  document.body.appendChild(c);
  const dpr = Math.min(2, devicePixelRatio || 1); c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const g = c.getContext('2d')!; g.scale(dpr, dpr);
  const ps = Array.from({ length: n }, () => ({ x: innerWidth / 2 + rand(-80, 80), y: innerHeight * 0.35, vx: rand(-9, 9), vy: rand(-14, -4), r: rand(0, 6.3), vr: rand(-0.3, 0.3), w: rand(6, 11), h: rand(8, 16), c: pickOne(PALETTE) }));
  const t0 = performance.now();
  const step = (t: number) => {
    g.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach((p) => { p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore(); });
    if (t - t0 < 3200) requestAnimationFrame(step); else c.remove();
  };
  requestAnimationFrame(step);
}

// ── 방송 모드 ──
/** 무대(stage)를 화면 전체로 키우고 사이트 머리·꼬리를 숨긴다. ?stream=1 이면 바로 켠다. ?bg=green|dark|transparent */
export function initStream(stage: HTMLElement, btn: HTMLElement | null, linkBtn: HTMLElement | null, buildLink: () => string) {
  const q = new URLSearchParams(location.search);
  const bg = q.get('bg');
  const on = (v: boolean) => {
    document.body.classList.toggle('py-streaming', v);
    // 투명 배경(OBS 크로마키 없이 겹치기): 무대 밖 사이트 화면을 모두 숨긴다
    document.body.classList.toggle('py-transparent', v && bg === 'transparent');
    stage.classList.toggle('is-stream', v);
    if (bg) stage.dataset.bg = bg;
    if (btn) btn.textContent = v ? '방송 모드 끄기 (Esc)' : '방송 모드';
    window.dispatchEvent(new Event('resize'));
  };
  if (q.get('stream') === '1') on(true);
  btn?.addEventListener('click', () => on(!stage.classList.contains('is-stream')));
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && stage.classList.contains('is-stream')) on(false); });
  linkBtn?.addEventListener('click', async () => {
    const url = buildLink();
    try { await navigator.clipboard.writeText(url); linkBtn.textContent = '복사했어요!'; } catch { prompt('이 주소를 복사하세요', url); }
    setTimeout(() => { linkBtn.textContent = '방송용 링크 복사'; }, 1800);
    try { (window as any).gtag?.('event', 'party_stream_link', { page: location.pathname }); } catch { /* 무시 */ }
  });
}

/** 방송용 주소: 이름 + stream=1 (+ 초록 배경 선택) */
export function streamUrl(params: Record<string, string>, green = false) {
  const u = new URL(location.origin + location.pathname);
  Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
  u.searchParams.set('stream', '1');
  if (green) u.searchParams.set('bg', 'green');
  return u.toString();
}

/** 소리 켜기/끄기 버튼 */
export function initMute(btn: HTMLElement | null) {
  if (!btn) return;
  const paint = () => { btn.textContent = isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐'; };
  paint();
  btn.addEventListener('click', () => { setMuted(!isMuted()); paint(); });
}

/** 결과 문장 공유(복사) */
export async function copyText(text: string, btn?: HTMLElement) {
  try { await navigator.clipboard.writeText(text); if (btn) { const o = btn.textContent; btn.textContent = '복사했어요!'; setTimeout(() => { btn.textContent = o; }, 1600); } }
  catch { prompt('복사해서 보내세요', text); }
}

export function track(name: string, params: Record<string, unknown> = {}) {
  try { (window as any).gtag?.('event', name, params); } catch { /* 무시 */ }
}
