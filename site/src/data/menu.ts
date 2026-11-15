// 사이트 전체 메뉴 구조 — 상단 탭 → 분야 → 항목.
// 헤더 탭, 전체 메뉴(왼쪽 분야 + 오른쪽 목록), 홈, 분야 페이지(/hub/[slug]/)가 모두 이 파일 하나를 읽는다.
// href 가 있으면 이미 있는 페이지, 없으면 '준비 중'(링크 없이 이름만 노출).
// 새 페이지를 만들면 여기 href 만 채우면 메뉴·홈·분야 페이지에 한꺼번에 반영된다.

export type MenuItem = { name: string; href?: string; desc?: string };
export type MenuGroup = { slug: string; name: string; icon: string; color: string; desc: string; items: MenuItem[] };
export type MenuTab = { slug: string; name: string; href: string; color: string; groups: MenuGroup[] };

export const MENU: MenuTab[] = [
  {
    slug: 'people', name: '인물', href: '/people/', color: '#ec4899',
    groups: [
      {
        slug: 'people', name: '인물', icon: 'user', color: '#ec4899',
        desc: '나이·띠·별자리로 찾아보는 인물 정보',
        items: [
          { name: '인물 찾아보기', href: '/people/', desc: '이름으로 검색하고 나이·생일 확인' },
          { name: '오늘·이달의 생일', href: '/people/#pp-month-sec', desc: '이번 달 생일인 인물' },
          { name: '출생연도별 인물', href: '/people/#by-year', desc: '같은 해에 태어난 인물' },
          { name: '띠별 인물', href: '/people/#by-zodiac', desc: '12띠별 인물과 나이표' },
          { name: '별자리별 인물', href: '/people/#by-star', desc: '12별자리별 인물' },
          { name: '직업별 인물', href: '/people/#by-job', desc: '가수·배우·운동선수' },
          { name: '조회 순위' },
        ],
      },
    ],
  },
  {
    slug: 'games', name: '게임', href: '/hub/games/', color: '#f59e0b',
    groups: [
      {
        slug: 'games', name: '미니게임', icon: 'game', color: '#f59e0b',
        desc: '설치 없이 바로 하는 미니게임',
        items: [
          { name: '오늘의 스도쿠', href: '/games/sudoku/', desc: '매일 바뀌는 퍼즐과 난이도별 새 게임' },
          { name: '지뢰 찾기', href: '/games/mines/', desc: '숫자를 보고 지뢰 피하기' },
          { name: '벽돌깨기', href: '/games/bricks/', desc: '공을 튕겨 벽돌 깨기' },
          { name: '숫자 야구', href: '/games/number-baseball/', desc: '스트라이크·볼로 숫자 맞히기' },
          { name: '상식 퀴즈', href: '/games/quiz/', desc: '10문제로 보는 내 상식 점수' },
        ],
      },
    ],
  },
  {
    slug: 'fun', name: '운세·테스트', href: '/hub/fun/', color: '#8b5cf6',
    groups: [
      {
        slug: 'fun', name: '운세·테스트', icon: 'star', color: '#8b5cf6',
        desc: '오늘의 운세부터 궁합, 성향 테스트까지',
        items: [
          { name: '오늘의 운세', href: '/fortune/', desc: '띠별 운세, 매일 업데이트' },
          { name: '타로 보기', href: '/tarot/', desc: '카드 한 장으로 보는 오늘' },
          { name: '이름 궁합', href: '/name-match/', desc: '커플·친구·동료·가족 궁합' },
          { name: '띠궁합', href: '/zodiac-match/', desc: '두 띠의 전통 궁합' },
          { name: '로또 번호 생성기', href: '/lotto/', desc: '버튼 한 번으로 번호 뽑기' },
          { name: '점심 메뉴 추천', href: '/lunch/', desc: '오늘 뭐 먹지 고민될 때' },
          { name: '머니 캐릭터 테스트', href: '/quiz/money-character/', desc: '10가지 질문으로 보는 내 돈 성향' },
          { name: '투자 성향 진단', href: '/quiz/investor-type/', desc: '나는 어떤 투자자일까' },
        ],
      },
    ],
  },
  {
    slug: 'life', name: '생활 조회', href: '/hub/', color: '#6c5ce7',
    groups: [
      {
        slug: 'health', name: '건강검진·건강', icon: 'heart', color: '#ef4444',
        desc: '올해 건강검진 대상인지, 내 몸 수치는 어떤지',
        items: [
          { name: '건강검진 대상 조회', href: '/health-check/', desc: '출생연도만 누르면 올해 대상인지 확인' },
          { name: '암검진 대상 조회', href: '/health-check/cancer/', desc: '올해 받을 수 있는 국가 암검진 6종' },
          { name: 'BMI 계산기', href: '/health/bmi/', desc: '키·몸무게로 비만도 확인' },
          { name: '기초대사량 계산기', href: '/health/bmr/', desc: '하루 필요 칼로리까지' },
          { name: '체지방률 계산기', href: '/health/body-fat/', desc: '줄자로 재는 체지방률' },
          { name: '물 섭취량 계산기', href: '/health/water/', desc: '몸무게에 맞는 하루 물의 양' },
          { name: '수면시간 계산기', href: '/health/sleep/', desc: '몇 시에 자야 개운할까' },
          { name: '카페인 계산기', href: '/health/caffeine/', desc: '하루 권장량과 몸에 남은 양' },
          { name: '무료 예방접종 대상' }, { name: '술 깨는 시간 계산기' },
        ],
      },
      {
        slug: 'pay', name: '월급·세금', icon: 'wallet', color: '#10b981',
        desc: '실수령액부터 퇴직금, 세금까지',
        items: [
          { name: '연봉 실수령액', href: '/salary/', desc: '연봉별 세후 월급 한눈에' },
          { name: '월급 실수령액', href: '/salary/monthly/', desc: '세전 월급별 세후 금액' },
          { name: '시급 → 월급 환산', href: '/wage/', desc: '주휴수당 포함 월급 계산' },
          { name: '4대보험 계산기', href: '/insurance/', desc: '내 부담과 회사 부담 한 번에' },
          { name: '퇴직금', href: '/severance/', desc: '월급·근속연수별 퇴직금' },
          { name: '실업급여', href: '/unemployment/', desc: '받을 수 있는 금액과 기간' },
          { name: '프리랜서 3.3% 세금', href: '/freelance-tax/', desc: '원천징수 후 받는 금액' },
          { name: '부가세 계산기', href: '/tools/vat-calculator/', desc: '공급가액·부가세 바로 계산' },
          { name: '증여세', href: '/gift-tax/', desc: '공제 한도와 예상 세액' },
          { name: '상속세', href: '/inheritance-tax/', desc: '상속 재산별 예상 세액' },
          { name: '재산세', href: '/property-tax/', desc: '공시가격으로 보는 재산세' },
          { name: '군인 월급' },
          { name: '세금 캘린더', href: '/tax/', desc: '올해 내야 할 세금 일정' },
        ],
      },
      {
        slug: 'date', name: '나이·날짜', icon: 'calendar', color: '#3b82f6',
        desc: '만 나이, 띠, D-day, 공휴일',
        items: [
          { name: '만 나이 계산기', href: '/age/', desc: '생년월일로 오늘 기준 나이 계산' },
          { name: '출생연도별 나이표', href: '/born/', desc: '연도별 만 나이·띠·학번 한 표로' },
          { name: '띠별 나이표', href: '/people/zodiac/rat/', desc: '12띠의 출생연도와 나이' },
          { name: 'D-day 계산기', href: '/dday/', desc: '남은 날·기념일 계산' },
          { name: '영업일 계산기' }, { name: '음력·양력 변환' },
          { name: '전역일 계산기', href: '/discharge/', desc: '입대일로 전역일·D-day 계산' },
          { name: '공휴일·황금연휴' },
        ],
      },
      {
        slug: 'support', name: '지원금·정책', icon: 'gift', color: '#f97316',
        desc: '내가 받을 수 있는 지원금과 복지',
        items: [
          { name: '내 혜택 찾기', href: '/benefits/', desc: '조건만 넣으면 받을 수 있는 혜택 매칭' },
          { name: '복지 서비스', href: '/welfare/', desc: '중앙·지자체 복지 5,000여 건' },
          { name: '청년 정책', href: '/youth/', desc: '일자리·주거·교육 청년 정책 500여 건' },
          { name: '정책 캘린더', href: '/policy-calendar/', desc: '놓치면 손해인 신청·마감일' },
          { name: '중위소득 계산', href: '/median-income/', desc: '우리 집은 중위소득 몇 %' },
          { name: '이벤트별 지원금', href: '/life/', desc: '결혼·출산·이사 등 상황별 지원' },
          { name: '청년 적금 계산기' },
        ],
      },
      {
        slug: 'bank', name: '예금·대출', icon: 'bank', color: '#0ea5e9',
        desc: '금리 비교와 이자 계산',
        items: [
          { name: '예·적금 금리 비교', href: '/rates/', desc: '오늘의 최고금리 한눈에' },
          { name: '대출 금리 비교', href: '/loans/', desc: '은행별 대출 금리' },
          { name: '예금 이자 계산', href: '/interest/', desc: '금액별 세후 이자' },
          { name: '적금 계산기', href: '/tools/savings-calculator/', desc: '만기 수령액 계산' },
          { name: '대출 이자 계산', href: '/tools/loan-calculator/', desc: '월 상환액과 총 이자' },
          { name: 'DSR 계산기', href: '/tools/dsr-calculator/', desc: '내 대출 한도 가늠' },
          { name: '금리 결정 캘린더', href: '/rate-calendar/', desc: '금통위·FOMC 일정' },
          { name: '국민연금 예상 수령액' }, { name: '카드 할부 계산기' },
        ],
      },
      {
        slug: 'invest', name: '투자', icon: 'chart', color: '#14b8a6',
        desc: '복리·배당·수익률 계산',
        items: [
          { name: '복리 계산기', href: '/tools/compound-calculator/' },
          { name: '배당 계산기', href: '/tools/dividend-calculator/' },
          { name: '평단가 계산기', href: '/tools/average-price-calculator/' },
          { name: '주식 수익률', href: '/tools/stock-return-calculator/' },
          { name: '해외주식 세금', href: '/tools/overseas-stock-tax-calculator/' },
          { name: '72의 법칙', href: '/tools/rule-of-72-calculator/' },
          { name: 'FIRE 계산기', href: '/tools/fire-calculator/' },
          { name: '은퇴 자금', href: '/tools/retirement-calculator/' },
          { name: '목표 금액', href: '/tools/goal-calculator/' },
          { name: '물가 계산기', href: '/tools/inflation-calculator/' },
          { name: '환율 계산기', href: '/tools/exchange-calculator/' },
          { name: '비상금 계산기', href: '/tools/emergency-fund-calculator/' },
        ],
      },
      {
        slug: 'home-car', name: '집·자동차', icon: 'home', color: '#a855f7',
        desc: '전월세, 취득세, 자동차세',
        items: [
          { name: '전월세 전환', href: '/tools/jeonse-wolse-calculator/' },
          { name: '평수 변환', href: '/tools/pyeong-converter/' },
          { name: 'LTV 계산기', href: '/tools/ltv-calculator/' },
          { name: '중개수수료 계산기' }, { name: '취득세 계산기' }, { name: '청약 가점 계산기' },
          { name: '자동차세', href: '/car-tax/', desc: '배기량·연식으로 자동차세 계산' },
          { name: '자동차 할부 계산기' }, { name: '신차 등록비용' },
        ],
      },
      {
        slug: 'convert', name: '이름·변환', icon: 'text', color: '#64748b',
        desc: '영문 이름, 단위, 사이즈 변환',
        items: [{ name: '영문 이름 변환' }, { name: '영문 주소 변환' }, { name: '닉네임 생성기' }, { name: '신발 사이즈 변환' }, { name: '단위 변환' }, { name: '글자 수 세기' }],
      },
      {
        slug: 'tables', name: '한눈에 보기', icon: 'grid', color: '#eab308',
        desc: '표로 정리한 생활 정보',
        items: [
          { name: '연봉별 실수령액 표', href: '/salary/' },
          { name: '연도별 최저임금' }, { name: '대한민국 인구 통계' }, { name: '띠 총정리', href: '/people/zodiac/rat/' }, { name: '별자리 총정리', href: '/people/star/aries/' },
          { name: '용어 사전', href: '/glossary/', desc: '금융·AI 용어를 쉽게' },
        ],
      },
    ],
  },
  {
    slug: 'guide', name: '가이드', href: '/hub/guide/', color: '#10b981',
    groups: [
      {
        slug: 'guide', name: '가이드', icon: 'book', color: '#10b981',
        desc: '직접 해보고 정리한 글',
        items: [
          { name: 'Today 브리핑', href: '/briefing/', desc: '오늘 챙길 것만 3분에' },
          { name: '주식·재테크', href: '/category/money/' },
          { name: 'AI 트렌드', href: '/category/ai/' },
          { name: '부업·지원금', href: '/category/income/' },
          { name: '완벽 가이드 모음', href: '/guides/' },
          { name: '칼럼', href: '/column/' },
          { name: '쇼츠', href: '/shorts/' },
          { name: 'AI·자동화 따라 하기' }, { name: '마케팅·측정 따라 하기' }, { name: '수익화 후기' },
        ],
      },
    ],
  },
];

