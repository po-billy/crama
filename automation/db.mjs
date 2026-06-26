// DB 직접 실행 헬퍼 — supabase/.env 사용.
//   추천: SUPABASE_DB_URL 에 대시보드의 'Session pooler' 연결문자열(실제 비번 포함)을 큰따옴표로.
//   대안: SUPABASE_DB_PASSWORD 만 채우면 풀러 리전 추정(SUPABASE_REGION 로 지정 가능).
//   사용법: node db.mjs "<SQL>" | --file path.sql | --check
import dotenv from 'dotenv';
import fs from 'node:fs';
import pg from 'pg';
dotenv.config({ path: '../supabase/.env' });

const ref = process.env.SUPABASE_PROJECT_REF;
const rawUrl = (process.env.SUPABASE_DB_URL || '').trim();
const explicitPwd = process.env.SUPABASE_DB_PASSWORD || '';

// postgres URI 견고 파싱: 비밀번호에 @,#,: 등 특수문자가 있어도 OK
// (user는 첫 ':' 까지, host는 '마지막 @' 뒤 → 그 사이 전부 비밀번호)
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

// 어느 칸에 뭘 넣어도 처리: 완성된 URI(placeholder 아님) > 평문 비번
const cands = [rawUrl, explicitPwd.trim()].filter(Boolean);
const uri = cands.find((v) => /^postgres(?:ql)?:\/\//i.test(v) && !v.includes('['));
const plain = cands.find((v) => v && !/^postgres/i.test(v) && !v.includes('pooler.supabase.com'));
let conn;
if (uri) {
  conn = { ...parsePg(uri), ssl: { rejectUnauthorized: false } };
} else if (plain) {
  const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-2.pooler.supabase.com';
  conn = { host, port: 5432, user: `postgres.${ref}`, password: plain, database: 'postgres', ssl: { rejectUnauthorized: false } };
} else {
  console.error('⚠ SUPABASE_DB_PASSWORD 에 "짧은 비밀번호만" 넣어주세요 (URL 전체 X). 또는 SUPABASE_DB_URL 에 완성된 세션 풀러 문자열.');
  process.exit(1);
}

const a = process.argv.slice(2);
let sql;
if (a[0] === '--check') sql = 'select now() as time, current_database() as db, current_user as user;';
else if (a[0] === '--file') sql = fs.readFileSync(a[1], 'utf8');
else sql = a.join(' ');
if (!sql) { console.error('SQL이 비어있어요.'); process.exit(1); }

const client = new pg.Client(conn);
await client.connect();
try {
  const res = await client.query(sql);
  const rows = Array.isArray(res) ? res.flatMap((r) => r.rows ?? []) : res.rows;
  console.log(JSON.stringify(rows ?? [], null, 2));
  console.log(`✓ OK (${Array.isArray(res) ? 'multi' : (res.rowCount ?? 0) + ' rows'})`);
} finally { await client.end(); }
