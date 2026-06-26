// 브라우저용 Supabase 클라이언트 (웹앱: 회원/밀웜/옷장)
// PUBLIC_ 환경변수는 클라이언트 번들에 포함됨(anon 키는 공개용).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anon);

let _client: SupabaseClient | null = null;

/** 싱글톤 클라이언트 (브라우저 전용 호출) */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(url ?? 'http://localhost', anon ?? 'anon', {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}
