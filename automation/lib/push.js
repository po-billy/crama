// 발행 시 Web Push 발송 — push_subscriptions 구독자에게 새 글 브리핑 알림.
//   DB는 db.mjs 와 동일 자격(supabase/.env: SUPABASE_DB_URL 또는 SUPABASE_DB_PASSWORD) 사용.
//   VAPID 키는 automation/.env(VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT) 또는 CI 환경변수.
//   필수 env 없으면 조용히 스킵(글 발행엔 영향 없음).
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import webpush from 'web-push';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../supabase/.env') }); // DB 자격 (CI는 env로 주입되어도 OK)

function parsePg(uri) {
  const m = uri.match(/^postgres(?:ql)?:\/\/(.+)$/i);
  if (!m) return null;
  const rest = m[1];
  const at = rest.lastIndexOf('@');
  const userinfo = rest.slice(0, at);
  const hostpart = rest.slice(at + 1).replace(/\?.*$/, '');
  const ci = userinfo.indexOf(':');
  const user = ci >= 0 ? userinfo.slice(0, ci) : userinfo;
  const password = ci >= 0 ? userinfo.slice(ci + 1) : '';
  const slash = hostpart.indexOf('/');
  const hostport = slash >= 0 ? hostpart.slice(0, slash) : hostpart;
  const database = slash >= 0 ? hostpart.slice(slash + 1) : 'postgres';
  const colon = hostport.lastIndexOf(':');
  const host = colon >= 0 ? hostport.slice(0, colon) : hostport;
  const port = colon >= 0 ? parseInt(hostport.slice(colon + 1), 10) : 5432;
  return { host, port, user, password, database };
}

function pgConn() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const rawUrl = (process.env.SUPABASE_DB_URL || '').trim();
  const explicitPwd = (process.env.SUPABASE_DB_PASSWORD || '').trim();
  if (/^postgres(?:ql)?:\/\//i.test(rawUrl) && !rawUrl.includes('[')) {
    return { ...parsePg(rawUrl), ssl: { rejectUnauthorized: false } };
  }
  if (explicitPwd && !explicitPwd.includes('pooler.supabase.com') && ref) {
    const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-2.pooler.supabase.com';
    return { host, port: 5432, user: `postgres.${ref}`, password: explicitPwd, database: 'postgres', ssl: { rejectUnauthorized: false } };
  }
  return null;
}

export async function sendBrief({ title, url }) {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { ok: false, reason: 'no-vapid' };
  const conn = pgConn();
  if (!conn) return { ok: false, reason: 'no-db' };

  webpush.setVapidDetails(VAPID_SUBJECT || 'mailto:gmlthd94@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  const client = new pg.Client(conn);
  await client.connect();
  let sent = 0, dead = 0;
  try {
    const { rows } = await client.query('select endpoint, p256dh, auth from public.push_subscriptions');
    const payload = JSON.stringify({ title: '오늘의 브리핑', body: title, url, tag: 'crama-brief' });
    for (const s of rows) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        if (e.statusCode === 404 || e.statusCode === 410) {
          await client.query('delete from public.push_subscriptions where endpoint = $1', [s.endpoint]);
          dead++;
        }
      }
    }
  } finally {
    await client.end();
  }
  return { ok: true, sent, dead, total: sent + dead };
}
