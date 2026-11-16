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

## 포털 개편 (브랜치 `redesign-portal`, 진행 중)

"금융 매거진"에서 "매일 쓰는 조회·계산기 + 볼거리 포털"로 전환 중. 참고 사이트는 k-calc.com(구조만 참고, 코드·문구 복제 금지).

- **메뉴의 원본은 `site/src/data/menu.ts` 하나.** 헤더 탭·전체 메뉴·홈·분야 페이지(`/hub/[slug]/`)가 전부 이 파일을 읽는다. 항목에 `href`가 있으면 공개, 없으면 '준비 중'(메뉴에는 숨기고 분야 페이지의 '곧 추가돼요'에만 노출). 새 페이지를 만들면 `href`만 채우면 된다. 들어갈 페이지가 0개인 탭·분야는 자동으로 숨는다.
- 공통 스타일 `site/src/styles/portal.css`(클래스 접두사 `pt-`), 헤더 `ph-`, 전체 메뉴 `pm-`. 색은 기존 토큰(`--paper`, `--ink`, `--accent` …)만 사용.
- 카드 그림은 `site/public/img/portal/*.webp` — OpenAI `gpt-image-2.6-sunburst`(quality high, 1024px, 장당 약 $0.05)로 생성. 분야 표지는 `g-{slug}.webp`, 개별 카드는 `c-*.webp`.
- 이전 홈·헤더는 `site/src/legacy/`에 보관(빌드에 포함 안 됨).
- 방문자 수에 비례해 API 비용이 나가는 기능은 광고 승인 전까지 만들지 않는다. 운세·타로·궁합 문장은 `data/fun.ts`에 미리 써 둔 것을 날짜·입력값으로 고르는 방식(실시간 AI 금지).
- 실존 인물은 공개된 사실 정보(생년월일·대표 직업 1개)만, 사진은 위키미디어 코먼스의 자유 이용 허락분만(저작자·라이선스 표기). 고인·미성년 제외. 갱신은 `node automation/sync-people.mjs`(무료, 키 불필요).
- **세금·보험 요율은 `site/src/lib/salary.ts`가 원본**(2026년: 국민연금 4.75%, 건강보험 3.595%, 장기요양 13.14%, 고용 0.9%, 연금 기준소득월액 41만~659만). 매년 1월(요율)과 7월(연금 상·하한)에 확인해 고칠 것. 연봉·월급·4대보험 계산기가 모두 이 값을 쓴다.
- 새로 만든 구역: `/people/`(목록·상세·띠·별자리) `/born/`(출생연도 모아보기 — 건강검진 유입을 다른 콘텐츠로 잇는 다리) `/age/` `/dday/` `/salary/monthly/` `/insurance/` `/freelance-tax/` `/realty-fee/` `/health/[tool]/` `/health-check/cancer/` `/convert/[tool]/` `/fortune/` `/tarot/` `/name-match/` `/zodiac-match/` `/lotto/` `/lunch/` `/games/*`(스도쿠·지뢰·벽돌·숫자 야구·퀴즈·오목·카드 짝·숫자 순서·반응속도) `/pick/[tool]/`(사다리·돌림판·주사위·랜덤 숫자·제비뽑기) `/calc/[tool]/`(퍼센트·할인·더치페이·학점·날짜·비밀번호·카드 할부·자동차 할부) `/lunar/` `/minimum-wage/`.
- 도구 묶음은 설정 파일 + 동적 라우트 한 쌍: `data/pick-tools.ts`↔`pick/[tool].astro`, `data/calc-tools.ts`↔`calc/[tool].astro`, `data/convert-tools.ts`, `data/health-tools.ts`. 도구를 추가하면 `menu.ts`에 `href`도 넣을 것.
- 인물 수집 스크립트는 한국어 위키백과 최근 60일 조회수 순으로 800명을 뽑도록 바뀌었지만, 위키백과 요청 제한(429)에 걸려 **아직 한 번도 끝까지 돌지 못했다**(people.json은 예전 기준 400명). 받은 조회수는 임시 폴더에 저장돼 다시 실행하면 이어받는다. 성공해서 `views`가 들어오면 `src/legacy/PeopleRank.astro`를 `src/pages/people/rank.astro`로 옮기고 메뉴의 '인기 인물 순위'에 `href`를 넣을 것.
- `/lunar/`의 음력 표는 빌드할 때 Node의 `Intl`(dangi 달력)로 만든다(1930~2050). `/minimum-wage/`의 `WAGES` 배열은 매년 8월 다음 해 금액이 고시되면 한 줄 추가하고, `wage/[hourly].astro`의 최저시급 값도 1월에 바꿀 것.
- **이어서 볼 콘텐츠(오른쪽 영역)**: `components/SideRail.astro`를 BaseLayout이 자동으로 붙인다(PC는 본문 오른쪽, 모바일은 본문 아래에 일부만). 붙일 주소는 `data/rail.ts`의 `RAIL_RE`, 목록(많이 찾는 조회·심심풀이·새로 나왔어요)도 같은 파일. 새 페이지를 만들면 `NEW_ITEMS` 맨 위에 추가하고, 새 구역이면 `RAIL_RE`에도 넣을 것. 최근 본 페이지는 `crama:recent-pages`(localStorage).
- **쿠팡 파트너스 링크**는 `data/partners.ts`에 모아 두고 `COUPANG_ON`(현재 false)으로 켠다. 애드센스 승인 전에는 켜지 말 것. 켜면 SideRail에 고지 문구와 함께 나온다. 링크는 파트너스에서 변환한 `link.coupang.com` 주소만 넣고, 고지 문구(`COUPANG_NOTICE`)는 수정·삭제 금지. API는 최종 승인(누적 판매액 기준) 전이라 사용 불가.
- 계산기 공통 틀은 portal.css의 `tl-*`(입력 카드·결과·표), 인물은 `pp-*`. `[hidden]`이 flex/grid에 눌리지 않도록 portal.css 끝의 규칙에 클래스를 추가할 것.
- 동적 라우트에서 `getStaticPaths`는 같은 파일 프런트매터의 `const`를 못 읽는다 → 설정은 `src/data/*.ts`로 빼서 import.
- 공휴일은 `node automation/sync-holidays.mjs`(한국천문연구원 특일 정보, `DATA_GO_KR_KEY`)가 올해·내년분을 `site/src/data/holidays.json`에 받는다. `/holidays/`와 `/business-days/`가 `lib/holidays.ts`로 읽는다. 임시공휴일이 지정되거나 해가 바뀌면 다시 실행할 것(아직 크론에는 없음).
- **보류(조건 충족 시 진행)**: 취득세·청약 가점·국민연금 예상 수령액·군인 월급·술 깨는 시간·예방접종(기준 검증 필요), 인물 근황 AI 요약(광고 승인 후), 쿠폰·핫딜(쿠팡 파트너스 API), 조회 순위 자동 집계(홈의 '많이 찾는 조회'는 수동 목록).

