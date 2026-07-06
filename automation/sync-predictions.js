// 오르까 내리까 — 라운드 수명주기 크론(매일 실행, 멱등)
//   ① open 라운드가 없으면 생성(락 = 다음 금요일 15:30 KST, 판정 = 락 +7일)
//   ② open 라운드가 locks_at을 지났으면: 기준가(코스피·달러·BTC) 기록 → locked
//   ③ locked 라운드가 settles_at을 지났으면: 최종가 → 판정·채점 → worm_ledger 보상 → settled
// 가격: Yahoo(^KS11, KRW=X — User-Agent 필수) + 업비트(KRW-BTC). 무승부(|변동|<0.05%)는 전원 적중 처리.
import pg from 'pg';
import { pgConn } from './lib/push.js';
import { generatePredictionCommentary } from './lib/claude.js';

const QUESTIONS = [
  { key: 'kospi', label: '코스피', emoji: '📈', unit: 'pt', src: 'yahoo:^KS11', hint: '한국 증시의 체온계' },
  { key: 'usd', label: '달러 환율', emoji: '💵', unit: '원', src: 'yahoo:KRW=X', hint: '오르면 원화가 약해진 것' },
  { key: 'btc', label: '비트코인', emoji: '🪙', unit: '원', src: 'upbit:KRW-BTC', hint: '주말에도 쉬지 않는 그 코인' },
];
// ⭐ 이주의 종목 — 주차 번호로 로테이션(매주 다른 4번째 문항)
const SPECIALS = [
  { key: 'samsung', label: '삼성전자', emoji: '📱', unit: '원', src: 'yahoo:005930.KS', hint: '국민주의 자존심' },
  { key: 'nvidia', label: '엔비디아', emoji: '🤖', unit: '$', src: 'yahoo:NVDA', hint: 'AI 시대의 곡괭이 장수' },
  { key: 'gold', label: '금값', emoji: '🥇', unit: '$', src: 'yahoo:GC=F', hint: '불안할수록 빛나는 안전자산' },
  { key: 'tesla', label: '테슬라', emoji: '🚗', unit: '$', src: 'yahoo:TSLA', hint: '일론의 롤러코스터' },
  { key: 'kakao', label: '카카오', emoji: '💬', unit: '원', src: 'yahoo:035720.KS', hint: '국민 메신저의 주가는?' },
  { key: 'eth', label: '이더리움', emoji: '💎', unit: '원', src: 'upbit:KRW-ETH', hint: '비트코인의 영원한 2인자' },
  { key: 'skhynix', label: 'SK하이닉스', emoji: '💾', unit: '원', src: 'yahoo:000660.KS', hint: 'HBM 반도체의 주인공' },
  { key: 'apple', label: '애플', emoji: '🍎', unit: '$', src: 'yahoo:AAPL', hint: '세계에서 제일 비싼 과일' },
];
const HIT = 3, DOUBLE_HIT = 8, PERFECT = 6, UNDERDOG = 3, UNDERDOG_MAX_SHARE = 0.4, PUSH_PCT = 0.05;

async function fetchPrice(src) {
  const [kind, sym] = src.split(':');
  for (let t = 1; t <= 3; t++) {
    try {
      if (kind === 'upbit') {
        const r = await fetch(`https://api.upbit.com/v1/ticker?markets=${sym}`);
        const j = await r.json();
        const p = j?.[0]?.trade_price;
        if (p) return p;
      } else {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=5d&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (crama.app price bot)' },
        });
        const j = await r.json();
        const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (p) return p;
      }
    } catch (e) { console.warn(`⚠ ${src} try${t}:`, e.message); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return null;
}

