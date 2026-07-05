# 그로스 플랜 상세 기획 (ROADMAP.md의 하위 문서)

> 각 항목: **무엇을 / 어디에·어떻게 / 담당 / 완료 조건 / 지표·목표**.
> 담당 표기 — 🤖 자동(Claude 구현·크론) / 👤 사용자(계정·수동 액션 필요).

---

## 1단계. 측정 — "안 보이면 못 고친다" (이번 주)

### 1-1. 이벤트 스키마 완성 🤖 (일부 완료)
| 이벤트 | 언제 | 구현 위치 | 상태 |
|---|---|---|---|
| `save_item` {item_type,item_id} | 하트 저장(추가 시만) | BaseLayout CramaSaved.toggle | ✅ 2026-07-05 |
| `profile_save` {keys} | 내 정보 저장 성공 | BaseLayout CramaProfile.set | ✅ |
| `push_nudge` {action:shown/granted} | 넛지 노출·수락 | BaseLayout 넛지 스크립트 | ✅ |
| `benefits_result` {count,total} | 매칭 결과 표시 | benefits.astro | ✅ (기존) |
| `calc_result` {calc} | 각 계산기 결과 표시 1회 | car-tax·property-tax·gift-tax·inheritance-tax·unemployment·median-income calc() 끝 | ⬜ 다음 배포 |
| `login` {method} | 로그인 성공 복귀 | login.astro 콜백 처리부 | ⬜ |
| `push_subscribe` {source:briefing/nudge} | 구독 성공 | BriefSubscribe + 넛지(granted와 별도로 구독 저장 성공 시) | ⬜ |
| `onboard_done` {age,region} | 홈 3문답 완료 | index.astro finish() | ⬜ |
| `streak_chip` {action:view/click} | 스트릭 칩(2-1) | 신규 컴포넌트 | ⬜ 2단계와 함께 |

### 1-2. 액티베이션 퍼널 정의 🤖→👤
- **정의(가설)**: A0 방문 → **A1** `calc_result`·`benefits_result` 중 1회 → **A2** `save_item`·`profile_save`·`push_subscribe` 중 1회
- GA4 탐색 보고서 2개 저장(👤 GA4 콘솔에서 1회 설정, 방법은 아래):
  1) **퍼널 탐색**: A0(page_view)→A1→A2, 기간 주간
  2) **동질 집단(코호트)**: 첫 방문 주 기준 D7 재방문율
- **목표선**: A1 40%+ / A2 10%+ / D7 ≥ 7%(Amplitude 상위 25% 라인)
- 완료 조건: 첫 주간 수치 1회 기록(스크린샷 or 메모) — 이후 매주 월요일 확인 루틴

### 1-3. 서버측 주간 리포트 크론 🤖
- `automation/report-weekly.js` 신규: pgConn으로
  `auth.users` 수(누적/주간 신규) · `user_profile` 행 · `saved_items` type별 행 · `push_subscriptions`(전체/user_id 연결) · `pmf_responses`(4단계 후)
- 출력: 콘솔 + `automation/output/weekly-report-YYYY-MM-DD.md` 파일. 크론(sync-calendar.yml 뒤 or 로컬 주1회)
- 완료 조건: 첫 리포트 파일 생성. **WAU 게이트(4단계 개시 판단)도 이 리포트가 담당**

---

## 2단계. 리텐션 — 기존 유저 재방문 (1~2주)

### 2-1. 스트릭 전역 노출 🤖 (Duolingo: 스트릭 가시성=핵심)
- 헤더 밀웜 배지 옆 or 홈 상단에 **미니 스트릭 칩** "🔥 N일" (로그인+streak≥2일 때만, crama:streak 캐시 재사용 → 0ms)
- 클릭 → /calendar/(출석 캘린더). `streak_chip` 이벤트로 노출·클릭 측정
- 완료 조건: 배포 + 이벤트 수집. 성공 지표: 칩 노출 유저의 D7 vs 미노출(관찰)

### 2-2. 푸시 옵트인 퍼널 최적화 🤖
- 2주간 `push_nudge` shown→granted 전환율 수집 → **15% 미만이면 실험**:
  - 카피 A: "마감 D-3·D-1 알림" (현재) vs B: "놓치면 가산세 — 알림 켜기"
  - 타이밍: 저장 직후(현재) vs 2번째 저장부터
- 구현: 넛지 스크립트에 variant 로컬 배정 + gtag 파라미터 `v:a/b`
- 목표: granted율 상향(금융 앱 벤치마크 72%는 네이티브 기준 — 웹은 15~25%가 현실적 목표)

### 2-3. 브리핑 데일리 푸시 구독 접점 확대 🤖 (주1회+ 수신자 리텐션 +440% 근거)
- 접점 추가: ①홈 온보딩 완료 화면에 "매일 아침 3분 브리핑 알림" 버튼 ②/briefing 2회째 방문 시 상단 배너 1회(7일 스누즈)
- 지표: `push_subscribe`{source} 주간 순증

