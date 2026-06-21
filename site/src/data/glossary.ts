// 용어 사전 데이터 — /glossary 페이지와 본문 용어 툴팁(GlossaryTooltips)이 공유한다.
export type Term = { term: string; def: string; href?: string; hrefLabel?: string };

export const money: Term[] = [
  { term: 'ETF (상장지수펀드)', def: '여러 종목을 묶은 펀드를 주식처럼 사고팔 수 있게 만든 상품. 한 주만 사도 분산투자 효과가 있다.', href: '/blog/money-etf-vs-fund/', hrefLabel: 'ETF vs 펀드' },
  { term: '배당', def: '기업이 번 이익의 일부를 주주에게 나눠 주는 것. 주기적으로 현금 흐름을 만들 수 있다.', href: '/blog/money-dividend-basics/', hrefLabel: '배당 투자 기초' },
  { term: 'PER (주가수익비율)', def: '주가를 주당순이익으로 나눈 값. 이익 대비 주가가 비싼지 싼지를 가늠하는 지표다.' },
  { term: 'PBR (주가순자산비율)', def: '주가를 주당순자산으로 나눈 값. 1보다 낮으면 자산 대비 주가가 낮다는 의미로 해석된다.' },
  { term: 'ROE (자기자본이익률)', def: '기업이 자기자본으로 얼마나 이익을 냈는지 보여 주는 수익성 지표.' },
  { term: '시가총액', def: '주가 × 발행 주식 수. 그 기업의 시장 전체 가치를 나타낸다.' },
  { term: '코스피 / 코스닥', def: '코스피는 국내 대표 우량 기업, 코스닥은 주로 중소·벤처·기술 기업이 상장된 시장이다.', href: '/blog/domestic-stock-beginners-guide/', hrefLabel: '국내주식 입문' },
  { term: '나스닥 / S&P500', def: '나스닥은 미국 기술주 중심 시장, S&P500은 미국 대표 500개 기업을 묶은 지수다.', href: '/blog/money-sp500-etf-guide/', hrefLabel: 'S&P500 ETF' },
  { term: '가치주 / 성장주', def: '가치주는 실제 가치보다 싸게 거래되는 주식, 성장주는 빠른 성장을 기대하는 주식이다.', href: '/blog/value-vs-growth-investing/', hrefLabel: '가치 vs 성장' },
  { term: '분산투자', def: '한 자산에 몰지 않고 여러 자산에 나눠 담아 위험을 줄이는 투자 원칙.', href: '/blog/investment-portfolio-basics/', hrefLabel: '포트폴리오 기초' },
  { term: '적립식 투자', def: '매달 같은 금액을 꾸준히 나눠 사 모으는 방식. 비쌀 땐 적게, 쌀 땐 많이 사게 되어 타이밍 부담을 줄인다.', href: '/blog/first-year-investing-story/', hrefLabel: '1년 투자 이야기' },
  { term: '포트폴리오', def: '내가 보유한 자산들의 조합. 주식·채권·현금 등의 비중을 어떻게 구성하느냐가 핵심이다.', href: '/blog/investment-portfolio-basics/', hrefLabel: '포트폴리오 기초' },
  { term: '리밸런싱', def: '시간이 지나 틀어진 자산 비중을 원래 목표 비중으로 다시 맞추는 것.' },
  { term: '복리 / 단리', def: '단리는 원금에만, 복리는 원금+이자에 다시 이자가 붙는 방식. 장기로 갈수록 복리의 힘이 커진다.', href: '/blog/compound-interest-power/', hrefLabel: '복리의 힘' },
  { term: '인플레이션', def: '물가가 전반적으로 오르는 현상. 같은 돈으로 살 수 있는 양이 줄어 현금의 가치가 깎인다.', href: '/blog/inflation-investing-guide/', hrefLabel: '인플레이션과 투자' },
  { term: '금리', def: '돈을 빌리거나 맡길 때의 값. 오르면 예금·대출 이자가 오르고 위험자산엔 부담이 된다.', href: '/blog/interest-rate-exchange-basics/', hrefLabel: '금리·환율의 영향' },
  { term: '환율', def: '원화와 외국 돈(주로 달러)의 교환 비율. 오르면 해외 자산의 원화 환산 가치가 커진다.', href: '/blog/dollar-investment-guide/', hrefLabel: '달러 투자' },
  { term: '채권', def: '정부나 기업이 돈을 빌리며 발행하는 증서. 정해진 이자를 받는 비교적 안전한 자산이다.', href: '/blog/bond-investment-basics/', hrefLabel: '채권 투자 기초' },
  { term: 'REITs (리츠)', def: '여러 투자자의 돈을 모아 부동산에 투자하고 임대수익 등을 나눠 주는 상품.', href: '/blog/reits-investment-guide/', hrefLabel: '리츠 투자' },
  { term: '공모주 (IPO)', def: '기업이 처음 주식시장에 상장하며 일반 투자자에게 주식을 파는 것. 청약으로 참여한다.', href: '/blog/ipo-public-offering-guide/', hrefLabel: '공모주 청약' },
  { term: '평단가', def: '내가 보유한 주식의 평균 매수 단가. 추가 매수하면 평단가가 바뀐다.', href: '/tools/average-price-calculator/', hrefLabel: '평단가 계산기' },
  { term: '손절 / 익절', def: '손실을 확정하고 파는 것이 손절, 수익을 확정하고 파는 것이 익절이다.', href: '/blog/investor-psychology-guide/', hrefLabel: '투자 심리' },
  { term: '변동성', def: '가격이 출렁이는 정도. 변동성이 크면 기대수익도, 위험도 함께 커진다.' },
  { term: 'ISA (개인종합자산관리계좌)', def: '여러 금융상품을 한 계좌에서 운용하며 세제 혜택을 받는 절세 계좌.', href: '/blog/isa-account-guide-2026/', hrefLabel: 'ISA 계좌' },
  { term: '연금저축 / IRP', def: '노후 대비 + 세액공제 혜택이 있는 대표 연금 계좌. 납입액에 따라 세금을 돌려받는다.', href: '/tools/pension-tax-calculator/', hrefLabel: '연금 세액공제 계산기' },
  { term: '소득공제 / 세액공제', def: '소득공제는 세금을 매기는 소득을, 세액공제는 세금 자체를 줄여 준다.', href: '/blog/year-end-tax-settlement/', hrefLabel: '연말정산' },
  { term: 'DSR (총부채원리금상환비율)', def: '소득 대비 1년에 갚아야 할 원리금 비율. 대출 규제의 기준이 된다.', href: '/blog/loan-basics-guide/', hrefLabel: '대출 기초' },
  { term: '파킹통장', def: '수시 입출금이 가능하면서 비교적 높은 이자를 주는 통장. 비상금 보관에 적합하다.', href: '/blog/savings-account-comparison/', hrefLabel: '예·적금 비교' },
  { term: '비트코인 / 가상자산', def: '블록체인 기반의 디지털 자산. 변동성이 매우 커 신중한 접근이 필요하다.', href: '/blog/bitcoin-investment-basics/', hrefLabel: '비트코인 기초' },
];

