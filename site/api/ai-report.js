// AI 정밀 재무 진단 — Vercel Serverless Function
// 브라우저 → (로그인 JWT) → 여기 → Supabase JWT 검증 + 일일 게이트(RPC) → Claude 구조화 출력 → 리포트 JSON
// 키는 서버 env(ANTHROPIC_API_KEY)에만 존재. 밀웜과 동일하게 '정보 제공' 원칙 — 투자·상품 권유 금지.
import Anthropic from '@anthropic-ai/sdk';

const SU = process.env.PUBLIC_SUPABASE_URL;
const AK = process.env.PUBLIC_SUPABASE_ANON_KEY;
const MODEL = 'claude-sonnet-5';

const SCHEMA = {
  type: 'object',
  properties: {
    grade: { type: 'string', enum: ['A+', 'A', 'B+', 'B', 'C+', 'C', 'D'], description: '나이·상황 감안 종합 재무 체력 등급' },
    headline: { type: 'string', description: '진단 한 줄 요약, 30자 내외' },
    summary: { type: 'string', description: '종합평 3~4문장' },
    strengths: {
      type: 'array',
      items: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' } }, required: ['title', 'detail'], additionalProperties: false },
    },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, detail: { type: 'string' }, severity: { type: 'string', enum: ['high', 'mid', 'low'] } },
        required: ['title', 'detail', 'severity'], additionalProperties: false,
      },
    },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: { title: { type: 'string' }, why: { type: 'string' }, how: { type: 'string', description: '이번 주에 할 수 있는 구체적 첫 걸음' } },
        required: ['title', 'why', 'how'], additionalProperties: false,
      },
      description: '우선순위 순 3~5개',
    },
    benefits: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string', description: '반드시 후보 목록의 id만' }, reason: { type: 'string' } },
        required: ['id', 'reason'], additionalProperties: false,
      },
      description: '후보 목록 중 지금 챙길 것 0~5개',
    },
  },
  required: ['grade', 'headline', 'summary', 'strengths', 'risks', 'actions', 'benefits'],
  additionalProperties: false,
};

const SYSTEM =
  '너는 한국 생활금융 서비스 "크라마"의 AI 재무 진단사다. 사용자의 재무 프로필을 진단해 현실적이고 구체적인 리포트를 쓴다.\n' +
  '원칙:\n' +
  '- 정보 제공 목적. 특정 금융상품·투자 권유, 종목 추천, 보험 가입 권유 금지.\n' +
  '- 제공된 숫자를 근거로 인용(예: "소득 대비 부채 배율 1.8배"). 제공 안 된 값은 추정하지 말고 언급하지 않기.\n' +
  '- 입력이 적으면 적은 대로 진단하되, 리스크 섹션에서 "이 정보가 있으면 더 정확해진다"는 식으로 안내 가능.\n' +
  '- 톤: 잔소리가 아닌 유능한 코치. 명확하고 실행 가능하게. 짧은 문장. 존댓말.\n' +
  '- 등급은 같은 나이대 평균 대비 상대 평가. 20대 초반의 자산 부족은 D 사유가 아님.\n' +
  '- benefits는 반드시 후보 목록에 있는 id만 사용. 후보에 맞는 게 없으면 빈 배열.';

async function verifyUser(token) {
  const r = await fetch(`${SU}/auth/v1/user`, { headers: { apikey: AK, Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const u = await r.json();
  return u && u.id ? u : null;
}

async function gate(token) {
  const r = await fetch(`${SU}/rest/v1/rpc/use_ai_report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: AK, Authorization: `Bearer ${token}` },
    body: '{}',
  });
  if (!r.ok) return { ok: false, error: 'gate' };
  return r.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'auth' });
    const user = await verifyUser(token);
    if (!user) return res.status(401).json({ error: 'auth' });

    const g = await gate(token);
    if (!g.ok) return res.status(g.error === 'cap' ? 429 : 500).json({ error: g.error || 'gate', left: g.left ?? 0 });

    const { profile = {}, stats = {}, candidates = [] } = req.body || {};
    // 입력 방어: 후보는 60건·필드 제한, 문자열 길이 캡
    const cand = (Array.isArray(candidates) ? candidates : []).slice(0, 60).map((c) => ({
      id: String(c.id || '').slice(0, 60),
      name: String(c.name || '').slice(0, 80),
      summary: String(c.summary || '').slice(0, 160),
    }));

    const client = new Anthropic();
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content:
          `[재무 프로필]\n${JSON.stringify(profile)}\n\n` +
          `[계산된 지표]\n${JSON.stringify(stats)}\n\n` +
          `[챙길 수 있는 혜택 후보 목록]\n${JSON.stringify(cand)}\n\n` +
          '위 정보로 정밀 재무 진단 리포트를 작성해줘.',
      }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    });
    const text = resp.content.find((b) => b.type === 'text')?.text || '{}';
    const report = JSON.parse(text);
    return res.status(200).json({ report, left: g.left, model: MODEL });
  } catch (e) {
    console.error('ai-report error:', e?.message || e);
    return res.status(500).json({ error: 'server' });
  }
}
