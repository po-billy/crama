// 저장 항목 마감 D-day 알림 — saved_items(deadline)와 user 연결된 push_subscriptions로 개인 푸시 발송.
//   대상: KST 기준 마감 D-1, D-3 항목. 사용: node send-deadline-alerts.js (sync-calendar.yml 일일 크론)
//   DB/VAPID 자격은 lib/push.js와 동일(없으면 조용히 스킵).
import 'dotenv/config';
import pg from 'pg';
import webpush from 'web-push';
import { pgConn } from './lib/push.js';

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) { console.log('VAPID 없음 — 스킵'); process.exit(0); }
const conn = pgConn();
if (!conn) { console.log('DB 자격 없음 — 스킵'); process.exit(0); }

webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:gmlthd94@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
const client = new pg.Client(conn);
await client.connect();
let sent = 0, dead = 0, targets = 0;
try {
  // KST 오늘 기준 D-1·D-3 마감 항목 × user 연결 구독
  const { rows } = await client.query(`
    with kst as (select (now() at time zone 'Asia/Seoul')::date as today)
    select p.endpoint, p.p256dh, p.auth, s.name, s.deadline,
           (s.deadline - (select today from kst)) as dday
    from public.saved_items s
    join public.push_subscriptions p on p.user_id = s.user_id
    where s.deadline is not null
      and s.deadline - (select today from kst) in (1, 3)
    order by p.endpoint, s.deadline
  `);
  // 구독(기기)별로 묶어 1건의 요약 푸시
  const byEp = new Map();
  for (const r of rows) {
    if (!byEp.has(r.endpoint)) byEp.set(r.endpoint, { keys: { p256dh: r.p256dh, auth: r.auth }, items: [] });
    byEp.get(r.endpoint).items.push(r);
  }
  targets = byEp.size;
  for (const [endpoint, g] of byEp) {
    const first = g.items[0];
    const minD = Math.min(...g.items.map((x) => Number(x.dday)));
    const title = `⏰ D-${minD} 마감 임박: ${first.name.slice(0, 28)}${g.items.length > 1 ? ` 외 ${g.items.length - 1}건` : ''}`;
    const payload = JSON.stringify({
      title,
      body: '저장해두신 혜택·정책 마감이 다가와요. 놓치기 전에 신청하세요.',
      url: 'https://crama.app/saved-picks/?utm_source=push&utm_medium=web_push&utm_campaign=deadline',
      tag: 'crama-deadline',
    });
    try {
      await webpush.sendNotification({ endpoint, keys: g.keys }, payload);
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        await client.query('delete from public.push_subscriptions where endpoint = $1', [endpoint]);
        dead++;
      }
    }
  }
  try { await client.query('insert into public.push_sends (slug, title, sent, dead) values ($1,$2,$3,$4)', ['deadline-alert', 'D-day 마감 알림', sent, dead]); } catch (e) {}
} finally {
  await client.end();
}
console.log(`마감 알림: 대상 ${targets}기기 → 발송 ${sent} · 만료정리 ${dead}`);