export const allGroups = (): (MenuGroup & { tab: MenuTab })[] => MENU.flatMap((t) => t.groups.map((g) => ({ ...g, tab: t })));
// 분야 대표 주소 — 인물은 전용 목록 페이지가 있다
export const groupHref = (g: { slug: string }) => (g.slug === 'people' ? '/people/' : `/hub/${g.slug}/`);
export const readyCount = (g: MenuGroup) => g.items.filter((i) => i.href).length;
export const tabReady = (t: MenuTab) => t.groups.reduce((n, g) => n + readyCount(g), 0);
// 상단 탭에는 실제로 들어갈 페이지가 하나라도 있는 것만 노출(빈 탭 방지)
export const visibleTabs = () => MENU.filter((t) => tabReady(t) > 0);

// 선 아이콘(24x24, stroke) — 메뉴·홈·분야 페이지 공용
export const ICONS: Record<string, string> = {
  user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".9"/><circle cx="18" cy="13.8" r=".9"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
  heart: '<path d="M12 20.5l-7.3-7.3a4.9 4.9 0 0 1 6.9-6.9l.4.4.4-.4a4.9 4.9 0 0 1 6.9 6.9z"/><path d="M7 12.5h2.4l1.4-2.4 2 4.4 1.3-2h2.4"/>',
  wallet: '<rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18M16 14.5h1.6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  gift: '<rect x="4" y="10" width="16" height="10.5" rx="1.5"/><path d="M3 7h18v3H3zM12 7v13.5M12 7c-1.5-3.8-6-3.4-5 0M12 7c1.5-3.8 6-3.4 5 0"/>',
  bank: '<path d="M3.5 9.5L12 4l8.5 5.5M5 9.5h14M6.5 10v7M10.2 10v7M13.8 10v7M17.5 10v7M4 20h16M5 17h14"/>',
  chart: '<path d="M4 19.5h16M6.5 16v-4M11 16V8.5M15.5 16v-6M4.5 9l4.5-3.5 4 2.5 6-4.5"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M5.5 9.8V20h13V9.8M10 20v-5.5h4V20"/>',
  text: '<path d="M4 18l4.5-12h1L14 18M5.6 14h6.8M16 9.5h5M18.5 9.5v8.5"/>',
  grid: '<rect x="4" y="4" width="6.8" height="6.8" rx="1.4"/><rect x="13.2" y="4" width="6.8" height="6.8" rx="1.4"/><rect x="4" y="13.2" width="6.8" height="6.8" rx="1.4"/><rect x="13.2" y="13.2" width="6.8" height="6.8" rx="1.4"/>',
  book: '<path d="M12 6.5c-2-1.6-5-1.9-8-1.2v13c3-.7 6-.4 8 1.2 2-1.6 5-1.9 8-1.2v-13c-3-.7-6-.4-8 1.2zM12 6.5v13"/>',
  fire: '<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-2.6 1.6-4.4 3-6 .4 1.5 1.2 2.3 2 2.7C10 8 11 5 13.5 3c.2 3 4.9 5.4 4.9 11.3 0 4-2.5 6.700-6.4 6.700z"/>',
};
