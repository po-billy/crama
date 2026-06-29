// 웹앱 클라이언트 API — 회원/밀웜/옷장 (브라우저 전용).
// RN 앱과 동일한 Supabase RPC 를 그대로 호출(백엔드 재사용).
import { getSupabase, isSupabaseConfigured } from './supabase';

export { isSupabaseConfigured };

export type OAuthProvider = 'google' | 'kakao';
export type EarnAction = 'read' | 'audio' | 'quiz' | 'ad' | 'attend';
export type WardrobeSlot = 'hat' | 'glasses' | 'scarf' | 'outfit' | 'floor' | 'wallpaper';

export type WardrobeItem = {
  id: string;
  name: string;
  slot: WardrobeSlot;
  price_worms: number;
  rarity: string;
  asset_url: string | null;
  sort: number;
};

// ---------- 인증 ----------
export async function getUser() {
  if (!isSupabaseConfigured) return null;
  const { data } = await getSupabase().auth.getUser();
  return data.user ?? null;
}

export function onAuth(cb: () => void) {
  return getSupabase().auth.onAuthStateChange(() => cb());
}

export async function signInEmail(email: string, password: string) {
  const { error } = await getSupabase().auth.signInWithPassword({ email, password });
  return { error: error?.message };
}

export async function signUpEmail(email: string, password: string) {
  const { data, error } = await getSupabase().auth.signUp({
    email,
    password,
    // 인증 메일의 confirm 링크가 '가입한 그 주소'로 돌아오도록(포트 어긋남 방지)
    options: { emailRedirectTo: `${location.origin}/me/` },
  });
  if (error) return { error: error.message };
  return { needsConfirm: !data.session };
}

export async function signInOAuth(provider: OAuthProvider) {
  const redirectTo = `${location.origin}/me/`;
  const options: { redirectTo: string; scopes?: string } = { redirectTo };
  // 카카오: 닉네임만 요청(이메일은 비즈앱 필요해서 제외) → KOE205 방지
  if (provider === 'kakao') options.scopes = 'profile_nickname';
  const { error } = await getSupabase().auth.signInWithOAuth({ provider, options });
  return { error: error?.message };
}

export async function signOut() {
  await getSupabase().auth.signOut();
}

function randomNick() { return '크라미' + Math.floor(1000 + Math.random() * 9000); }

export async function getProfile() {
  const user = await getUser();
  if (!user) return null;
  const sb = getSupabase();
  let { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (!data) {
    // 프로필이 없으면 크라미+난수로 생성(트리거 누락 대비)
    const ins = await sb.from('profiles').insert({ id: user.id, nickname: randomNick() }).select().maybeSingle();
    data = ins.data;
  }
  return data;
}

// 업적 배지: 현재 지표로 새 배지 해금 + 보유 전체 반환(is_new=이번에 해금)
export async function checkBadges(): Promise<{ badge_id: string; is_new: boolean }[]> {
  const sb = getSupabase();
  const { data } = await sb.rpc('check_badges');
  return (data as { badge_id: string; is_new: boolean }[]) ?? [];
}

export async function updateNickname(nickname: string) {
  const user = await getUser();
  if (!user) return { error: 'no_user' };
  const nn = nickname.trim().slice(0, 20);
  if (!nn) return { error: '닉네임을 입력해 주세요.' };
  const { error } = await getSupabase().from('profiles').update({ nickname: nn }).eq('id', user.id);
  return { error: error?.message, nickname: nn };
}

// ---------- 스크랩(북마크) ----------
export async function getBookmarks(): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await getSupabase().from('bookmarks').select('slug').order('created_at', { ascending: false });
  return ((data as { slug: string }[]) ?? []).map((r) => r.slug);
}
export async function toggleBookmark(slug: string): Promise<{ bookmarked: boolean }> {
  const user = await getUser();
  if (!user) { location.href = '/login/'; return { bookmarked: false }; }
  const sb = getSupabase();
  const { data } = await sb.from('bookmarks').select('slug').eq('slug', slug).maybeSingle();
  if (data) { await sb.from('bookmarks').delete().eq('user_id', user.id).eq('slug', slug); return { bookmarked: false }; }
  await sb.from('bookmarks').insert({ user_id: user.id, slug });
  return { bookmarked: true };
}

// ---------- 연속출석 마일스톤 ----------
export async function claimStreakMilestone(): Promise<{ bonus: number; reached: number; balance: number }> {
  if (!isSupabaseConfigured) return { bonus: 0, reached: 0, balance: 0 };
  const { data } = await getSupabase().rpc('claim_streak_milestone');
  const r = Array.isArray(data) ? data[0] : data;
  return { bonus: r?.bonus ?? 0, reached: r?.reached ?? 0, balance: r?.balance ?? 0 };
}

// ---------- 친구 초대(레퍼럴) ----------
export async function claimReferral(code: string): Promise<{ ok: boolean; message: string; balance: number }> {
  const { data, error } = await getSupabase().rpc('claim_referral', { p_code: code });
  if (error) return { ok: false, message: error.message, balance: 0 };
  const r = Array.isArray(data) ? data[0] : data;
  return { ok: !!r?.ok, message: r?.message ?? 'error', balance: r?.balance ?? 0 };
}

// ---------- 투표·여론 ----------
export type Poll = { id: number; question: string; options: string[]; emoji?: string; context?: string; source_slug?: string; image?: string };
export type Opinion = { nickname: string; choice: number | null; text: string; created_at: string };

