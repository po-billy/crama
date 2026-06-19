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

## 무인 운영
`.github/workflows/publish.yml` 가 매일 1회 실행 → 글 생성 → 커밋/푸시 → Vercel 자동 배포.
GitHub repo Settings → Secrets 에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`(또는 STABILITY) 등록.
