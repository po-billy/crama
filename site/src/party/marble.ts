// 구슬 레이스 엔진 — matter-js 물리 + 세로로 긴 코스 + 선두를 따라가는 카메라.
// 화면 그리기는 캔버스, 순위표·중계는 페이지(DOM)가 콜백으로 받아 그린다.
import Matter from 'matter-js';

const { Engine, Bodies, Body, Composite, Events } = Matter;

export const WORLD_W = 720;
export const WORLD_H = 5200;
const R = 11; // 구슬 반지름
const WALL_L = 24, WALL_R = WORLD_W - 24;

export type Racer = {
  id: number; name: string; color: string; body: Matter.Body;
  done: boolean; place: number; time: number; still: number; lastY: number; flash: number; col: number; gone: boolean; trail: { x: number; y: number }[];
};
export type Section = { y: number; no: string; name: string; color: string };
export type MarbleEvent =
  | { type: 'leader'; r: Racer } | { type: 'finish'; r: Racer; photo: boolean }
  | { type: 'bumper'; r: Racer } | { type: 'boost'; r: Racer } | { type: 'mud'; r: Racer } | { type: 'section'; s: Section }
  | { type: 'peg' } | { type: 'spin' };

type Deco = { kind: 'peg' | 'bumper' | 'seg' | 'spinner' | 'boost' | 'mud' | 'finish'; body?: Matter.Body; x: number; y: number; w?: number; h?: number; r?: number; hit: number; color: string; pivot?: { x: number; y: number }; speed?: number };

export const SECTIONS: Section[] = [
  { y: 0, no: '01', name: 'START', color: '#B9AFFF' },
  { y: 250, no: '02', name: 'FUNNEL', color: '#7DD3FC' },
  { y: 520, no: '03', name: 'PEG FIELD', color: '#FDE68A' },
  { y: 1340, no: '04', name: 'ZIGZAG', color: '#86EFAC' },
  { y: 2320, no: '05', name: 'BUMPERS', color: '#FDA4AF' },
  { y: 3040, no: '06', name: 'SPINNERS', color: '#C4B5FD' },
  { y: 3700, no: '07', name: 'RUSH', color: '#FCD34D' },
  { y: 4360, no: '08', name: 'FINAL', color: '#FFFFFF' },
];
const FINISH_Y = 4960;

