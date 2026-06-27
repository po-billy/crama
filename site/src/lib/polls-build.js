// 빌드 시점에 활성 투표를 공개 REST(anon)로 가져옴 — /vote 리스트·상세 정적 생성용.
const URL = import.meta.env.PUBLIC_SUPABASE_URL;
const ANON = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export async function fetchActivePolls() {
  if (!URL || !ANON) return [];
  try {
    const res = await fetch(
      `${URL}/rest/v1/polls?active=eq.true&order=created_at.desc&select=id,question,options,emoji,teaser,context,body,image`,
      { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } },
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}
