# 고품질 오디오(백그라운드 청취) 셋업 가이드

목표: 글을 **발행할 때 한 번** Azure Neural TTS로 자연스러운 한국어 MP3를 만들어
Cloudflare R2(무료·송신 0원)에 올리고, 플레이어가 그 MP3를 재생한다.
→ **잠금화면/백그라운드 청취 가능**, 방문자 트래픽이 늘어도 **비용 0 유지**.

준비물은 무료 계정 **2개(Azure, Cloudflare)** 뿐. 아래 순서대로 키만 모아서
`automation/.env` 에 넣으면, 나머지(생성 스크립트·플레이어 연결)는 코드가 처리한다.

---

## ✅ 당신이 준비할 것 — 체크리스트

- [ ] **Azure** 무료 계정 + Speech 리소스(F0) → `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`
- [ ] **Cloudflare R2** 버킷 + API 토큰 → `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
- [ ] R2 버킷 **공개 접근**(커스텀 도메인 `audio.crama.app` 또는 r2.dev URL) → `R2_AUDIO_PUBLIC_BASE`
- [ ] `automation/.env` 에 위 값 입력 후 `npm install` (automation 폴더에서)

---

## 1) Azure Speech (무료 F0 — 매달 50만 자, 영구)

1. https://azure.microsoft.com/free 에서 무료 계정 생성(카드 등록은 하지만 F0는 과금 안 됨).
2. 포털(portal.azure.com) → **리소스 만들기** → "Speech" 검색 → **Speech** 생성.
   - 지역(Region): **Korea Central** 권장 (`koreacentral`)
   - 가격 책정 계층(Pricing tier): **F0 (무료)** 선택
3. 생성된 리소스 → 좌측 **키 및 엔드포인트(Keys and Endpoint)**:
   - **KEY 1** → `AZURE_SPEECH_KEY`
   - **위치/지역(Location)** → `AZURE_SPEECH_REGION` (예: `koreacentral`)
4. 음성(voice)은 기본 `ko-KR-SunHiNeural`(여성). 다른 것 원하면 `AZURE_TTS_VOICE` 로:
   - `ko-KR-SunHiNeural`, `ko-KR-InJoonNeural`(남성), `ko-KR-JiMinNeural`, `ko-KR-BongJinNeural` 등

> F0 한도: **월 50만 자**. 글당 ~5천 자라 하루 몇 편이면 매달 무료 안에서 충분.

---

## 2) Cloudflare R2 (무료 10GB + 송신 0원)

1. https://dash.cloudflare.com → 회원가입/로그인 → 좌측 **R2** → (최초 1회) 결제수단 등록(무료 한도 내 과금 없음).
2. **버킷 만들기** → 이름 `crama-audio` (지역 자동).
3. **계정 ID 확인**: R2 개요 페이지 우측 또는 대시보드 URL에서 확인 → `R2_ACCOUNT_ID`
4. **API 토큰 발급**: R2 → **Manage R2 API Tokens** → *Create API token*
   - 권한: **Object Read & Write**
   - 발급되면 **Access Key ID** → `R2_ACCESS_KEY_ID`, **Secret Access Key** → `R2_SECRET_ACCESS_KEY`
   - (Secret은 그때 한 번만 보임 — 꼭 저장)
5. **공개 접근 설정**(둘 중 택1) → `R2_AUDIO_PUBLIC_BASE` 에 사용:
   - (권장) 버킷 → **Settings → Custom Domains** → `audio.crama.app` 연결(크라마 도메인이 Cloudflare에 있으면 클릭 몇 번).
     → `R2_AUDIO_PUBLIC_BASE=https://audio.crama.app`
   - (간단) 버킷 → **Settings → Public access → r2.dev** 허용 → 제공되는 `https://pub-xxxx.r2.dev`
     → `R2_AUDIO_PUBLIC_BASE=https://pub-xxxx.r2.dev`
6. **CORS 허용**(플레이어가 fetch로 타임스탬프 JSON을 읽으므로): 버킷 → **Settings → CORS Policy** 에 추가
   ```json
   [{ "AllowedOrigins": ["https://crama.app"], "AllowedMethods": ["GET"], "AllowedHeaders": ["*"] }]
   ```

---

## 3) .env 작성 (automation/.env)

`.env.example` 을 복사해서 `.env` 로 만들고 아래 값 채우기:

```
AZURE_SPEECH_KEY=<Azure KEY 1>
AZURE_SPEECH_REGION=koreacentral
AZURE_TTS_VOICE=ko-KR-SunHiNeural

R2_ACCOUNT_ID=<R2 계정 ID>
R2_ACCESS_KEY_ID=<R2 Access Key ID>
R2_SECRET_ACCESS_KEY=<R2 Secret>
R2_AUDIO_BUCKET=crama-audio
R2_AUDIO_PUBLIC_BASE=https://audio.crama.app   # 또는 https://pub-xxxx.r2.dev
```

그 다음 의존성 설치:
```
cd automation
npm install
```

---

## 4) 오디오 생성 (글 1편)

```
node gen-audio.js <slug>
# 예: node gen-audio.js lifestyle-inflation-trap
```
하는 일:
1. 본문을 평문/문장 청크로 변환
2. Azure로 MP3 + 청크별 시작 시각(타임스탬프) 생성
3. R2에 `audio/<slug>.mp3` 와 `audio/<slug>.json` 업로드
4. 글 frontmatter 에 `audio: '<공개 URL>'` 자동 기입

이후 `git push` 하면 그 글은 **고품질 음성 + 백그라운드 청취** 로 재생된다.
(audio 필드가 없는 글은 기존 Web Speech 로 자동 폴백 — 무엇도 깨지지 않음)

---

## 다음 작업(코드 측, 키 준비되면 진행)

- 플레이어를 `<audio>` + **Media Session API**(잠금화면 컨트롤/백그라운드) 로 전환
- 타임스탬프 JSON으로 문장 **하이라이트·따라가기** 유지
- audio 없는 글은 Web Speech 폴백 유지

> 먼저 한 편(`gen-audio.js`)으로 실제 MP3/JSON이 나오면, 그 파일로 플레이어를 붙여 테스트한다.
