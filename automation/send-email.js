// 배포 후 이메일 뉴스레터 발송 — last-brief.json 읽어 Resend API로 구독자에게 전송.
//   사용: node send-email.js   (publish.yml 배포 후 단계에서 실행)
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ── DB 연결 (push.js와 동일 패턴) ── */
function pgConn() {
  const ref = process.env.SUPABASE_PROJECT_REF;
  const rawUrl = (process.env.SUPABASE_DB_URL || '').trim();
  const pwd = (process.env.SUPABASE_DB_PASSWORD || '').trim();
  if (/^postgres(?:ql)?:\/\//i.test(rawUrl) && !rawUrl.includes('[')) {
    const m = rawUrl.match(/^postgres(?:ql)?:\/\/(.+)$/i);
    const rest = m[1]; const at = rest.lastIndexOf('@');
    const ui = rest.slice(0, at); const hp = rest.slice(at + 1).replace(/\?.*$/, '');
    const ci = ui.indexOf(':'); const user = ci >= 0 ? ui.slice(0, ci) : ui;
    const password = ci >= 0 ? ui.slice(ci + 1) : '';
    const slash = hp.indexOf('/'); const hostport = slash >= 0 ? hp.slice(0, slash) : hp;
    const database = slash >= 0 ? hp.slice(slash + 1) : 'postgres';
    const colon = hostport.lastIndexOf(':');
    const host = colon >= 0 ? hostport.slice(0, colon) : hostport;
    const port = colon >= 0 ? parseInt(hostport.slice(colon + 1), 10) : 5432;
    return { host, port, user, password, database, ssl: { rejectUnauthorized: false } };
  }
  if (pwd && !pwd.includes('pooler.supabase.com') && ref) {
    const host = process.env.SUPABASE_POOLER_HOST || 'aws-1-ap-northeast-2.pooler.supabase.com';
    return { host, port: 5432, user: `postgres.${ref}`, password: pwd, database: 'postgres', ssl: { rejectUnauthorized: false } };
  }
  return null;
}