export async function getActivePolls(): Promise<Poll[]> {
  if (!isSupabaseConfigured) return [];
  const { data } = await getSupabase().from('polls').select('id,question,options,emoji,context,source_slug,image').eq('active', true).order('created_at', { ascending: false });
  return (data as Poll[]) ?? [];
}
export async function getMyVotes(pollIds: number[]): Promise<Record<number, number>> {
  if (!pollIds.length) return {};
  const { data } = await getSupabase().from('poll_votes').select('poll_id,choice').in('poll_id', pollIds);
  const m: Record<number, number> = {};
  ((data as { poll_id: number; choice: number }[]) ?? []).forEach((r) => { m[r.poll_id] = r.choice; });
  return m;
}
export async function getPollResults(id: number): Promise<Record<string, number>> {
  const { data } = await getSupabase().rpc('poll_results', { p_poll_id: id });
  return (data as Record<string, number>) ?? { total: 0 };
}
export async function votePoll(id: number, choice: number) {
  if (!(await getUser())) { location.href = '/login/'; return { ok: false, message: 'login' as string, counts: {} as Record<string, number>, balance: 0, myChoice: null as number | null }; }
  const { data, error } = await getSupabase().rpc('vote_poll', { p_poll_id: id, p_choice: choice });
  if (error) return { ok: false, message: error.message, counts: {}, balance: 0, myChoice: null };
  const r = Array.isArray(data) ? data[0] : data;
  return { ok: !!r?.ok, message: r?.message ?? 'error', counts: (r?.counts ?? {}) as Record<string, number>, balance: r?.balance ?? 0, myChoice: r?.my_choice ?? null };
}
export async function getOpinions(id: number): Promise<Opinion[]> {
  const { data } = await getSupabase().from('poll_opinions').select('nickname,choice,text,created_at').eq('poll_id', id).order('created_at', { ascending: false }).limit(60);
  return (data as Opinion[]) ?? [];
}
export async function addOpinion(id: number, text: string) {
  const { data, error } = await getSupabase().rpc('add_opinion', { p_poll_id: id, p_text: text });
  if (error) return { ok: false, message: error.message };
  const r = Array.isArray(data) ? data[0] : data;
  return { ok: !!r?.ok, message: r?.message ?? 'error' };
}

/** slot -> item_id (장착 상태만, 가벼운 조회) */
export async function equippedMap(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  const { data } = await getSupabase().from('user_equipped').select('slot, item_id');
  const m: Record<string, string> = {};
  ((data as { slot: string; item_id: string | null }[]) ?? []).forEach((r) => { if (r.item_id) m[r.slot] = r.item_id; });
  return m;
}

// ---------- 밀웜 ----------
export async function wormBalance(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { data } = await getSupabase().rpc('worm_balance');
  return typeof data === 'number' ? data : 0;
}

export async function earnWorms(action: EarnAction, ref = '') {
  const { data, error } = await getSupabase().rpc('earn_worms', { p_action: action, p_ref: ref });
  if (error) return { ok: false, message: error.message, balance: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.ok, message: row?.message ?? 'error', balance: row?.balance ?? 0 };
}

/** 오늘 액션별 적립 횟수 (캡 표시용: 출석/퀴즈 완료, 광고 잔여) */
export async function earnCountsToday(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) return {};
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await getSupabase().from('earn_events').select('action, count').eq('day', today);
  const m: Record<string, number> = {};
  ((data as { action: string; count: number }[]) ?? []).forEach((r) => {
    m[r.action] = (m[r.action] ?? 0) + r.count;
  });
  return m;
}

/** day('YYYY-M-D') -> worms_earned, + streak */
export async function stamps(): Promise<{ map: Record<string, number>; streak: number }> {
  if (!isSupabaseConfigured) return { map: {}, streak: 0 };
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const { data } = await getSupabase()
    .from('daily_stamps')
    .select('day, worms_earned')
    .gte('day', since.toISOString().slice(0, 10))
    .order('day', { ascending: false });

  const map: Record<string, number> = {};
  const set = new Set<string>();
  (data ?? []).forEach((r: { day: string; worms_earned: number }) => {
    const d = new Date(r.day + 'T00:00:00');
    map[`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`] = r.worms_earned;
    set.add(r.day);
  });

  let streak = 0;
  const cur = new Date();
  if (!set.has(cur.toISOString().slice(0, 10))) cur.setDate(cur.getDate() - 1);
  while (set.has(cur.toISOString().slice(0, 10))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return { map, streak };
}

// ---------- 옷장 ----------
export async function wardrobeData() {
  if (!isSupabaseConfigured) return { catalog: [] as WardrobeItem[], owned: new Set<string>(), equipped: {} as Record<string, string> };
  const sb = getSupabase();
  const [items, inv, eq] = await Promise.all([
    sb.from('wardrobe_items').select('*').order('slot').order('sort'),
    sb.from('user_inventory').select('item_id'),
    sb.from('user_equipped').select('slot, item_id'),
  ]);
  const equipped: Record<string, string> = {};
  ((eq.data as { slot: string; item_id: string | null }[]) ?? []).forEach((r) => {
    if (r.item_id) equipped[r.slot] = r.item_id;
  });
  return {
    catalog: (items.data as WardrobeItem[]) ?? [],
    owned: new Set(((inv.data as { item_id: string }[]) ?? []).map((r) => r.item_id)),
    equipped,
  };
}

export async function buyItem(id: string) {
  const { data, error } = await getSupabase().rpc('buy_item', { p_item_id: id });
  if (error) return { ok: false, message: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { ok: !!row?.ok, message: row?.message ?? 'error' };
}

export async function equipItem(id: string, slot: WardrobeSlot, currentlyOn: boolean) {
  const sb = getSupabase();
  const { error } = currentlyOn
    ? await sb.rpc('unequip_slot', { p_slot: slot })
    : await sb.rpc('equip_item', { p_item_id: id });
  return { ok: !error };
}
