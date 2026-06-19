// Vercel 서버리스 함수: 제휴/문의 폼 → Slack 웹훅 전송
// 웹훅 URL은 코드에 넣지 않고 Vercel 환경변수 SLACK_WEBHOOK_URL 에서 읽는다.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const name = String(body.name || '').slice(0, 100);
  const email = String(body.email || '').slice(0, 200);
  const type = String(body.type || '문의').slice(0, 40);
  const message = String(body.message || '').slice(0, 3000);
  const website = String(body.website || ''); // 허니팟(봇 차단)

  if (website) return res.status(200).json({ ok: true }); // 봇이면 조용히 통과
  if (!email || !message) {
    return res.status(400).json({ ok: false, error: '이메일과 문의 내용을 입력해 주세요.' });
  }

  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    return res.status(500).json({ ok: false, error: '서버 설정 오류(웹훅 미설정).' });
  }

  try {
    const slackRes = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text:
          `:envelope: *Crama ${type}*\n` +
          `*이름/회사:* ${name || '-'}\n` +
          `*이메일:* ${email}\n` +
          `*내용:*\n${message}`,
      }),
    });
    if (!slackRes.ok) throw new Error('slack ' + slackRes.status);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(502).json({ ok: false, error: '전송 실패. 잠시 후 다시 시도해 주세요.' });
  }
}