/* ── HTML 이메일 템플릿 ── */
function buildHtml({ hook, title, description, image, url, slug }) {
  const unsubUrl = `https://crama.app/unsubscribe/?email={{EMAIL}}`;
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .email-bg { background: #1a1a2e !important; }
    .email-card { background: #22223b !important; }
    .email-ink { color: #e8e6e3 !important; }
    .email-muted { color: #a0a0b0 !important; }
    .email-chip { background: #2a2a3e !important; color: #c0c0d0 !important; }
    .email-divider { border-color: #333350 !important; }
    .email-cta { background: #e8e6e3 !important; color: #1a1a2e !important; }
  }
</style>
</head>
<body class="email-bg" style="margin:0;padding:0;background:#f0f0f3;font-family:-apple-system,BlinkMacSystemFont,'Pretendard','Segoe UI',Roboto,sans-serif;">
<!-- 프리헤더 (이메일 앱 미리보기 텍스트) -->
<div style="display:none;font-size:1px;color:#f0f0f3;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
  ${(description || '').slice(0, 120)}
</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f3;">
<tr><td align="center" style="padding:40px 16px;">

<!-- 로고 영역 -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td style="padding:0 0 20px;text-align:center;">
    <a href="https://crama.app" class="email-ink" style="text-decoration:none;color:#0f172a;font-size:20px;font-weight:800;letter-spacing:-.5px;">Crama</a>
    <span style="color:#94a3b8;font-size:13px;margin-left:6px;">${today}</span>
  </td></tr>
</table>

<!-- 메인 카드 -->
<table class="email-card" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(15,23,42,.06);">

  <!-- 히어로 이미지 -->
  ${image ? `<tr><td style="padding:0;">
    <a href="${url}" target="_blank" style="display:block;">
      <img src="${image}" alt="" width="520" style="display:block;width:100%;height:auto;border:0;" />
    </a>
  </td></tr>` : ''}

  <!-- 카테고리 칩 -->
  <tr><td style="padding:24px 28px 0;">
    <span class="email-chip" style="display:inline-block;padding:4px 10px;background:#f1f5f9;color:#475569;font-size:12px;font-weight:600;border-radius:20px;letter-spacing:.02em;">오늘의 브리핑</span>
  </td></tr>

  <!-- 훅 카피 -->
  <tr><td style="padding:14px 28px 0;">
    <a href="${url}" target="_blank" style="text-decoration:none;">
      <p class="email-ink" style="margin:0;font-size:21px;font-weight:800;color:#0f172a;line-height:1.45;letter-spacing:-.4px;">
        ${hook || title}
      </p>
    </a>
  </td></tr>

  <!-- 본문 요약 -->
  <tr><td style="padding:10px 28px 0;">
    <p class="email-muted" style="margin:0;font-size:14.5px;color:#64748b;line-height:1.7;">
      ${description}
    </p>
  </td></tr>

  <!-- CTA 버튼 -->
  <tr><td style="padding:22px 28px 0;">
    <a href="${url}" target="_blank" class="email-cta" style="display:inline-block;padding:11px 24px;background:#0f172a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;letter-spacing:.01em;">
      3분 읽기 →
    </a>
  </td></tr>

  <!-- 에디터 인사 -->
  <tr><td style="padding:24px 28px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" class="email-divider" style="border-top:1px solid #f1f5f9;padding-top:20px;width:100%;">
      <tr>
        <td style="vertical-align:top;padding-right:14px;width:44px;">
          <img src="https://crama.app/icon-192.png" alt="" width="44" height="44" style="border-radius:50%;display:block;" />
        </td>
        <td style="vertical-align:top;">
          <p class="email-ink" style="margin:0 0 4px;font-size:13px;font-weight:700;color:#0f172a;">엄희송 · 편집장</p>
          <p class="email-muted" style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
            오늘도 3분 투자해주셔서 고맙습니다.<br/>
            좋은 정보가 있었다면 주변에도 공유해 주세요.
          </p>
        </td>
      </tr>
    </table>
  </td></tr>

</table>

<!-- 푸터 -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td style="padding:24px 0 0;text-align:center;">
    <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.8;">
      <a href="https://crama.app" style="color:#64748b;text-decoration:none;font-weight:600;">crama.app</a>
      &nbsp;·&nbsp; 먼저 읽는 사람들<br/>
      <a href="${unsubUrl}" style="color:#b0b0b0;text-decoration:underline;">수신 거부</a>
    </p>
  </td></tr>
</table>

</td></tr>
</table>
</body>
</html>`;
}

/* ── 메인 ── */
async function main() {
  // 1) last-brief.json 읽기
  let brief;
  try {
    brief = JSON.parse(await fs.readFile(path.join(__dirname, 'last-brief.json'), 'utf8'));
  } catch {
    console.log('브리핑 정보(last-brief.json) 없음 — 이메일 스킵');
    return;
  }

  // 2) Resend API 키 확인
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('RESEND_API_KEY 없음 — 이메일 스킵');
    return;
  }

  // 3) DB에서 구독자 목록 조회
  const conn = pgConn();
  if (!conn) { console.log('DB 연결 정보 없음 — 이메일 스킵'); return; }
  const client = new pg.Client(conn);
  await client.connect();

  let subscribers;
  try {
    const { rows } = await client.query('SELECT email FROM public.email_subscriptions');
    subscribers = rows.map(r => r.email);
  } catch (e) {
    console.log('구독자 조회 실패:', e.message);
    await client.end();
    return;
  }

  if (subscribers.length === 0) {
    console.log('구독자 0명 — 이메일 스킵');
    await client.end();
    return;
  }

  console.log(`이메일 발송 대상: ${subscribers.length}명`);

  // 4) 발송
  const htmlTemplate = buildHtml(brief);
  let sent = 0, failed = 0;

  // Resend는 배치(최대 100명)를 지원하지만, 구독 해지 링크에 이메일을 넣어야 하므로 개별 발송
  for (const email of subscribers) {
    const html = htmlTemplate.replace('{{EMAIL}}', encodeURIComponent(email));
    let ok = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Crama 브리핑 <brief@crama.app>',
            to: email,
            subject: `☕ ${brief.hook || brief.title}`,
            html,
          }),
        });
        if (res.ok) { ok = true; break; }
        if (res.status >= 400 && res.status < 500) {
          const err = await res.text();
          console.log(`  실패 (${email}): ${res.status} ${err}`);
          break; // 4xx는 재시도 무의미
        }
        // 5xx → 재시도
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      } catch (e) {
        if (attempt === 2) console.log(`  에러 (${email}): ${e.message}`);
        else await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
    if (ok) sent++; else failed++;
  }

  // 5) 발송 기록 저장
  try {
    await client.query(
      'INSERT INTO public.email_sends (slug, title, sent, failed) VALUES ($1,$2,$3,$4)',
      [brief.slug || null, brief.hook || brief.title || null, sent, failed]
    );
  } catch {}

  await client.end();
  console.log(`이메일 발송 결과: 성공 ${sent} / 실패 ${failed} / 전체 ${subscribers.length}`);
}

main().catch(e => { console.error('[email] 실패:', e); process.exit(1); });
