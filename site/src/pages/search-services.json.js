import youthData from '../data/youth-policies.json';
import welfareData from '../data/welfare-services.json';
import { BENEFITS, BENEFIT_CATEGORIES } from '../data/benefits';

// 통합 검색용 서비스 인덱스 — 청년 정책 + 중앙 복지 + 혜택(정적)
// (지자체 4600건은 용량상 제외 — /welfare 지역 선택 온디맨드로 제공)
export async function GET() {
  const items = [];

  (youthData.policies || []).forEach((p) => {
    items.push({
      kind: 'youth',
      title: p.name,
      description: p.summary || '',
      tags: [p.cat, p.sub, p.keywords].filter(Boolean),
      catLabel: p.cat || '청년정책',
      url: `/youth/${p.id}/`, // 내부 상세 페이지(신청 CTA는 상세에서)
      external: false,
    });
  });

  (welfareData.services || []).forEach((s) => {
    items.push({
      kind: 'welfare',
      title: s.name,
      description: s.summary || '',
      tags: [s.theme, s.ministry].filter(Boolean),
      catLabel: s.theme || '복지',
      url: `/welfare/${s.id}/`, // 내부 상세 페이지(신청은 상세에서 복지로로)
      external: false,
    });
  });

  BENEFITS.forEach((b) => {
    const ci = BENEFIT_CATEGORIES[b.category];
    items.push({
      kind: 'benefit',
      title: b.name,
      description: b.summary || '',
      tags: [ci && ci.name, ...(b.tags || [])].filter(Boolean),
      catLabel: (ci && ci.name) || '혜택',
      url: b.applyUrl || '/benefits/',
      external: !!(b.applyUrl && /^https?:\/\//.test(b.applyUrl)),
    });
  });

  return new Response(JSON.stringify(items), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}