## 회원 UI 스위치 (`MEMBER_UI`, 현재 꺼짐)

애드센스 심사 대응으로 회원 기능을 **삭제하지 않고 숨겼다**. `site/src/consts.ts`의 `MEMBER_UI = false`.

- 꺼짐: 로그인·마이·밀웜·옷장·뽑기·랭킹·투표·예측게임·챌린지·AI 진단으로 가는 진입점(헤더·하단탭·푸터·NAV·홈·글 상세)과 로그인 잠금(혜택·체크업 결과)을 숨긴다. 해당 페이지는 URL 직접 접근만 되고 `noindex` + 사이트맵 제외(`MEMBER_PATHS`).
- 꺼짐일 때 `CramaSaved`·`CramaProfile`은 계정 없이 localStorage에만 저장(로그인된 기존 회원은 서버 동기화 유지). 마감 푸시는 계정이 있어야 발송되므로 문구는 '알림'이 아니라 '관심함 저장·D-day'로 쓴다.
- 켜려면 `consts.ts`와 `astro.config.mjs`의 `MEMBER_UI`를 둘 다 `true`로. 클라이언트 스크립트는 `window.__CRAMA_MEMBER_UI`로 읽는다.
- 새 UI를 만들 때 회원 기능 링크는 반드시 이 스위치로 감쌀 것.

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
