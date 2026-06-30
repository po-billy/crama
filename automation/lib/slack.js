// Slack 웹훅 알림 — 자동 발행/뉴스레터/푸시/색인 결과를 Slack으로 전송.
// SLACK_WEBHOOK_URL 환경변수 필요(Vercel과 동일 URL 사용).

export async function notify(text) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (res.ok) return;
    } catch {
      if (i === 0) await new Promise(r => setTimeout(r, 2000));
    }
  }
}
