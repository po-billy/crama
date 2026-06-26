// Supabase Auth 소셜 프로바이더 설정 (Management API)
//   supabase/.env 의 GOOGLE_*/KAKAO_* 키가 채워진 것만 활성화. SUPABASE_ACCESS_TOKEN 필요.
//   사용법: node oauth-config.mjs
import dotenv from 'dotenv';
dotenv.config({ path: '../supabase/.env' });

const ref = process.env.SUPABASE_PROJECT_REF;
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) { console.error('⚠ SUPABASE_ACCESS_TOKEN 이 비어있어요 (supabase.com/dashboard/account/tokens 에서 생성).'); process.exit(1); }

const body = {
  site_url: 'https://crama.app',
  uri_allow_list: 'https://crama.app/**,http://localhost:4321/**,http://localhost:4322/**',
};

if (process.env.GOOGLE_CLIENT_ID) {
  body.external_google_enabled = true;
  body.external_google_client_id = process.env.GOOGLE_CLIENT_ID;
  body.external_google_secret = process.env.GOOGLE_CLIENT_SECRET;
}
if (process.env.KAKAO_REST_API_KEY) {
  body.external_kakao_enabled = true;
  body.external_kakao_client_id = process.env.KAKAO_REST_API_KEY;
  body.external_kakao_secret = process.env.KAKAO_CLIENT_SECRET;
}

console.log('설정 대상 → google:', !!body.external_google_enabled, '| kakao:', !!body.external_kakao_enabled);

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
const txt = await res.text();
console.log('HTTP', res.status);
if (!res.ok) { console.log(txt.slice(0, 600)); process.exit(1); }
try {
  const j = JSON.parse(txt);
  console.log('✓ google_enabled =', j.external_google_enabled, '| kakao_enabled =', j.external_kakao_enabled);
  console.log('✓ site_url =', j.site_url);
  console.log('✓ uri_allow_list =', j.uri_allow_list);
} catch { console.log('완료'); }