### 2-4. 원탭 기본 알림 팩 🤖
- /tax 상단에 "올해 남은 세금 일정 전부 알림 받기(1탭)" 버튼 → 남은 일정 dday 일괄 S.add
- 저장 0개 상태를 즉시 3~5개로 — D-day 복귀 훅 최대화. 지표: 버튼 클릭율, save_item 급증분

### 2-5. (P2) 푸시 랜딩 개선 🤖
- D-day 푸시 클릭 랜딩(/saved-picks)에 "다음 일정 추가" 제안 블록

---

## 3단계. 유통 — 배관 공사 (2~4주, 콘텐츠 추가보다 우선)

### 3-1. 네이버 서치어드바이저 운영 👤(조작)+🤖(가이드·코드)
- 등록 ✅(색인 진행 중, 구버전 캐시 5~6p 존재)
- 👤 **사이트맵 제출**: 서치어드바이저 → 요청 → 사이트맵 제출 → `https://crama.app/sitemap-index.xml`
- 👤 **수집 재요청**(구버전 갱신): 요청 → 웹 페이지 수집 → 구버전 URL 5~6개 + 아래 우선 URL(일 50건 한도):
  `/` `/briefing/` `/tax/` `/salary/` `/rates/` `/loans/` `/median-income/` `/property-tax/` `/gift-tax/` `/inheritance-tax/` `/benefits/` `/youth/` `/welfare/`
- 🤖 robots.txt Yeti 허용 확인 ✅ · 사이트맵 자동 갱신 ✅(빌드마다)
- 지표: 서치어드바이저 색인 페이지 수 주간 기록(주간 리포트에 수동 한 줄)

### 3-2. 토픽 클러스터 내부링크 자동화 🤖 (NerdWallet 근거)
- run.js 발행 단계에 **키워드→계산기/허브 매핑** 자동 삽입: 글 본문 첫 매칭 키워드에 링크 or 글 말미 "관련 도구" 박스
  - 매핑 예: 연봉·월급·실수령→/salary · 재산세→/property-tax · 증여→/gift-tax · 상속→/inheritance-tax · 금리·예금→/rates · 대출→/loans · 실업·퇴사→/unemployment · 중위소득·기초생활→/median-income · 청년→/youth
- 기존 글 소급: 조회 상위 30개만 수동(일괄 스크립트로 후보 추출 → 검수 후 커밋)
- 완료 조건: 신규 발행 글에 자동 포함 확인. 지표: 계산기 유입 중 referrer=blog 비중

### 3-3. 고의도 페이지 SEO 보강 🤖
- rates·loans·tax·salary 허브에 **FAQPage JSON-LD**(각 4~6문답) + title 연도 자동 최신화 점검
- 지표: 해당 URL 노출·클릭(서치콘솔) 4주 추이

### 3-4. Threads 반자동 배포 루틴 유지 👤+🤖 (주 3회)
- 🤖 social-queue.js로 추천+카드 생성 → 👤 수동 게시(자동 게시 금지 유지)
- 지표: 스레드 유입 세션 주간

---

## 4단계. PMF 검증 — WAU 100+ 게이트 (도달 시)

### 4-0. 게이트 판정 🤖
- 주간 리포트의 WAU가 **2주 연속 100+** → 4-1 개시. 그 전엔 4단계 착수 금지(표본 부족)

### 4-1. Sean Ellis 1문항 위젯 🤖
- 노출 대상: 재방문 3회+ 유저(localStorage 방문 카운트), 1회만
- 질문: "크라마를 더 못 쓰게 되면 어떨까요?" (매우 실망/약간 실망/상관없음) + 후속 "가장 유용했던 기능은?"(객관식: 브리핑/계산기/혜택매칭/알림/기타)
- 저장: Supabase `pmf_responses`(익명 OK, RLS insert-only). 표본 40+부터 판독
- 판정: **매우 실망 ≥40%** → 4-2 진행 / 미만 → '매우 실망' 응답자의 최다 기능에 집중, 나머지 축소

### 4-2. 수익화 착수(조건부) 👤+🤖
- NerdWallet 모델: 고의도 페이지(rates·loans)에 제휴 — 국내 제휴 프로그램 조사(핀다·뱅크샐러드 제휴, 카드사 CPS 등)는 PMF 신호 후에만
- 애드센스는 현행 유지(이미 적용)

---

## 주간 운영 루틴 (매주 월요일, 15분)
1. 주간 리포트 확인(1-3) — WAU·프로필·저장·구독 증감
2. GA4 퍼널·코호트 확인(1-2) — A1/A2/D7 3개 숫자 기록
3. 서치어드바이저 색인 수 + 서치콘솔 클릭 기록
4. 이번 주 실험 1개 선정(2단계 백로그에서)
