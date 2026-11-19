// 임신·육아 서비스(/mom/) 공용 규칙. 나중에 별도 브랜드로 떼어낼 수 있게 이 파일과 data/mom-weeks.ts, styles/mom.css,
// pages/mom/ 만으로 동작하도록 둔다(사이트 공용 레이아웃 BaseLayout만 빌려 쓴다).
// 기준: 출산예정일 = 마지막 생리 시작일 + 280일(네겔레 법칙). 검사 시기는 일반적인 산전관리 일정이며 병원마다 다를 수 있다.
// 지원금은 2026년 기준(복지로·보건복지부 안내). 해마다 1월에 확인할 것.

export const MOM_BRAND = '크라마 맘';
export const MOM_YEAR = 2026;
export const WEEK_FROM = 4;
export const WEEK_TO = 40;

/** 한국식 임신 개월: 4주를 한 달로 센다(0~3주 = 1개월, 36주~ = 10개월) */
export const monthOfWeek = (w: number) => Math.min(10, Math.floor(w / 4) + 1);
export const trimesterOf = (w: number) => (w < 14 ? { key: 1, name: '임신 초기' } : w < 28 ? { key: 2, name: '임신 중기' } : { key: 3, name: '임신 후기' });

/** 주차별 검사·할 일. from~to 주에 걸쳐 보여 준다. kind: check(병원 검사), admin(신청·제도), prep(준비) */
export type Task = { from: number; to: number; kind: 'check' | 'admin' | 'prep'; title: string; desc: string };
export const TASKS: Task[] = [
  { from: 4, to: 6, kind: 'check', title: '임신 확인', desc: '임신 테스트기 두 줄이 보이면 산부인과에서 혈액검사나 초음파로 확인해요.' },
  { from: 5, to: 8, kind: 'check', title: '첫 초음파', desc: '아기집과 심장박동을 확인해요. 6~7주쯤이면 심장 뛰는 모습이 보이는 경우가 많아요.' },
  { from: 5, to: 12, kind: 'admin', title: '국민행복카드 신청 (임신·출산 진료비)', desc: '병원에서 임신확인서를 받아 카드사·은행이나 국민건강보험공단에 신청해요. 단태아 100만 원을 진료비·약값에 쓸 수 있어요.' },
  { from: 5, to: 12, kind: 'admin', title: '보건소 임산부 등록', desc: '주소지 보건소에 등록하면 엽산제·철분제, 산전검사 지원을 받을 수 있어요(보건소마다 지원 범위가 달라요).' },
  { from: 5, to: 12, kind: 'admin', title: '임신기 근로시간 단축 (12주 이내)', desc: '임신 12주 이내에는 하루 2시간 근로시간 단축을 신청할 수 있어요. 임금은 줄지 않아요.' },
  { from: 8, to: 12, kind: 'check', title: '초기 산전 혈액검사', desc: '혈액형, 빈혈, 풍진 항체, B형간염, 매독, 소변검사 등을 한 번에 받아요.' },
  { from: 11, to: 13, kind: 'check', title: '1차 기형아 선별검사', desc: '초음파로 목덜미 투명대 두께를 재고 혈액검사를 함께 해요. 시기가 짧아 미리 예약해 두세요.' },
  { from: 15, to: 20, kind: 'check', title: '2차 기형아 선별검사', desc: '쿼드 검사(혈액). 결과에 따라 정밀검사를 권유받을 수 있어요.' },
  { from: 16, to: 40, kind: 'prep', title: '철분제 챙기기', desc: '중기부터 철분 필요량이 늘어요. 보건소에서 철분제를 받을 수 있는지 확인하세요.' },
  { from: 20, to: 24, kind: 'check', title: '정밀 초음파', desc: '아기 몸 구조를 자세히 보는 초음파예요. 시간이 오래 걸려 예약이 필요해요.' },
  { from: 20, to: 28, kind: 'prep', title: '산후조리원·출산 병원 정하기', desc: '인기 있는 조리원은 일찍 마감돼요. 지자체 산후조리 지원금도 함께 찾아보세요.' },
  { from: 24, to: 28, kind: 'check', title: '임신성 당뇨 검사', desc: '당 시럽을 마시고 1시간 뒤 혈당을 재요. 기준을 넘으면 정밀 검사를 한 번 더 해요.' },
  { from: 27, to: 36, kind: 'check', title: '백일해(Tdap) 예방접종', desc: '질병관리청은 임신할 때마다 27~36주에 접종하도록 권장해요. 엄마 항체가 아기에게 전해져요.' },
  { from: 28, to: 36, kind: 'check', title: '2주마다 정기 진찰', desc: '후기부터는 진료 간격이 짧아져요. 혈압, 부종, 태아 성장을 확인해요.' },
  { from: 28, to: 34, kind: 'prep', title: '출산 준비물·출산가방', desc: '배냇저고리, 속싸개, 기저귀, 산모패드부터 챙기고 34주 전후로 출산가방을 싸 두세요.' },
  { from: 32, to: 40, kind: 'admin', title: '임신기 근로시간 단축 (32주 이후)', desc: '32주 이후에도 근로시간 단축을 다시 쓸 수 있어요.' },
  { from: 32, to: 36, kind: 'admin', title: '출산전후휴가 계획', desc: '출산 전후 합쳐 90일(다태아 120일)이고, 출산 뒤에 45일(다태아 60일) 이상이 남도록 시작일을 정해요.' },
  { from: 36, to: 40, kind: 'check', title: '매주 진찰·태동 검사', desc: '36주부터는 매주 진찰을 받고 태동 검사(NST)를 하는 경우가 많아요.' },
  { from: 37, to: 40, kind: 'prep', title: '진통 신호 알아 두기', desc: '규칙적인 진통, 양수가 새는 느낌, 출혈, 태동 감소가 있으면 바로 병원에 연락하세요.' },
  { from: 40, to: 40, kind: 'check', title: '출산예정일', desc: '예정일에 태어나는 아기는 많지 않아요. 41주가 넘으면 유도분만을 상담해요.' },
];
export const tasksOf = (w: number) => TASKS.filter((t) => w >= t.from && w <= t.to);

