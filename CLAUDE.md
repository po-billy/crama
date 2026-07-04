# crama.app — 프로젝트 가이드 (Claude용)

한국어 생활금융 서비스. **블로그(돈·AI·부업) + 실데이터 유틸 허브**(정책·복지·금리·연봉).
Astro 정적 사이트 + 무인 자동화 파이프라인. main에 push하면 Vercel이 자동 배포한다.

## 구조

```
site/                 Astro 5 정적 사이트 (한국어)
  src/pages/          라우트 (아래 '주요 라우트' 참고)
  src/content/blog/   아티클(.mdx) — 자동발행 파이프라인이 생성
  src/data/*.json     빌드타임 데이터 (sync 스크립트가 생성, 크론이 매일 갱신)
  public/data/*.json  온디맨드 fetch용 (지자체복지 풀본, 매칭용 슬림본)
automation/           발행·동기화·발송 스크립트 (Node, ESM)
  run.js              일일 아티클 발행 파이프라인(리서치→작성→이미지→MDX)
  sync-*.js           공공API→JSON (youth/welfare/welfare-local/rates/loans/policies)
  send-*.js           푸시/이메일 발송 (send-deadline-alerts.js = 저장항목 D-1·D-3 알림)
supabase/             DB 스키마 SQL (saved_items, push_subscriptions 등)
.github/workflows/    publish.yml(매일 글 1편), sync-calendar.yml(매일 데이터+마감알림)
```

## 주요 라우트

- 콘텐츠: `/briefing`(간판) `/blog/[slug]` `/search`(글+정책+복지+혜택 통합)
- 매칭: `/benefits`(프로필 매칭+확장매칭) — 홈 온보딩 3문답과 연결
- 실데이터 디렉터리: `/youth/[id]`(청년 500) `/welfare/[id]`(중앙460+지자체4,600) `/policy-calendar`
- pSEO 계산표: `/salary/[amount]` `/wage/[hourly]` `/interest/[amount]` `/severance/[pay]` `/rates` `/loans`
- 리텐션: `/saved-picks`(내 관심함, 로그인 전용) — 하트 저장은 `window.CramaSaved`(BaseLayout 정의)

## 반드시 지킬 규칙

1. **비밀키 커밋 금지**: `automation/.env`, `supabase/.env`, `openapi.md`(미추적 유지), 루트의 PNG들, `new-app/`, `screenshot/` — 절대 add하지 말 것. 커밋은 명시적 파일 지정으로만.
2. **콘텐츠는 양보다 질**: 같은 날 유사 주제 글 2편 금지(자기잠식). 가이드=실명 저자(엄희송), 칼럼=페르소나 — 되돌리지 말 것.
3. **스레드·인스타 자동 게시 절대 금지**(계정 정지 이력). 드래프트 파일만 생성.
4. 커밋 메시지는 한국어 `feat(scope): 요약` 스타일 + `Co-Authored-By: Claude <noreply@anthropic.com>`.

## 함정 (실제로 당한 것들 — 반복 금지)

- **`[hidden]`이 `display:flex/grid`에 눌린다**: 카드/버튼을 JS로 `hidden` 토글하면 반드시 `.클래스[hidden]{display:none}` 규칙을 함께 둘 것.
- **Astro 스코프 스타일은 `innerHTML`로 주입한 요소에 안 먹는다** → 클라이언트 렌더 대상은 `<style is:global>`.
- **프론트매터에서 나눗셈 `/`와 `//` 주석을 같은 줄에 쓰지 말 것**: 컴파일러가 export를 중복 생성해 `Unexpected "export"`로 빌드 실패(에러 위치도 엉뚱함). 주석은 윗줄로.
- 숨김/노출 검증은 `hidden` 속성이 아니라 **`offsetHeight > 0`** 로.
- AI 생성 MDX는 `items={[...]}`의 닫는 `}` 누락 여부 확인(`] />` → `]} />`).
- finlife API는 **https + User-Agent 헤더 필수**(없으면 응답 끊김). 복지 목록 API는 `srchKeyCode` 필수. 복지 상세조회는 일 100회 제한 → 실행당 80건 증분 보강(`rich` 필드 유지).
- sync 스크립트는 **내용 동일 시 파일 유지**(generatedAt 제외 비교) — 무의미 커밋 방지 가드를 깨뜨리지 말 것. 슬림 사본(youth-slim 등)엔 generatedAt 넣지 않는다.

## 클라이언트 상태 (localStorage)

`crama:saved`(관심함 캐시 — 원본은 Supabase saved_items, 로그인 전용) · `crama:benefits:profile` ·
`crama:read`(읽음) · `crama:recent`(최근 본 글) · `crama:recent-search` · `crama:bf-interest` ·
`crama:onboard-v1`(홈 온보딩 완료) · `crama:login-return`(로그인 후 복귀 URL)

- `window.CramaSaved`는 BaseLayout body 최상단에서 정의 — 페이지 스크립트보다 먼저 실행돼야 한다.
- 푸시 구독(subscribe_push RPC)은 로그인 시 유저 토큰으로 호출해 `user_id`를 기록(마감 알림용).

## 빌드·검증

```bash
cd site && npm run build        # 정적 빌드(~6,500p, 1분 내외)
npx astro preview --port 4322   # dist 서빙(재빌드하면 자동 반영)
```
- UI 변경은 puppeteer-core 헤드리스로 실제 가시성(offsetHeight)·동작까지 검증하는 것이 이 프로젝트의 관례.
- 배포 = main push (Vercel 자동). 데이터 JSON은 크론이 매일 커밋하므로 수동으로 안 만져도 된다.

## 클라우드/모바일 세션 참고

- 가능: 사이트 코드 수정·빌드·push(배포).
- 불가: `automation/.env`가 필요한 작업(글 생성, API sync, 푸시 발송) — 로컬 PC 전용이며 어차피 크론이 매일 자동 수행.
