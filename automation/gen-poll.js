// 매일 트렌드 투표 자동 생성 (Claude) → polls 테이블 삽입. 최근 4개만 active 유지.
//   사용: node gen-poll.js ["연관 글 제목"]   (run.js에서 generatePoll(title) 호출)
import 'dotenv/config';               // automation/.env (ANTHROPIC_API_KEY 등)
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';
import { pathToFileURL } from 'node:url';

dotenv.config({ path: '../supabase/.env' }); // DB 접속 (CI에선 GH secret 로 process.env)

const MODEL = process.env.WRITE_MODEL || 'claude-sonnet-4-6';

export async function generatePoll(title = '') {
  const client = new Anthropic();
  const prompt = `너는 한국 2030 대상 머니·AI·소비 트렌드 매거진 'Crama'의 에디터야. 지금 화제인 이슈로 의견이 가볍게 갈리는 '여론 투표' 하나를 만들어줘.
${title ? `참고 주제(연관 글): "${title}"` : '오늘의 머니/AI/소비 트렌드 중 의견이 갈릴 만한 주제'}
규칙: question은 친근한 반말체 한 문장. options는 2개(서로 대립, 각 12자 이내). context는 한 줄 배경(40자 이내). emoji는 토픽에 맞는 1개.
JSON만 출력: {"question":"...","options":["...","..."],"emoji":"...","context":"..."}`;

  const resp = await client.messages.create({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
  const text = resp.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('JSON 파싱 실패: ' + text.slice(0, 120));
  const p = JSON.parse(m[0]);
  if (!p.question || !Array.isArray(p.options) || p.options.length < 2) throw new Error('투표 형식 오류');

  const pwd = process.env.SUPABASE_DB_PASSWORD;
  const ref = process.env.SUPABASE_PROJECT_REF || 'dqwzqirrzelzfngyrcmw';
  const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-2.pooler.supabase.com';
  if (!pwd) throw new Error('SUPABASE_DB_PASSWORD 없음 (CI면 GH secret 등록 필요)');

  const c = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password: pwd, database: 'postgres', ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    // 최근 4개만 활성 유지(오래된 투표 비활성)
    await c.query('update polls set active=false where active=true and id not in (select id from polls order by created_at desc limit 4)');
    const r = await c.query('insert into polls (question, options, emoji, context) values ($1,$2::jsonb,$3,$4) returning id', [p.question, JSON.stringify(p.options.slice(0, 4)), p.emoji || '🗳️', p.context || null]);
    console.log('✓ 투표 생성:', r.rows[0].id, '—', p.question);
    return r.rows[0].id;
  } finally { await c.end(); }
}

// CLI 단독 실행
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  generatePoll(process.argv.slice(2).join(' ')).catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