/** 출생 후 기념일 — 태어난 날을 1일로 센다(100일 = 출생일 + 99일) */
export const BABY_DAYS = [
  { key: 'd50', name: '50일', add: 49 },
  { key: 'd100', name: '100일 (백일)', add: 99 },
  { key: 'd200', name: '200일', add: 199 },
  { key: 'd300', name: '300일', add: 299 },
  { key: 'y1', name: '돌 (첫 생일)', addYear: 1 },
  { key: 'd1000', name: '1000일', add: 999 },
];

/** 국가예방접종(표준예방접종일정표 기준, 개월 단위). 접종 전 질병관리청 예방접종도우미(nip.kdca.go.kr)에서 다시 확인 */
export const VACCINES = [
  { name: 'B형간염 1차', m: 0, note: '출생 직후' },
  { name: 'BCG(결핵)', m: 0, note: '생후 4주 이내' },
  { name: 'B형간염 2차', m: 1, note: '' },
  { name: 'DTaP·IPV·Hib·폐렴구균·로타 1차', m: 2, note: '' },
  { name: 'DTaP·IPV·Hib·폐렴구균·로타 2차', m: 4, note: '' },
  { name: 'B형간염 3차, DTaP·Hib·폐렴구균 3차', m: 6, note: 'IPV 3차는 6~18개월, 로타는 백신 종류에 따라 3차' },
  { name: '인플루엔자', m: 6, note: '6개월 이상, 매년 가을' },
  { name: 'MMR·수두 1차, Hib·폐렴구균 4차', m: 12, note: '12~15개월' },
  { name: 'A형간염 1차, 일본뇌염 1·2차', m: 12, note: '12~23개월' },
  { name: 'DTaP 4차', m: 15, note: '15~18개월' },
  { name: 'A형간염 2차', m: 18, note: '1차 6개월 뒤' },
  { name: '일본뇌염 3차', m: 24, note: '2차 12개월 뒤' },
  { name: 'DTaP 5차·IPV 4차·MMR 2차', m: 48, note: '만 4~6세' },
];

/** 영유아건강검진 차수(개월 단위 기간). 1차만 일 단위(생후 14~35일) */
export const INFANT_CHECKS = [
  { name: '1차', fromD: 14, toD: 35 },
  { name: '2차', fromM: 4, toM: 6 },
  { name: '3차', fromM: 9, toM: 12 },
  { name: '4차 + 구강 1차', fromM: 18, toM: 24 },
  { name: '5차', fromM: 30, toM: 36 },
  { name: '6차 + 구강', fromM: 42, toM: 48 },
  { name: '7차 + 구강', fromM: 54, toM: 60 },
  { name: '8차', fromM: 66, toM: 71 },
];

/** 출산 지원금(2026년 기준). 금액·기간은 해마다 바뀔 수 있다 */
export const SUPPORTS = [
  { when: '임신 중', name: '임신·출산 진료비 (국민행복카드)', amount: '단태아 100만 원', desc: '진료비·약값에 쓰는 바우처. 분만취약지 거주자는 20만 원 추가. 다태아는 금액이 달라 공단에 확인하세요.' },
  { when: '출산 후', name: '첫만남이용권', amount: '첫째 200만 원 · 둘째부터 300만 원', desc: '국민행복카드 포인트로 받아 출생일부터 2년 안에 써요.' },
  { when: '0~11개월', name: '부모급여', amount: '월 100만 원', desc: '어린이집을 다니면 보육료를 빼고 남는 금액을 현금으로 받아요.' },
  { when: '12~23개월', name: '부모급여', amount: '월 50만 원', desc: '' },
  { when: '만 9세 미만', name: '아동수당', amount: '월 10만 원', desc: '2026년부터 8세 미만에서 9세 미만으로 늘었어요. 부모급여와 함께 받아요.' },
];
export const SUPPORT_NOTE = '첫만남이용권·부모급여·아동수당은 출생신고 때 함께 신청할 수 있고, 출생일 포함 60일 안에 신청하면 태어난 달부터 받아요.';
