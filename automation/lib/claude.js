import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

const RESEARCH_MODEL = process.env.RESEARCH_MODEL || 'claude-opus-4-8';
const WRITE_MODEL = process.env.WRITE_MODEL || 'claude-sonnet-4-6';

/**
 * 1) 리서치 — web_search 로 상위 콘텐츠 트렌드·검색의도·커버리지 갭 분석.
 *    원문 복제 금지, 구조/각도/키워드만 추출.
 */
export async function research({ topic, keywords }) {
  const system =
    '너는 한국어 콘텐츠 전략가다. 주어진 주제를 웹에서 조사해, 상위 노출 글들이 공통으로 다루는 소주제, ' +
    '검색자의 의도, 아직 충분히 다뤄지지 않은 차별화 포인트(커버리지 갭)를 정리한다. ' +
    '절대 특정 글의 문장이나 표현을 복제하지 말고, 사실·구조·각도만 요약한다. 한국어로 답한다.';

  let messages = [
    {
      role: 'user',
      content:
        `주제: ${topic}\n관련 키워드: ${(keywords || []).join(', ')}\n\n` +
        '이 주제로 신규 원본 글을 쓰기 위한 리서치 브리프를 작성해줘. 다음을 포함:\n' +
        '- 핵심 검색 의도 1~2줄\n- 반드시 다뤄야 할 H2 소주제 5~7개\n' +
        '- 흔한 오해나 초보가 헷갈리는 지점\n- 경쟁 글이 잘 안 다루는 차별화 포인트\n' +
        '- 자연스럽게 녹일 키워드 목록',
    },
  ];

  let resp;
  for (let i = 0; i < 5; i++) {
    resp = await client.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 4000,
      system,
      tools: [{ type: 'web_search_20260209', name: 'web_search' }],
      messages,
    });
    // 서버측 도구가 반복 한도에 도달하면 pause_turn — 그대로 재요청해 이어가기
    if (resp.stop_reason === 'pause_turn') {
      messages = [...messages, { role: 'assistant', content: resp.content }];
      continue;
    }
    break;
  }
  return resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/**
 * 2) 작성 — 리서치 브리프 기반으로 완전 원본 SEO 글을 MDX 본문으로 생성.
 *    구조화 출력으로 title/description/tags/slug/body 반환.
 */
export async function writeArticle({ brief, cluster, categoryName, lang = 'ko' }) {
  // --- 1) 본문: 자유 텍스트(MDX)로 길게 생성 (구조화출력에 욱여넣지 않음) ---
  const system =
    `너는 "${categoryName}" 분야의 전문 에디터다. 한국어로 깊이 있고 정확한 SEO 원본 글을 쓴다. ` +
    '다른 매체의 문장을 복제하지 않으며, 실전에 바로 쓰이는 구체적 정보와 예시를 담는다.';

  const rules = [
    '분량: 한국어 2,000~3,500자 (충분히 길게).',
    '구조: 도입 문단 → ## H2 5~7개(필요시 ### H3) → 마무리. 제목(# H1)은 쓰지 말 것(frontmatter가 담당).',
    '본문 맨 앞에 <KeyTakeaways items={["...","..."]} /> 로 핵심 3~4개 요약.',
    '중요한 팁/주의는 <Callout type="tip">내용</Callout> (type: tip|warn|info).',
    '단계형 가이드가 어울리면 <Checklist id="고유영문id" title="..." items={["...","..."]} /> 삽입.',
    '마지막에 <FAQ items={[{ q: "질문", a: "답변" }]} /> 로 4개 내외 FAQ.',
    'import 문은 쓰지 말 것(발행 시 자동 삽입).',
    'JSX 속성값의 따옴표/중괄호가 깨지지 않게 유효한 MDX로 작성. 큰따옴표 안의 큰따옴표 금지.',
    '과장·허위 금지. 투자 주제면 정보 제공 목적임을 자연스럽게 전제.',
    '출력은 MDX 본문만. 코드펜스(```)나 설명 문구 없이 바로 본문부터.',
  ].join('\n- ');

  const bodyResp = await client.messages.create({
    model: WRITE_MODEL,
    max_tokens: 8000,
    system,
    messages: [
      {
        role: 'user',
        content:
          `세부 주제(클러스터): ${cluster}\n\n[리서치 브리프]\n${brief}\n\n` +
          `위 브리프를 바탕으로 완전 원본 글을 작성해줘.\n규칙:\n- ${rules}`,
      },
    ],
  });
  let body = bodyResp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  // 혹시 모를 코드펜스/선두 H1 제거
  body = body.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  body = body.replace(/^#\s+.+\n+/, '');

  // --- 2) 메타데이터: 본문 기반 작은 구조화 출력 ---
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      slug: { type: 'string', description: 'SEO용 영문 kebab-case 슬러그' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title', 'description', 'slug', 'tags'],
    additionalProperties: false,
  };
  const metaResp = await client.messages.create({
    model: WRITE_MODEL,
    max_tokens: 800,
    system: '너는 SEO 메타데이터 생성기다. 한국어 제목(검색 친화적, 30자 내외)과 설명(120자 내외), 영문 kebab-case 슬러그, 태그 4~6개를 만든다.',
    messages: [
      {
        role: 'user',
        content: `다음 글의 메타데이터를 만들어줘. 제목은 본문 주제를 정확히 반영.\n\n${body.slice(0, 3000)}`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const meta = JSON.parse(metaResp.content.find((b) => b.type === 'text')?.text || '{}');

  return { ...meta, body };
}

/** 이미지 생성용 영문 프롬프트 — 글 주제에 맞는 실사 사진(유튜브 썸네일 배경용) */
export async function imagePrompt({ title, categoryName }) {
  const resp = await client.messages.create({
    model: WRITE_MODEL,
    max_tokens: 300,
    system:
      'You write concise English prompts for a PHOTOREALISTIC editorial photograph used as a thumbnail background. ' +
      'Style: cinematic photorealism, natural lighting, shallow depth of field, cool modern color grade with deep navy/blue tones. ' +
      'Keep the lower half relatively dark and uncluttered so bold headline text can be overlaid. ' +
      'Strictly: a real-looking photo (not illustration, not 3D render, not cartoon), no text, no logos, no charts, no infographics, and AVOID orange/warm/terracotta tones.',
    messages: [
      {
        role: 'user',
        content: `Article (${categoryName}): "${title}". Describe ONE realistic photographic scene that fits the topic (a concrete subject/setting, e.g. a person, hands, an object, an interior). Max 45 words. Output only the prompt.`,
      },
    ],
  });
  return resp.content.find((b) => b.type === 'text')?.text.trim();
}