export const ai: Term[] = [
  { term: 'LLM (거대 언어 모델)', def: '방대한 텍스트로 학습해 사람처럼 글을 이해하고 생성하는 AI 모델. ChatGPT, Claude 등이 해당된다.' },
  { term: '생성형 AI', def: '글·이미지·음성·영상 등 새로운 콘텐츠를 만들어 내는 AI를 통칭하는 말.', href: '/blog/ai-trends-2026/', hrefLabel: '2026 AI 트렌드' },
  { term: '프롬프트', def: 'AI에게 주는 지시나 질문. 잘 쓸수록 좋은 결과가 나온다.', href: '/blog/ai-prompt-basics/', hrefLabel: '프롬프트 작성법' },
  { term: '환각 (할루시네이션)', def: 'AI가 사실이 아닌 내용을 그럴듯하게 지어내는 현상. 그래서 검증이 필요하다.', href: '/blog/ai-copyright-ethics/', hrefLabel: 'AI 윤리' },
  { term: '토큰', def: 'AI가 텍스트를 처리하는 기본 단위. 단어나 글자 조각에 해당하며, 사용량·비용의 기준이 된다.' },
  { term: '멀티모달', def: '텍스트뿐 아니라 이미지·음성·영상을 함께 이해하고 다루는 AI의 능력.', href: '/blog/ai-trends-2026/', hrefLabel: '2026 AI 트렌드' },
  { term: 'AI 에이전트', def: '스스로 도구를 쓰고 여러 단계를 실행해 작업을 완수하는 AI.', href: '/blog/ai-agent-workflow/', hrefLabel: 'AI 에이전트' },
  { term: '머신러닝 / 딥러닝', def: '데이터로 스스로 규칙을 학습하는 기술이 머신러닝, 그중 인공신경망을 깊게 쌓은 방식이 딥러닝이다.' },
  { term: '파인튜닝', def: '이미 학습된 모델을 특정 목적·데이터에 맞게 추가로 학습시켜 다듬는 것.' },
  { term: 'RAG (검색 증강 생성)', def: 'AI가 외부 자료를 검색해 그 내용을 바탕으로 답하게 하는 기법. 최신성·정확성을 높인다.' },
  { term: '컨텍스트 윈도우', def: 'AI가 한 번에 기억하고 처리할 수 있는 텍스트의 양. 클수록 긴 문서를 다룰 수 있다.' },
  { term: '파라미터', def: '모델이 학습으로 조정하는 내부 값. 보통 많을수록 표현력이 크다고 본다.' },
  { term: '추론 (인퍼런스)', def: '학습된 AI가 실제로 입력을 받아 답을 만들어 내는 과정.' },
  { term: 'API', def: '프로그램끼리 기능을 주고받는 통로. AI를 내 앱·서비스에 연결할 때 사용한다.' },
  { term: '챗봇', def: '대화 형태로 응답하는 AI. 목적에 맞게 맞춤형으로 만들 수도 있다.', href: '/blog/custom-ai-chatbot-guide/', hrefLabel: '나만의 챗봇 만들기' },
  { term: 'TTS (음성 합성)', def: '글을 자연스러운 음성으로 바꿔 주는 기술. 영상·오디오 제작에 쓰인다.', href: '/blog/ai-youtube-content/', hrefLabel: 'AI 유튜브 제작' },
  { term: '딥페이크 / 딥보이스', def: 'AI로 얼굴·목소리를 진짜처럼 흉내 내는 기술. 사기에 악용되기도 해 주의가 필요하다.', href: '/blog/ai-scam-deepfake-safety/', hrefLabel: 'AI 사기 주의보' },
  { term: '온디바이스 AI', def: '클라우드가 아니라 스마트폰·PC 기기 안에서 직접 돌아가는 AI. 더 빠르고 사적이다.' },
  { term: '오픈소스 모델', def: '누구나 받아 쓰고 수정할 수 있도록 공개된 AI 모델.' },
  { term: '프롬프트 엔지니어링', def: '원하는 결과를 얻기 위해 지시문을 설계·개선하는 기술.', href: '/blog/ai-prompt-basics/', hrefLabel: '프롬프트 작성법' },
];

export const glossarySections = [
  { id: 'money', title: '주식·재테크 용어', terms: money },
  { id: 'ai', title: 'AI 용어', terms: ai },
];

// 본문 툴팁용 평탄화 목록(짧은 풀이 1줄 + 관련 글)
export const allTerms: Term[] = [...money, ...ai];
