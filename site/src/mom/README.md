# 크라마 맘 (`/mom/`)

임신·육아 서비스. 나중에 별도 앱(또는 도메인)으로 떼어낼 수 있게 이 폴더 + `src/pages/mom/` + `public/mom/` 만으로 동작한다.

## 파일

| 파일 | 역할 |
|---|---|
| `MomLayout.astro` | 앱 셸. 모바일 = 투명 상단바 + 하단 탭바 5개, PC(≥960px) = 왼쪽 사이드바(메뉴·내 D-day). `window.CramaMom`(저장값 읽기·주수 계산) 정의 |
| `Sky.astro` | 하늘·초원 히어로. `public/mom/scene-*.webp` 가 없으면 CSS 하늘 + SVG 언덕 |
| `Mascot.astro` | 몽이(구름, 엄마)·콩이(아기 콩). `public/mom/char/{char}-{pose}.webp` 가 있으면 그림, 없으면 SVG |
| `Icon.astro` | 둥근 선 아이콘 |
| `mom.css` | 디자인 토큰 `--mo-*`(사이트 토큰과 독립), 다크 = 밤 하늘 모드 |
| `lib.ts` | 검사 일정·예방접종·검진·지원금 규칙(지원금은 매년 1월 확인) |
| `weeks.ts` | 4~40주 데이터 + 크기 비유 그림문자 |

- 사이트에서 빌려 쓰는 것: `components/BaseHead.astro`(메타·분석·테마, manifest/themeColor/appTitle/appleIcon 프롭), `components/CookieConsent.astro`. 분리할 때 이 둘만 옮기거나 바꾸면 된다.
- PWA: `public/mom/manifest.webmanifest`(scope `/mom/`) + `public/mom/icon-*.png`. 서비스워커는 사이트 공용 `/sw.js`.
- 기기 저장 키: `crama:mom`(예정일 입력) `crama:mom-baby`(아기 생일) `crama:mom-check`(출산가방) `theme`(사이트와 공용).

## 그림 다시 만들기

```bash
cd automation
node gen-mom-chars.js                    # 없는 것만 생성
node gen-mom-chars.js mong-hi kong-cheer # 지정한 것만 다시
```

`*-idle` 이 골드 마스터이고 다른 포즈는 그 그림을 레퍼런스로 만든다. 새 포즈를 추가하면 `POSES`·`JOBS` 와 `Mascot.astro` 의 `pose` 타입에 함께 넣을 것.
