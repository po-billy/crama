# 환경 분리 가이드

## 개요
- `APP_ENV` 값에 따라 서로 다른 `.env` 파일을 순차적으로 로드합니다.
- 기본 순서는 `.env` → `.env.<APP_ENV>` → (로컬일 때) `.env.local` 입니다.
- 프런트엔드에서는 `/env.js` 엔드포인트를 통해 런타임 환경값을 받아 사용합니다.

## 필수 환경 변수
| 이름 | 설명 |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | 서버와 클라이언트가 공유하는 Supabase 프로젝트 정보 |
| `SUPABASE_SERVICE_ROLE_KEY` | 관리자 권한 작업에만 사용 (절대 `/env.js` 로 노출되지 않음) |
| `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` | `/env.js`를 통해 노출되는 Supabase 공개 키 (미설정 시 `SUPABASE_*` 값을 재사용) |
| `PUBLIC_API_BASE_URL` | 정적 자바스크립트가 호출할 API 서버 주소 (기본: 동일 출처) |
| `OPENAI_API_KEY`, `OPENAI_IMAGE_MODEL`, `OPENAI_ANALYZE_MODEL` | OpenAI 호출용 |
| `STABILITY_API_KEY`, `UNSPLASH_ACCESS_KEY` | 기타 외부 API 키 |
| `PADDLE_*` 변수 | Paddle 결제 연동 시 사용 |
| 나머지 `CREDIT_*`, `DAILY_WELCOME_*`, `SERVICE_CODE_STUDIO` 등 | 비즈니스 로직/크레딧 정책 조정 |

> `.env.example` 에 모든 키가 나열되어 있으니 필요 값만 골라 `.env.local`, `.env.production` 등을 작성하세요.

## 실행 방법
- 로컬 테스트: `npm start` (자동으로 `APP_ENV=local` 적용)
- 라이브 환경 확인: `npm run start:live`
- Granite dev server: `npm run dev` (로컬 환경)
- 빌드/배포: `npm run build`, `npm run deploy` (자동으로 `APP_ENV=production`)

## 프런트엔드에서의 사용
- `public/js/common.js` 가 `/env.js` 결과를 읽어 `window.__ENV__`, `window.sb`, `window.apiFetch` 를 초기화합니다.
- 모든 `/api/...` 호출은 `window.apiFetch()` 를 사용하므로 `PUBLIC_API_BASE_URL` 만 바꿔도 API 서버를 분리할 수 있습니다.

## 체크리스트
1. `.env.local` (개발) 과 `.env.production` (라이브) 파일을 작성한다.
2. 라이브 서버/배포 파이프라인에서 `APP_ENV=production` 이 전달되는지 확인한다.
3. 프런트엔드가 로드되기 전에 `<script src="/env.js"></script>` 가 포함되어 있는지 확인한다 (이미 모든 HTML에 삽입됨).
4. Supabase 공개 키는 `PUBLIC_SUPABASE_*` 로 관리하고, 서비스 롤 키는 절대 클라이언트에 노출하지 않는다.

## 운영(Netlify) 구성 예시
1. Netlify 대시보드 → Site configuration → Environment variables에 **프로덕션 Supabase 프로젝트** 값을 입력
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (대부분 위 값과 동일)
   - `PUBLIC_API_BASE_URL=https://<your-live-domain>` (정적 사이트와 API 서버가 같다면 빈 값으로 두어도 됨)
   - 기타 OpenAI, Paddle, Stability 등 모든 비밀 키
2. Netlify 빌드/Functions 환경에서 `APP_ENV=production` 으로 설정
3. Supabase 프로덕션 프로젝트에 테이블, 스토리지 버킷, Auth 설정을 모두 라이브 기준으로 구성
4. 배포 후 `/env.js` 호출 결과에 프로덕션 값이 노출되는지 확인

## 로컬 구성 예시
1. Supabase에서 **개발 전용 프로젝트**를 따로 만들고 필요한 테이블/스토리지/인증 규칙을 동일하게 세팅
2. 저장소 루트에 `.env.local` 파일을 만들고 `.env.example` 내용을 복사한 뒤 로컬 프로젝트 키를 입력
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`
   - `PUBLIC_API_BASE_URL=http://localhost:3000` (기본값 유지)
3. `npm start` 또는 `npm run dev` 로 실행하면 자동으로 `APP_ENV=local` 이 설정되어 `.env.local` 값만 사용
4. 라이브 키를 백업 목적으로 `.env.production` 에 적어 두어도 되지만 **실제 배포에는 Netlify 환경 변수만 신뢰**
