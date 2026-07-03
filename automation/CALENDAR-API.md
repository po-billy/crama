# 정책 캘린더 실데이터 연동 — API & serviceKey 가이드

정책 캘린더(`site/src/pages/policy-calendar.astro`)는 현재 하드코딩된 `EVENTS` 배열(33건)을 씁니다.
아래 공공 API로 **신청 시작/종료일이 있는 지원사업·정책을 자동 수집** → `EVENTS` 자동 생성으로 대체할 수 있습니다.

## 🔑 인증키 받는 법 (무료) — 기관 아니어도 **개인 발급 가능**

우리가 쓰는 두 API는 **각 기관 자체 포털**에서 키를 받습니다 (공공데이터포털 불필요):
- **기업마당**: [bizinfo.go.kr](https://www.bizinfo.go.kr) 로그인 → OPEN API → `crtfcKey` — ✅ 발급 완료
- **온통청년**: [youthcenter.go.kr](https://www.youthcenter.go.kr) 로그인 → **마이페이지 > OPEN API > 인증키 신청** → `apiKeyNm`

받은 키는 `automation/.env` 에 `BIZINFO_KEY=...`, `YOUTH_API_KEY=...` 로 넣어주세요.

### ⚠️ 공공데이터포털(data.go.kr) 은 '복지서비스' 등 선택 API 쓸 때만 — 주의점
- **개인도 신청 가능** (기관 전용 아님).
- 반드시 API 상세페이지의 **[활용신청]** 버튼을 쓸 것 → 회원가입 → 활용신청 → 대부분 **즉시 자동승인** → 마이페이지에서 `serviceKey`.
- ❌ **[제공신청 / 제공요청]** 은 완전히 다른 것 — *아직 개방 안 된 데이터를 새로 열어달라*는 요청서. 거기 '기관명'은 **데이터 소유 기관을 고르는** 칸이지 신청자가 기관이어야 한다는 뜻이 아님. 우리 API엔 불필요.

## 📅 캘린더에 바로 쓰기 좋은 API (신청기간=날짜 있음)

| API | 제공 | 상세페이지 | 담는 데이터 |
|---|---|---|---|
| **온통청년 청년정책** | 한국고용정보원 | [youthcenter.go.kr](https://www.youthcenter.go.kr) 마이페이지>OPEN API | 정책명·**신청기간(시작/종료)**·대상·분야·주관기관 |
| **기업마당 지원사업** | 중소벤처기업부 | https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do?id=bizinfoApi | 사업명·**신청시작/종료일자**·소관기관·상세URL (소상공인·창업·기업) |

## 🗂️ 복지·지원 서비스 목록 (대상·신청방법 상세, 날짜는 보조)

| API | 제공 | 상세페이지 |
|---|---|---|
| **중앙부처 복지서비스** | 한국사회보장정보원(복지로) | https://www.data.go.kr/data/15090532/openapi.do |
| **지자체 복지서비스** | 한국사회보장정보원 | https://www.data.go.kr/data/15108347/openapi.do |

## 🧾 세금 일정 = 법정 고정 (API 불필요, 코드 유지)
연말정산(1월)·종합소득세(5월)·부가세(1·7월)·재산세(7·9월)·종부세(11·12월) 등은 매년 동일 → 지금처럼 코드로 관리가 더 안정적. (참고: https://www.nts.go.kr)

## ➕ 선택 후보 (지금은 **스킵 권장** — 캘린더 가치 낮음)
- **K-Startup 창업지원** (k-startup.go.kr): 창업 공고 → **기업마당(창업 분야)과 상당 부분 중복**
- **한국장학재단 국가장학금** (kosaf.go.kr): 학기별 신청 → **일정이 매년 고정(5~6월/9월)이라 세금처럼 코드로** 두는 게 안정적
- **주택도시기금 주거대출** (nhuf.molit.go.kr): 전세·월세 대출은 **상시 상품(마감일 없음)** → 캘린더 부적합, 혜택찾기용

## 🔌 연동 방식 (예정)
`automation/` 에 `sync-calendar.js` 를 두고: 위 API fetch → 정규화(제목·설명·시작/종료일·분야·대상·URL) → `site/src/data/policy-events.json` 생성 → 캘린더가 그 JSON을 로드.
빌드/크론 때 갱신하면 캘린더가 **실시간 데이터로 자동 유지**됩니다. 키(`BIZINFO_KEY`·`YOUTH_API_KEY`)만 `.env`에 넣어주시면 착수합니다.

> 우선순위 추천: **온통청년 + 기업마당** 2개부터. (둘 다 신청기간 필드가 있어 캘린더에 바로 매핑됨)

---

## 🧩 기업마당 실전 연동 (JSON — 실제 응답 검증 완료 2026-07)

**포맷은 JSON.** XML(RSS)와 필드는 동일하지만 Node에선 `res.json()` 한 줄. XML은 파서 의존성만 늘어남.

### 요청
```
GET https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do
  ?crtfcKey=${BIZINFO_KEY}   # 발급 인증키 (.env)
  &dataType=json
  &searchCnt=0               # 0/미지정=전체(수천 건) → 실제론 분야·태그로 좁히는 게 좋음
  &searchLclasId=06          # (선택) 01금융 02기술 03인력 04수출 05내수 06창업 07경영 09기타
  &hashtags=서울             # (선택) 지역/분야 태그, 콤마 다중
```

### ⚠️ 실제 응답 = 문서와 다름 (검증함)
- 문서: `{"jsonArray":{ …channel…, "item":[…] }}` → **실제: `{"jsonArray":[ {공고}, … ]}`** (jsonArray가 곧 배열)
- 문서의 `reqstDt`·`hashTags`(대문자 T)는 **실제 응답에 없음**. 실제는 **`reqstBeginEndDe`**(신청기간 `YYYY-MM-DD ~ YYYY-MM-DD`)·`hashtags`(소문자).

```json
{
  "jsonArray": [
    {
      "pblancNm": "[충북] 2026년 성과 창출형 상용화 지원사업 참여기업 모집 공고",
      "reqstBeginEndDe": "2026-07-13 ~ 2026-07-14",
      "pldirSportRealmLclasCodeNm": "경영",
      "jrsdInsttNm": "충청북도",
      "trgetNm": "중소기업",
      "pblancUrl": "https://www.bizinfo.go.kr/sii/siia/selectSIIA200Detail.do?pblancId=PBLN_000000000123787",
      "pblancId": "PBLN_000000000123787",
      "creatPnttm": "2026-06-30 14:49:31"
    }
  ]
}
```

### 캘린더 매핑 (→ `site/src/data/policy-events.json`)
| 기업마당 | 우리 필드 | 비고 |
|---|---|---|
| `pblancNm` | `title` | 공고명 |
| `reqstBeginEndDe` | `start` / `end` | `" ~ "` 분리, **종료일=마감** |
| `pldirSportRealmLclasCodeNm` | `field` | 분야 |
| `jrsdInsttNm` | `org` | 소관기관 |
| `trgetNm` | `target` | 지원대상 |
| `pblancUrl` | `url` | 상세 링크 |
| `pblancId` | `id` | 중복 제거 키 |

### 파싱 스니펫 (`sync-calendar.js` 초안)
```js
const KEY = process.env.BIZINFO_KEY;
const res = await fetch(`https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?crtfcKey=${KEY}&dataType=json&searchCnt=0`);
const { jsonArray } = await res.json();

const events = jsonArray
  .map(it => {
    const [start, end] = (it.reqstBeginEndDe || '').split('~').map(s => s.trim());
    return (start && end) ? {
      id: it.pblancId,
      title: it.pblancNm,
      start, end,                              // 'YYYY-MM-DD'
      cat: 'benefit',
      field: it.pldirSportRealmLclasCodeNm,
      org: it.jrsdInsttNm,
      target: it.trgetNm,
      url: it.pblancUrl,
    } : null;
  })
  .filter(Boolean);                            // 신청기간 없는 '상시' 공고는 캘린더에서 제외
```

> **주의**: 기업마당 전체는 수천 건 + 상당수가 상시(날짜 빈 값). 캘린더엔 ①`reqstBeginEndDe` 있는 것만 ②마감 임박(종료일 기준 N일 이내)만 넣고, 나머지는 혜택찾기 목록용으로만 쓰는 걸 권장.