export class MarbleRace {
  engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0009 }, positionIterations: 8, velocityIterations: 6 });
  racers: Racer[] = [];
  decos: Deco[] = [];
  finished: Racer[] = [];
  gate: Matter.Body | null = null;
  t = 0; // 경과 초(게이트 열린 뒤)
  running = false;
  leader: Racer | null = null;
  follow: Racer | null = null;
  section = 0;
  markLast = false; // 꼴찌 당첨 모드: 현재 꼴찌 표시
  cam = { x: 0, y: 0 };
  zoom = 0;
  bgFill = true; // 방송 초록·투명 배경이면 코스 바깥을 칠하지 않는다
  sparks: { x: number; y: number; vx: number; vy: number; life: number; c: string }[] = [];
  burst(x: number, y: number, c: string, n = 12, sp = 4) {
    for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, v = sp * (0.4 + Math.random()); this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, c }); }
    if (this.sparks.length > 300) this.sparks.splice(0, this.sparks.length - 300);
  }
  onEvent: (e: MarbleEvent) => void = () => {};
  private acc = 0;
  private lastPeg = 0;

  constructor(names: string[], colors: string[]) {
    this.buildMap(names.length);
    const cols = Math.min(24, Math.max(4, Math.ceil(Math.sqrt(names.length * 2.2))));
    const gap = (WALL_R - WALL_L - 60) / (cols - 1);
    const order = names.map((_, i) => i).sort(() => Math.random() - 0.5);
    names.forEach((name, i) => {
      const k = order[i], c = k % cols, row = Math.floor(k / cols);
      const x = WALL_L + 30 + c * gap + (Math.random() - 0.5) * 6;
      const y = 200 - row * 26;
      const body = Bodies.circle(x, y, R, { restitution: 0.42, friction: 0.002, frictionAir: 0.0025, density: 0.002, label: 'marble' });
      (body as any).racer = i;
      Composite.add(this.engine.world, body);
      this.racers.push({ id: i, name, color: colors[i % colors.length], body, done: false, place: 0, time: 0, still: 0, lastY: y, flash: 0, col: c + row, gone: false, trail: [] });
    });
    this.follow = this.racers[0];
    this.cam.y = 0;
    Events.on(this.engine, 'collisionStart', (e) => this.collide(e.pairs, true));
    Events.on(this.engine, 'collisionEnd', (e) => this.collide(e.pairs, false));
  }

  // ── 코스 ──
  private stat(b: Matter.Body) { Composite.add(this.engine.world, b); return b; }
  private seg(x1: number, y1: number, x2: number, y2: number, color: string, thick = 14, opts: Matter.IBodyDefinition = {}) {
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1);
    const b = this.stat(Bodies.rectangle((x1 + x2) / 2, (y1 + y2) / 2, len, thick, { isStatic: true, angle: ang, friction: 0.06, restitution: 0.2, label: 'seg', ...opts }));
    this.decos.push({ kind: 'seg', body: b, x: (x1 + x2) / 2, y: (y1 + y2) / 2, w: len, h: thick, hit: 0, color });
  }
  private peg(x: number, y: number, color: string, r = 6) {
    const b = this.stat(Bodies.circle(x, y, r, { isStatic: true, restitution: 0.5, friction: 0.01, label: 'peg' }));
    this.decos.push({ kind: 'peg', body: b, x, y, r, hit: 0, color });
  }
  private buildMap(n: number) {
    const w = this.engine.world;
    Composite.add(w, [
      Bodies.rectangle(WALL_L - 20, WORLD_H / 2, 40, WORLD_H + 400, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(WALL_R + 20, WORLD_H / 2, 40, WORLD_H + 400, { isStatic: true, label: 'wall' }),
      Bodies.rectangle(WORLD_W / 2, WORLD_H + 10, WORLD_W, 40, { isStatic: true, label: 'floor' }),
    ]);
    // 01 출발 게이트
    this.gate = Bodies.rectangle(WORLD_W / 2, 226, WORLD_W, 12, { isStatic: true, label: 'gate' });
    Composite.add(w, this.gate);
    // 02 깔때기
    const c2 = SECTIONS[1].color;
    this.seg(WALL_L, 260, 300, 470, c2); this.seg(WALL_R, 260, 420, 470, c2);
    // 03 못 판
    const c3 = SECTIONS[2].color;
    for (let r = 0; r < 15; r++) for (let x = 60 + (r % 2) * 32; x < WALL_R - 20; x += 64) this.peg(x, 560 + r * 50, c3);
    // 04 지그재그 경사로(완만해서 천천히 굴러간다)
    const c4 = SECTIONS[3].color;
    for (let i = 0; i < 5; i++) {
      const y0 = 1400 + i * 185;
      if (i % 2 === 0) this.seg(WALL_L, y0, 570, y0 + 140, c4, 14, { friction: 0.02 });
      else this.seg(WALL_R, y0, 150, y0 + 140, c4, 14, { friction: 0.02 });
    }
    // 05 범퍼
    const c5 = SECTIONS[4].color;
    [[2400, [180, 360, 540]], [2540, [270, 450]], [2680, [150, 360, 570]], [2820, [270, 450]], [2950, [200, 520]]].forEach(([y, xs]) => (xs as number[]).forEach((x) => {
      const b = this.stat(Bodies.circle(x, y as number, 28, { isStatic: true, restitution: 1.1, label: 'bumper' }));
      this.decos.push({ kind: 'bumper', body: b, x, y: y as number, r: 28, hit: 0, color: c5 });
    }));
    for (let r = 0; r < 5; r++) for (let x = 90 + (r % 2) * 90; x < WALL_R - 40; x += 180) this.peg(x, 2470 + r * 140, c5, 6);
    // 06 회전 막대(가운데를 축으로 도는 막대)
    const c6 = SECTIONS[5].color;
    [[210, 3140, 2.4], [510, 3290, -2.8], [210, 3440, 3.0], [510, 3590, -2.4]].forEach(([x, y, s]) => {
      const b = Bodies.rectangle(x, y, 230, 12, { isStatic: true, friction: 0.02, restitution: 0.6, label: 'spinner' });
      Composite.add(w, b);
      this.decos.push({ kind: 'spinner', body: b, x, y, w: 230, h: 12, hit: 0, color: c6, pivot: { x, y }, speed: s });
      this.peg(x, y, c6, 9);
    });
    for (let r = 0; r < 4; r++) {
      const y = 3215 + r * 150;
      if (r % 2 === 0) this.seg(WALL_R, y - 30, WALL_R - 150, y + 10, c6, 10); else this.seg(WALL_L, y - 30, WALL_L + 150, y + 10, c6, 10);
    }
    // 07 러시: 가속 패드 → 감속 늪 → 좁은 병목
    const c7 = SECTIONS[6].color;
    [[200, 3760], [520, 3760], [360, 3830]].forEach(([x, y]) => {
      const b = this.stat(Bodies.rectangle(x, y, 120, 26, { isStatic: true, isSensor: true, label: 'boost' }));
      this.decos.push({ kind: 'boost', body: b, x, y, w: 120, h: 26, hit: 0, color: c7 });
    });
    const mud = this.stat(Bodies.rectangle(WORLD_W / 2, 3950, WALL_R - WALL_L, 110, { isStatic: true, isSensor: true, label: 'mud' }));
    this.decos.push({ kind: 'mud', body: mud, x: WORLD_W / 2, y: 3950, w: WALL_R - WALL_L, h: 110, hit: 0, color: '#A16207' });
    // 병목: 인원이 많으면 입구를 넓혀 막히지 않게
    const half = n > 120 ? 95 : n > 50 ? 70 : 42, bl = WORLD_W / 2 - half, br = WORLD_W / 2 + half;
    this.seg(WALL_L, 4060, bl, 4220, c7); this.seg(WALL_R, 4060, br, 4220, c7);
    this.seg(bl, 4220, bl, 4300, c7, 10); this.seg(br, 4220, br, 4300, c7, 10);
    // 08 마지막 못 판 + 결승선 + 받침
    const c8 = SECTIONS[7].color;
    for (let r = 0; r < 9; r++) for (let x = 84 + (r % 2) * 40; x < WALL_R - 30; x += 80) this.peg(x, 4400 + r * 58, c8, 7);
    const fin = this.stat(Bodies.rectangle(WORLD_W / 2, FINISH_Y, WALL_R - WALL_L, 10, { isStatic: true, isSensor: true, label: 'finish' }));
    this.decos.push({ kind: 'finish', body: fin, x: WORLD_W / 2, y: FINISH_Y, w: WALL_R - WALL_L, h: 10, hit: 0, color: '#fff' });
    this.seg(WALL_L, 5060, WORLD_W / 2 - 4, 5150, '#444', 14); this.seg(WALL_R, 5060, WORLD_W / 2 + 4, 5150, '#444', 14);
  }

  private collide(pairs: Matter.Pair[], start: boolean) {
    for (const p of pairs) {
      const [m, o] = p.bodyA.label === 'marble' ? [p.bodyA, p.bodyB] : p.bodyB.label === 'marble' ? [p.bodyB, p.bodyA] : [null, null];
      if (!m || !o) continue;
      const r = this.racers[(m as any).racer];
      const d = this.decos.find((x) => x.body === o);
      if (!start) { if (o.label === 'mud') m.frictionAir = 0.0025; continue; }
      if (d) d.hit = 1;
      switch (o.label) {
        case 'peg': { const now = performance.now(); if (now - this.lastPeg > 55) { this.lastPeg = now; this.onEvent({ type: 'peg' }); } break; }
        case 'bumper': {
          const dx = m.position.x - o.position.x, dy = m.position.y - o.position.y, len = Math.hypot(dx, dy) || 1;
          Body.setVelocity(m, { x: (dx / len) * 9, y: (dy / len) * 9 });
          r.flash = 1; this.burst(m.position.x, m.position.y, '#FDA4AF', 14, 4);
          if (r === this.leader) this.onEvent({ type: 'bumper', r });
          break;
        }
        case 'spinner': if (r === this.leader) this.onEvent({ type: 'spin' }); break;
        case 'boost': Body.setVelocity(m, { x: m.velocity.x * 1.1, y: Math.max(m.velocity.y, 0) + 8 }); r.flash = 1; if (r === this.leader || Math.random() < 0.2) this.onEvent({ type: 'boost', r }); break;
        case 'mud': m.frictionAir = 0.07; if (r === this.leader) this.onEvent({ type: 'mud', r }); break;
        case 'finish': this.finishRacer(r); break;
      }
    }
  }

  finishRacer(r: Racer) {
    if (r.done) return;
    r.done = true; r.time = this.t; r.place = this.finished.length + 1;
    const prev = this.finished[this.finished.length - 1];
    this.finished.push(r);
    this.burst(r.body.position.x, FINISH_Y, r.place === 1 ? '#FFC83D' : r.color, r.place === 1 ? 40 : 12, r.place === 1 ? 7 : 4);
    this.onEvent({ type: 'finish', r, photo: !!prev && r.time - prev.time < 0.18 });
  }

  /** 시간 초과: 남은 구슬을 현재 위치 순서대로 골인 처리 */
  forceFinish() { this.ranking().filter((r) => !r.done).forEach((r) => this.finishRacer(r)); }

  open() { if (this.gate) { Composite.remove(this.engine.world, this.gate); this.gate = null; } this.running = true; }

  /** 진행 순위: 골인한 순서, 그다음 아래로 많이 내려온 순서 */
  ranking(): Racer[] {
    const rest = this.racers.filter((r) => !r.done).sort((a, b) => b.body.position.y - a.body.position.y);
    return [...this.finished, ...rest];
  }

  step(dtMs: number) {
    this.acc += Math.min(dtMs, 50);
    const h = 1000 / 60;
    while (this.acc >= h) {
      this.acc -= h;
      // 회전 막대: 축에 고정한 채 일정 속도로 돌린다
      for (const d of this.decos) if (d.kind === 'spinner' && d.body && d.pivot) {
        const da = (d.speed! * h) / 1000;
        Body.setAngle(d.body, d.body.angle + da); Body.setAngularVelocity(d.body, da);
      }
      Engine.update(this.engine, h);
      if (this.running) this.t += h / 1000;
    }
    // 골인하고 시간이 지난 구슬은 치워서 바닥에 쌓이지 않게 한다
    for (const r of this.racers) if (r.done && !r.gone && this.t - r.time > 1.6) { Composite.remove(this.engine.world, r.body); r.gone = true; }
    // 끼임 방지: 거의 안 움직이면 살짝 밀어 준다
    for (const r of this.racers) {
      if (r.done || !this.running) continue;
      if (r.body.position.y > FINISH_Y + 14) this.finishRacer(r); // 결승선 감지를 빠르게 지나친 경우
      if (r.done) continue;
      const px = r.body.position.x; // 벽 밖으로 튀어 나간 구슬은 안쪽으로 되돌린다
      if (px < WALL_L + R || px > WALL_R - R) { Body.setPosition(r.body, { x: Math.max(WALL_L + R + 1, Math.min(WALL_R - R - 1, px)), y: r.body.position.y }); Body.setVelocity(r.body, { x: -r.body.velocity.x * 0.5, y: r.body.velocity.y }); }
      const moved = Math.abs(r.body.position.y - r.lastY);
      r.still = moved < 0.15 ? r.still + dtMs : 0;
      r.lastY = r.body.position.y;
      if (r.still > 1800) { Body.setVelocity(r.body, { x: (Math.random() - 0.5) * 7, y: -3 }); r.still = 0; }
      r.flash = Math.max(0, r.flash - dtMs / 500);
      r.trail.push({ x: r.body.position.x, y: r.body.position.y }); if (r.trail.length > 14) r.trail.shift();
    }
    for (const d of this.decos) d.hit = Math.max(0, d.hit - dtMs / 400);
    for (const p of this.sparks) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.vx *= 0.96; p.life -= dtMs / 600; }
    this.sparks = this.sparks.filter((p) => p.life > 0);
    // 선두·카메라 대상
    const rank = this.ranking();
    const aliveLead = rank.find((r) => !r.done) || null;
    const lead = rank[0];
    if (this.running && lead !== this.leader) { if (this.leader && !lead.done) this.onEvent({ type: 'leader', r: lead }); this.leader = lead; }
    this.follow = aliveLead || rank[rank.length - 1];
    const fy = this.follow.body.position.y;
    const s = SECTIONS.reduce((k, sec, i) => (fy >= sec.y ? i : k), 0);
    if (s > this.section && this.running) { this.section = s; this.onEvent({ type: 'section', s: SECTIONS[s] }); }
  }

  get allDone() { return this.racers.every((r) => r.done); }

  // ── 그리기 ──
  private sprites = new Map<string, HTMLCanvasElement>();
  /** 광택 구슬·금속 못 같은 둥근 물체는 한 번 그려 둔 그림(스프라이트)을 찍는다 */
  private sprite(kind: 'ball' | 'peg', color: string, rad: number) {
    const rr = Math.max(2, Math.round(rad * 2) / 2);
    const key = `${kind}|${color}|${rr}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const dpr = Math.min(2, (globalThis as any).devicePixelRatio || 1);
    const pad = Math.ceil(rr * 0.6) + 2, size = Math.ceil((rr + pad) * 2);
    c = document.createElement('canvas'); c.width = size * dpr; c.height = size * dpr;
    const g = c.getContext('2d')!; g.scale(dpr, dpr);
    const m = size / 2;
    // 그림자
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(m + rr * 0.25, m + rr * 0.45, rr * 0.95, rr * 0.7, 0, 0, 7); g.fill();
    if (kind === 'ball') {
      const gr = g.createRadialGradient(m - rr * 0.4, m - rr * 0.45, rr * 0.1, m, m, rr);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.22, color); gr.addColorStop(0.85, shade(color, -0.35)); gr.addColorStop(1, shade(color, -0.55));
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, rr, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.beginPath(); g.arc(m, m, rr - 0.5, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(m - rr * 0.38, m - rr * 0.45, rr * 0.28, rr * 0.17, -0.6, 0, 7); g.fill();
    } else {
      const gr = g.createRadialGradient(m - rr * 0.35, m - rr * 0.4, 0, m, m, rr);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.35, color); gr.addColorStop(1, shade(color, -0.5));
      g.fillStyle = gr; g.beginPath(); g.arc(m, m, rr, 0, 7); g.fill();
    }
    this.sprites.set(key, c);
    return c;
  }
  private stamp(g: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number) {
    const dpr = Math.min(2, (globalThis as any).devicePixelRatio || 1), s = c.width / dpr;
    g.drawImage(c, x - s / 2, y - s / 2, s, s);
  }

  draw(g: CanvasRenderingContext2D, W: number, H: number, padRight: number, ls = 1) {
    const viewW = W - padRight;
    const now = performance.now() / 1000;
    // 출발 전에는 코스 폭 전체를 보여 주고, 출발하면 좁은 화면에서 확대해 선두를 따라간다
    const target = Math.min(1.2, viewW / (this.running && viewW < 560 ? 470 : WORLD_W));
    this.zoom = this.zoom ? this.zoom + (target - this.zoom) * 0.05 : target;
    const scale = this.zoom;
    const vw = viewW / scale, vh = H / scale;
    const f = this.follow ? this.follow.body.position : { x: WORLD_W / 2, y: 0 };
    const tx = Math.max(0, Math.min(WORLD_W - vw, f.x - vw / 2));
    const ty = Math.max(-20, Math.min(WORLD_H - vh + 20, f.y - vh * 0.42));
    this.cam.x += (tx - this.cam.x) * 0.12; this.cam.y += (ty - this.cam.y) * 0.1;
    const offX = vw > WORLD_W ? (viewW - WORLD_W * scale) / 2 : 0;
    const sx = (x: number) => (x - this.cam.x) * scale + offX, sy = (y: number) => (y - this.cam.y) * scale;
    const L = sx(WALL_L), Rr = sx(WALL_R), CW = Rr - L;
    g.clearRect(0, 0, W, H);
    g.save();
    g.beginPath(); g.rect(0, 0, viewW, H); g.clip();

    // 배경: 코스 바깥은 어둡게, 코스 바닥은 구간 색이 살짝 섞인 판
    if (this.bgFill) { g.fillStyle = '#0B0920'; g.fillRect(0, 0, viewW, H); }
    SECTIONS.forEach((sec, i) => {
      const y0 = sy(sec.y), y1 = sy(SECTIONS[i + 1]?.y ?? WORLD_H);
      if (y1 < 0 || y0 > H) return;
      const gr = g.createLinearGradient(0, y0, 0, y1);
      gr.addColorStop(0, mix('#17143A', sec.color, 0.1)); gr.addColorStop(1, mix('#120F2C', sec.color, 0.04));
      g.fillStyle = gr; g.fillRect(L, y0, CW, y1 - y0);
    });
    // 바닥 무늬(시차를 둔 점 격자 — 카메라가 움직일 때 깊이감)
    const step = 34 * scale, par = 0.6;
    const oy = (-this.cam.y * scale * par) % step;
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = oy; y < H; y += step) for (let x = L + ((y - oy) / step % 2 ? step / 2 : 0) + step / 2; x < Rr; x += step) g.fillRect(x, y, 1.6, 1.6);
    // 구간 경계선 + 표지판
    SECTIONS.forEach((sec) => {
      const y = sy(sec.y);
      if (y < -60 || y > H + 60) return;
      g.strokeStyle = sec.color; g.globalAlpha = 0.45; g.lineWidth = 1.5; g.setLineDash([8 * scale, 8 * scale]);
      g.beginPath(); g.moveTo(L, y); g.lineTo(Rr, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
      const fs = Math.max(10, Math.round(13 * scale * ls));
      g.font = `900 ${fs}px Pretendard, sans-serif`;
      const t1 = sec.no, t2 = sec.name, w1 = g.measureText(t1).width + 12, w2 = g.measureText(t2).width + 14, hh = fs * 1.8;
      const bx = L + 10, by = y + 8;
      g.fillStyle = sec.color; rrect(g, bx, by, w1, hh, 5); g.fill();
      g.fillStyle = 'rgba(11,9,32,.9)'; rrect(g, bx + w1 - 2, by, w2, hh, 5); g.fill();
      g.textBaseline = 'middle'; g.textAlign = 'left';
      g.fillStyle = '#14112B'; g.fillText(t1, bx + 6, by + hh / 2 + 1);
      g.fillStyle = '#fff'; g.fillText(t2, bx + w1 + 5, by + hh / 2 + 1);
    });

    // 장식(구조물)
    for (const d of this.decos) {
      const y = sy(d.y); if (y < -220 || y > H + 220) continue;
      const x = sx(d.x);
      if (d.kind === 'peg') {
        const r = d.r! * scale;
        if (d.hit > 0) { g.fillStyle = hexA(d.color, d.hit * 0.45); g.beginPath(); g.arc(x, y, r * (1.6 + d.hit), 0, 7); g.fill(); }
        this.stamp(g, this.sprite('peg', d.hit > 0.5 ? '#ffffff' : d.color, r), x, y);
      } else if (d.kind === 'bumper') {
        const r = d.r! * scale;
        // 맞으면 퍼지는 고리
        if (d.hit > 0) { g.strokeStyle = hexA(d.color, d.hit); g.lineWidth = 3 * scale; g.beginPath(); g.arc(x, y, r + (1 - d.hit) * 30 * scale, 0, 7); g.stroke(); }
        g.save(); g.shadowColor = d.color; g.shadowBlur = 16 + d.hit * 24;
        const gr = g.createRadialGradient(x, y, r * 0.2, x, y, r);
        gr.addColorStop(0, shade(d.color, 0.3)); gr.addColorStop(0.7, d.color); gr.addColorStop(1, shade(d.color, -0.45));
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, r * (1 + d.hit * 0.08), 0, 7); g.fill(); g.restore();
        g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2.5 * scale; g.beginPath(); g.arc(x, y, r * 0.72, 0, 7); g.stroke();
        g.fillStyle = '#1B1638'; g.beginPath(); g.arc(x, y, r * 0.46, 0, 7); g.fill();
        g.fillStyle = d.hit > 0 ? '#fff' : d.color; g.font = `900 ${Math.round(r * 0.5)}px Pretendard, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('×2', x, y + 1);
      } else if (d.kind === 'seg' || d.kind === 'spinner') {
        const b = d.body!, ww = d.w! * scale, hh = Math.max(4, d.h! * scale);
        g.save(); g.translate(sx(b.position.x), sy(b.position.y)); g.rotate(b.angle);
        // 그림자
        g.fillStyle = 'rgba(0,0,0,.4)'; rrect(g, -ww / 2 + 3, -hh / 2 + 5, ww, hh, hh / 2); g.fill();
        // 몸체(위는 밝고 아래는 어두운 입체)
        const gr = g.createLinearGradient(0, -hh / 2, 0, hh / 2);
        gr.addColorStop(0, shade(d.color, 0.45)); gr.addColorStop(0.45, d.color); gr.addColorStop(1, shade(d.color, -0.45));
        g.fillStyle = gr; rrect(g, -ww / 2, -hh / 2, ww, hh, hh / 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-ww / 2 + hh / 2, -hh / 2 + 1.5, ww - hh, Math.max(1, hh * 0.14));
        if (d.kind === 'spinner') {
          g.fillStyle = 'rgba(20,17,43,.35)'; for (let k = -2; k <= 2; k++) g.fillRect(k * ww * 0.18 - 1.5, -hh / 2, 3, hh);
        }
        g.restore();
        if (d.kind === 'spinner') {
          const px = sx(d.pivot!.x), py = sy(d.pivot!.y), pr = 11 * scale;
          g.fillStyle = '#1B1638'; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
          g.strokeStyle = d.color; g.lineWidth = 3 * scale; g.beginPath(); g.arc(px, py, pr, 0, 7); g.stroke();
          g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, pr * 0.35, 0, 7); g.fill();
        }
      } else if (d.kind === 'boost') {
        const ww = d.w! * scale, hh = d.h! * scale;
        g.save(); g.shadowColor = '#FCD34D'; g.shadowBlur = 10 + d.hit * 20;
        g.fillStyle = '#2A2208'; rrect(g, x - ww / 2, y - hh / 2, ww, hh, 6); g.fill(); g.restore();
        g.strokeStyle = hexA('#FCD34D', 0.8); g.lineWidth = 1.5; rrect(g, x - ww / 2, y - hh / 2, ww, hh, 6); g.stroke();
        // 흘러내리는 화살표
        g.save(); rrect(g, x - ww / 2, y - hh / 2, ww, hh, 6); g.clip();
        const cs = hh * 0.9, off = ((now * 2.2) % 1) * cs;
        g.strokeStyle = hexA('#FCD34D', 0.95); g.lineWidth = 2.5 * scale; g.lineJoin = 'round';
        for (let cx = x - ww / 2 + cs * 0.6; cx < x + ww / 2; cx += cs * 1.1) for (let k = -1; k < 2; k++) {
          const cy = y - hh / 2 + k * cs + off;
          g.globalAlpha = 0.35 + 0.65 * (1 - Math.abs(cy - y) / hh);
          g.beginPath(); g.moveTo(cx - cs * 0.3, cy - cs * 0.15); g.lineTo(cx, cy + cs * 0.15); g.lineTo(cx + cs * 0.3, cy - cs * 0.15); g.stroke();
        }
        g.globalAlpha = 1; g.restore();
      } else if (d.kind === 'mud') {
        const ww = d.w! * scale, hh = d.h! * scale;
        const gr = g.createLinearGradient(0, y - hh / 2, 0, y + hh / 2);
        gr.addColorStop(0, 'rgba(120,72,20,.55)'); gr.addColorStop(1, 'rgba(70,40,10,.7)');
        g.fillStyle = gr; rrect(g, x - ww / 2, y - hh / 2, ww, hh, 10); g.fill();
        // 진흙 거품(위치 고정, 크기만 천천히 변함)
        for (let k = 0; k < 26; k++) {
          const bx = x - ww / 2 + ((k * 97) % 100) / 100 * ww, by = y - hh / 2 + ((k * 61) % 100) / 100 * hh;
          const br = (3 + (k % 4) * 2 + Math.sin(now * 2 + k) * 1.2) * scale;
          g.fillStyle = 'rgba(190,130,60,.35)'; g.beginPath(); g.arc(bx, by, Math.max(1, br), 0, 7); g.fill();
        }
        g.fillStyle = 'rgba(253,230,138,.75)'; g.font = `900 ${Math.round(15 * scale)}px Pretendard, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MUD · SLOW', x, y);
      } else if (d.kind === 'finish') {
        const ww = d.w! * scale, sq = 9 * scale;
        g.save(); g.shadowColor = '#FFC83D'; g.shadowBlur = 24; g.fillStyle = 'rgba(255,200,61,.25)'; g.fillRect(x - ww / 2, y - sq - 4, ww, sq * 2 + 8); g.restore();
        for (let i = 0; i * sq < ww; i++) for (let k = 0; k < 2; k++) { g.fillStyle = (i + k) % 2 ? '#fff' : '#111'; g.fillRect(x - ww / 2 + i * sq, y - sq + k * sq, Math.min(sq, ww - i * sq), sq); }
        // 양쪽 기둥과 불빛
        [x - ww / 2, x + ww / 2].forEach((px) => {
          g.fillStyle = '#2E2A5A'; g.fillRect(px - 4 * scale, y - 70 * scale, 8 * scale, 70 * scale);
          const on = Math.floor(now * 3) % 2 === 0;
          g.save(); g.shadowColor = '#FF4D6D'; g.shadowBlur = on ? 18 : 4; g.fillStyle = on ? '#FF4D6D' : '#7A2335'; g.beginPath(); g.arc(px, y - 70 * scale, 7 * scale, 0, 7); g.fill(); g.restore();
        });
        g.fillStyle = '#FFC83D'; g.font = `900 ${Math.round(34 * scale)}px Pretendard, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'bottom';
        g.save(); g.shadowColor = 'rgba(255,200,61,.8)'; g.shadowBlur = 14; g.fillText('FINISH', x, y - sq - 10 * scale); g.restore();
      }
    }

    // 벽(금속 레일)
    [L, Rr].forEach((wx, i) => {
      const gw = 10 * scale, x0 = i ? wx : wx - gw;
      const gr = g.createLinearGradient(x0, 0, x0 + gw, 0);
      gr.addColorStop(0, '#2B2656'); gr.addColorStop(0.5, '#6E64C8'); gr.addColorStop(1, '#2B2656');
      g.fillStyle = gr; g.fillRect(x0, 0, gw, H);
      g.fillStyle = 'rgba(185,175,255,.8)'; g.fillRect(wx - 0.75, 0, 1.5, H);
    });

    // 불꽃 입자
    for (const p of this.sparks) {
      g.fillStyle = hexA(p.c, Math.max(0, p.life)); g.beginPath(); g.arc(sx(p.x), sy(p.y), Math.max(0.5, 2.6 * scale * p.life), 0, 7); g.fill();
    }

    // 구슬 꼬리
    const rank = this.ranking();
    const lastAlive = this.markLast && this.running ? [...rank].reverse().find((r) => !r.done) : null;
    const labelOrder = [...this.racers].sort((a, b) => (a === this.follow ? 1 : 0) - (b === this.follow ? 1 : 0));
    g.lineCap = 'round';
    const many = this.racers.length > 40;
    const rankOf = new Map(rank.map((r, i) => [r, i]));
    for (const r of this.racers) {
      if (r.done || r.trail.length < 3 || (many && rankOf.get(r)! > 20 && r !== this.follow)) continue;
      const tp = r.trail; g.strokeStyle = r.color;
      for (let i = 1; i < tp.length; i++) { g.globalAlpha = (i / tp.length) * (r === this.follow ? 0.55 : 0.2); g.lineWidth = R * scale * (i / tp.length) * 1.5; g.beginPath(); g.moveTo(sx(tp[i - 1].x), sy(tp[i - 1].y)); g.lineTo(sx(tp[i].x), sy(tp[i].y)); g.stroke(); }
    }
    g.globalAlpha = 1;
    // 구슬
    const onScreen = this.racers.filter((r) => { const y = sy(r.body.position.y); return !r.gone && y > -40 && y < H + 40; }).length;
    for (const r of labelOrder) {
      if (r.gone) continue;
      const p = r.body.position, x = sx(p.x), y = sy(p.y);
      if (y < -40 || y > H + 40) continue;
      const rad = R * scale;
      if (r === this.follow && this.running) {
        const pul = 1 + Math.sin(now * 6) * 0.08;
        const gr = g.createRadialGradient(x, y, rad, x, y, rad * 3 * pul);
        gr.addColorStop(0, 'rgba(255,200,61,.45)'); gr.addColorStop(1, 'rgba(255,200,61,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad * 3 * pul, 0, 7); g.fill();
      }
      if (r.flash > 0) { g.fillStyle = `rgba(255,255,255,${r.flash * 0.6})`; g.beginPath(); g.arc(x, y, rad * 1.9, 0, 7); g.fill(); }
      this.stamp(g, this.sprite('ball', r.color, rad), x, y);
      if (r === rank[0] && this.running) { g.strokeStyle = '#FFC83D'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, rad + 2.5, 0, 7); g.stroke(); }
      if (r === lastAlive) { g.strokeStyle = '#FF4D6D'; g.lineWidth = 2.5; g.setLineDash([4, 3]); g.beginPath(); g.arc(x, y, rad + 3, now * 3, now * 3 + 6.28); g.stroke(); g.setLineDash([]); }
      if (r.done && r.place > 3) continue;
      // 화면에 구슬이 너무 많으면 앞선 순위만 이름을 단다(따라가는 구슬·꼴찌는 항상)
      if (onScreen > 45 && rankOf.get(r)! > 30 && r !== this.follow && r !== lastAlive) continue;
      // 이름(전체) — 구슬 밖 말풍선
      const pre = !this.running;
      const isF = r === this.follow && !pre;
      const fs = Math.round((pre ? (viewW < 560 ? 10 : 12) : isF ? 15 : 12) * ls);
      g.font = `800 ${fs}px Pretendard, sans-serif`;
      const label = (r.done ? `${r.place}위 ` : r === lastAlive ? '꼴찌 ' : '') + r.name;
      const tw = g.measureText(label).width, bw = tw + (isF ? 16 : 13), bh = fs * 1.75;
      const right = x + rad + 8 + bw < viewW;
      let lx = right ? x + rad + 7 : x - rad - 7 - bw, ly = y;
      if (pre) { lx = Math.max(2, Math.min(viewW - bw - 2, x - bw / 2)); ly = y + (r.col % 2 ? 1 : -1) * (rad + fs * 1.15); }
      const bg = isF ? '#FFC83D' : r === lastAlive ? '#FF4D6D' : 'rgba(11,9,32,.88)';
      g.fillStyle = 'rgba(0,0,0,.3)'; rrect(g, lx + 1, ly - bh / 2 + 2, bw, bh, 6); g.fill();
      g.fillStyle = bg; rrect(g, lx, ly - bh / 2, bw, bh, 6); g.fill();
      if (!isF && r !== lastAlive) { g.strokeStyle = hexA(r.color, 0.7); g.lineWidth = 1; rrect(g, lx + 0.5, ly - bh / 2 + 0.5, bw - 1, bh - 1, 6); g.stroke(); }
      if (!pre && !isF) { g.fillStyle = r.color; g.fillRect(lx + 3, ly - bh / 2 + 4, 3, bh - 8); }
      g.fillStyle = isF ? '#1E1B3A' : '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, lx + (pre || isF ? 7 : 9), ly + 1);
      // 따라가는 구슬에는 작은 화살표(카메라 표시)
      if (isF) { g.fillStyle = '#FFC83D'; const ax = right ? lx - 3 : lx + bw + 3, dir = right ? -1 : 1; g.beginPath(); g.moveTo(ax, ly - 4); g.lineTo(ax + dir * 5, ly); g.lineTo(ax, ly + 4); g.fill(); }
    }
    // 화면 가장자리 어둡게(비네트)
    const vg = g.createRadialGradient(viewW / 2, H / 2, Math.min(viewW, H) * 0.35, viewW / 2, H / 2, Math.max(viewW, H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
    if (this.bgFill) { g.fillStyle = vg; g.fillRect(0, 0, viewW, H); }
    g.restore();

    // 미니맵(전체 코스에서 각 구슬 위치)
    const side = padRight > 0, mx = side ? viewW + 6 : viewW - 16, mh = H - 120, my = 64;
    g.fillStyle = 'rgba(11,9,32,.75)'; rrect(g, mx - (side ? 5 : 9), my - 8, side ? 10 : 18, mh + 16, 5); g.fill();
    SECTIONS.forEach((sec, i) => { const y0 = my + (sec.y / WORLD_H) * mh, y1 = my + ((SECTIONS[i + 1]?.y ?? WORLD_H) / WORLD_H) * mh; g.fillStyle = hexA(sec.color, 0.35); g.fillRect(mx - 2, y0, 4, y1 - y0 - 1); });
    const vy0 = my + (this.cam.y / WORLD_H) * mh, vy1 = my + ((this.cam.y + vh) / WORLD_H) * mh;
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1; rrect(g, mx - 7, vy0, 14, Math.max(6, vy1 - vy0), 3); g.stroke();
    for (const r of this.racers) { if (r.gone) continue; g.fillStyle = r.color; g.beginPath(); g.arc(mx, my + (Math.min(WORLD_H, r.body.position.y) / WORLD_H) * mh, r === this.follow ? 4.5 : 2.6, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.fillRect(mx - 7, my + (FINISH_Y / WORLD_H) * mh, 14, 2);
  }
}

// ── 색 도우미 ──
function hexRgb(h: string) { const n = parseInt(h.slice(1).padEnd(6, '0').slice(0, 6), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(h: string, k: number) { const c = hexRgb(h).map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))); return `rgb(${c[0]},${c[1]},${c[2]})`; }
function mix(a: string, b: string, k: number) { const x = hexRgb(a), y = hexRgb(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`; }
function hexA(h: string, a: number) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, a))})`; }
function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); if ((g as any).roundRect) (g as any).roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); else g.rect(x, y, w, h);
}
