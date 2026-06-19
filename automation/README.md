# Crama 자동화 파이프라인

리서치 → 원본 글 작성 → 이미지 생성 → 품질·중복 게이트 → 발행(MDX)까지 1회 실행으로 처리합니다.

## 구조
```
automation/
├─ config/themes.json   # 카테고리·클러스터·목표 글수 (여기만 고치면 주제 관리)
├─ lib/
│  ├─ claude.js         # 리서치(web_search) + 글 작성(구조화 출력) + 이미지 프롬프트
│  ├─ image.js          # 이미지 생성 (openai | stability | placeholder)
│  └─ util.js           # 슬러그·기존글 파싱·중복 유사도
└─ run.js               # 오케스트레이터 (1회 = 글 1개)
```

## 셋업
```bash
cd automation
npm install
cp .env.example .env        # 키 입력 (ANTHROPIC_API_KEY 필수)
```

## 실행
```bash
# 키 없이 흐름만 테스트 (이미지=placeholder, 미리보기는 automation/output/ 에 저장)
IMAGE_PROVIDER=placeholder node run.js --dry-run

# 실제 발행 (site/src/content/blog 에 .mdx 생성)
node run.js
node run.js --category=ai     # 카테고리 강제
```

## 모델/비용
- 본문: `WRITE_MODEL`(기본 sonnet) · 리서치: `RESEARCH_MODEL`(기본 opus)
- 글 1개 ≈ ₩700~1,100 (모델·이미지에 따라). 프롬프트 캐싱 시 추가 절감.

## 두 가지 운영 모드

### 1) 수동 모드 (Claude Code에서, 가장 저렴) — 글당 ~₩80
리서치·글은 Claude Code(Max 플랜=정액, API 과금 0)에서 작성하고, **이미지만 OpenAI로** 생성.
1. 대화에서 글을 작성 → `site/src/content/blog/<slug>.mdx` 로 저장 (heroImage는 임시값)
2. 이미지만 붙이기 (Anthropic API 미사용):
   ```bash
   node add-image.js <slug> "A clean editorial illustration of ..."
   ```
3. `cd ../site && npm run build` 확인 → git 커밋·푸시 → Vercel 배포

### 2) 무인 모드 (GitHub Actions cron) — 글당 ~₩400~1,000
`.github/workflows/publish.yml` 가 매일 1회 `run.js` 실행 → 리서치·글·이미지 자동 생성 → 커밋/푸시 → Vercel 배포.
GitHub repo Settings → Secrets 에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` 등록.

> 권장: 챙길 수 있는 고품질 글은 **수동 모드**, 밤새 자동 양산은 **무인 모드**.