function nextFriday1530(from = new Date()) {
  const d = new Date(from);
  d.setHours(15, 30, 0, 0);
  const day = d.getDay(); // 5 = 금
  let add = (5 - day + 7) % 7;
  if (add === 0 && from >= d) add = 7; // 오늘이 금요일인데 15:30 지남 → 다음 주
  d.setDate(d.getDate() + add);
  return d;
}
function isoWeekId(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 864e5 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

async function main() {
  const client = new pg.Client(pgConn());
  await client.connect();
  try {
    const now = new Date();

    // ③ 판정: locked && settles_at 경과
    const toSettle = await client.query(`select * from prediction_rounds where status='locked' and settles_at <= now()`);
    for (const round of toSettle.rows) {
      console.log(`판정 시작: ${round.id}`);
      const results = {};
      let ok = true;
      for (const q of round.questions) {
        const final = await fetchPrice(q.src);
        if (final == null || q.base == null) { ok = false; break; }
        const changePct = ((final - q.base) / q.base) * 100;
        const dir = Math.abs(changePct) < PUSH_PCT ? 'push' : changePct > 0 ? 'up' : 'down';
        results[q.key] = { base: q.base, final, changePct: Math.round(changePct * 100) / 100, dir };
      }
      if (!ok) { console.warn(`⚠ ${round.id} 가격 수집 실패 — 다음 실행에서 재시도`); continue; }

      // 분포(역배 판정용)
      const stats = await client.query(
        `select key, dir, count(*)::int as cnt from (
           select key, value #>> '{}' as dir from prediction_picks, jsonb_each(picks) where round_id=$1
         ) s group by key, dir`, [round.id]);
      const dist = {};
      for (const r of stats.rows) { (dist[r.key] ??= {})[r.dir] = r.cnt; }
      const share = (key, dir) => {
        const d = dist[key] || {};
        const tot = (d.up || 0) + (d.down || 0);
        return tot ? (d[dir] || 0) / tot : 1;
      };

      const picks = await client.query(`select * from prediction_picks where round_id=$1 and score is null`, [round.id]);
      let paidTotal = 0;
      for (const p of picks.rows) {
        const hits = [], underdog = [];
        let reward = 0;
        for (const q of round.questions) {
          const res = results[q.key];
          const my = p.picks[q.key];
          const hit = res.dir === 'push' || res.dir === my;
          if (!hit) continue;
          hits.push(q.key);
          reward += p.double_key === q.key ? DOUBLE_HIT : HIT;
          if (res.dir !== 'push' && share(q.key, my) < UNDERDOG_MAX_SHARE) { underdog.push(q.key); reward += UNDERDOG; }
        }
        const perfect = hits.length === round.questions.length;
        if (perfect) reward += PERFECT;
        const score = { hits, reward, perfect, underdog, double: p.double_key || null };
        await client.query(`update prediction_picks set score=$1 where round_id=$2 and user_id=$3`, [score, round.id, p.user_id]);
        if (reward > 0) {
          await client.query(
            `insert into worm_ledger (user_id, amount, reason, ref) values ($1,$2,'predict',$3)`,
            [p.user_id, reward, round.id]);
          paidTotal += reward;
        }
      }
      // AI 촌평(크라미의 한 마디) — 실패해도 판정은 진행
      let commentary = null;
      try {
        const perfectCount = (await client.query(
          `select count(*)::int as n from prediction_picks where round_id=$1 and (score->>'perfect')::boolean`, [round.id])).rows[0].n;
        commentary = await generatePredictionCommentary({
          week: '#' + (round.id.split('-W')[1] || '') + '주차',
          items: round.questions.map((q) => ({
            label: q.label,
            changePct: results[q.key].changePct,
            dir: results[q.key].dir,
            crowdUpPct: Math.round(share(q.key, 'up') * 100),
          })),
          participants: picks.rows.length,
          perfectCount,
        });
        console.log(`  촌평: ${commentary}`);
      } catch (e) { console.warn(`  ⚠ 촌평 생성 실패(스킵): ${e.message}`); }

      await client.query(`update prediction_rounds set results=$1, commentary=$2, status='settled' where id=$3`, [results, commentary, round.id]);
      console.log(`✓ ${round.id} 판정 완료 — 참여 ${picks.rows.length}명, 밀웜 ${paidTotal} 지급`);
    }

    // ② 락: open && locks_at 경과 → 기준가 기록
    const toLock = await client.query(`select * from prediction_rounds where status='open' and locks_at <= now()`);
    for (const round of toLock.rows) {
      const qs = [];
      let ok = true;
      for (const q of round.questions) {
        const base = await fetchPrice(q.src);
        if (base == null) { ok = false; break; }
        qs.push({ ...q, base });
      }
      if (!ok) { console.warn(`⚠ ${round.id} 기준가 수집 실패 — 다음 실행에서 재시도`); continue; }
      await client.query(`update prediction_rounds set questions=$1, status='locked' where id=$2`, [JSON.stringify(qs), round.id]);
      console.log(`✓ ${round.id} 락 — 기준가 기록`);
    }

    // ① 생성: open 라운드 없으면 다음 라운드 (고정 3문항 + ⭐이주의 종목 로테이션)
    const open = await client.query(`select id from prediction_rounds where status='open'`);
    if (open.rows.length === 0) {
      const locks = nextFriday1530(now);
      const settles = new Date(locks.getTime() + 7 * 864e5);
      const id = isoWeekId(locks);
      const weekNum = parseInt(id.split('-W')[1], 10) || 0;
      const special = { ...SPECIALS[weekNum % SPECIALS.length], special: true };
      await client.query(
        `insert into prediction_rounds (id, opens_at, locks_at, settles_at, questions, status)
         values ($1, now(), $2, $3, $4, 'open') on conflict (id) do nothing`,
        [id, locks, settles, JSON.stringify([...QUESTIONS, special])]);
      console.log(`✓ 라운드 생성: ${id} (락 ${locks.toLocaleString('ko-KR')}, ⭐${special.label})`);
    }
  } finally {
    await client.end();
  }
}
main().catch((e) => { console.error('ERR', e); process.exit(1); });
