# 정책 캘린더 실데이터 연동 — API & serviceKey 가이드

정책 캘린더(`site/src/pages/policy-calendar.astro`)는 현재 하드코딩된 `EVENTS` 배열(33건)을 씁니다.
아래 공공 API로 **신청 시작/종료일이 있는 지원사업·정책을 자동 수집** → `EVENTS` 자동 생성으로 대체할 수 있습니다.

## 🔑 serviceKey 받는 법 (공공데이터포털, 무료)

1. **[공공데이터포털(data.go.kr)](https://www.data.go.kr)** 회원가입 · 로그인
2. 아래 각 API 상세페이지에서 **[활용신청]** 클릭 (대부분 **즉시 자동승인**)
3. **마이페이지 → 개발계정 → 일반 인증키(serviceKey)** 확인
   - **키 1개로 신청한 모든 API 공용**. (Encoding/Decoding 두 형태로 제공 — REST 호출엔 보통 Decoding 키)
4. 받은 키를 `automation/.env` 에 `DATA_GO_KR_KEY=...` 로 넣어주시면 연동 스크립트를 붙입니다.

## 📅 캘린더에 바로 쓰기 좋은 API (신청기간=날짜 있음)

| API | 제공 | 상세페이지 | 담는 데이터 |
|---|---|---|---|
| **온통청년 청년정책** | 한국고용정보원 | https://www.data.go.kr/data/15143273/openapi.do | 정책명·**신청기간(시작/종료)**·대상·분야·주관기관 |
| **기업마당 지원사업** | 중소벤처기업부 | https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do?id=bizinfoApi | 사업명·**신청시작/종료일자**·소관기관·상세URL (소상공인·창업·기업) |

## 🗂️ 복지·지원 서비스 목록 (대상·신청방법 상세, 날짜는 보조)

| API | 제공 | 상세페이지 |
|---|---|---|
| **중앙부처 복지서비스** | 한국사회보장정보원(복지로) | https://www.data.go.kr/data/15090532/openapi.do |
| **지자체 복지서비스** | 한국사회보장정보원 | https://www.data.go.kr/data/15108347/openapi.do |

## 🧾 세금 일정 = 법정 고정 (API 불필요, 코드 유지)
연말정산(1월)·종합소득세(5월)·부가세(1·7월)·재산세(7·9월)·종부세(11·12월) 등은 매년 동일 → 지금처럼 코드로 관리가 더 안정적. (참고: https://www.nts.go.kr)

## ➕ 선택 후보
- K-Startup 창업지원: https://www.k-startup.go.kr
- 한국장학재단 국가장학금: https://www.kosaf.go.kr
- 주택도시기금(주거대출): https://nhuf.molit.go.kr

## 🔌 연동 방식 (예정)
`automation/` 에 `sync-calendar.js` 를 두고: 위 API fetch → 정규화(제목·설명·시작/종료일·분야·대상·URL) → `site/src/data/policy-events.json` 생성 → 캘린더가 그 JSON을 로드.
빌드/크론 때 갱신하면 캘린더가 **실시간 데이터로 자동 유지**됩니다. serviceKey(`DATA_GO_KR_KEY`)만 있으면 착수합니다.

> 우선순위 추천: **온통청년 + 기업마당** 2개부터. (둘 다 신청기간 필드가 있어 캘린더에 바로 매핑됨)
