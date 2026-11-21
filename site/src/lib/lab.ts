// 건강검진 결과 수치 판정 — 원본: 보건복지부 「건강검진 실시기준」 [별표 4의 별첨] 검사항목별 판정기준.
// 판정은 정상A(정상) · 정상B(경계) · 질환의심 세 단계. 진단이 아니라 결과지 읽는 법을 돕는 용도.
// 기준이 바뀌면 이 파일의 bands만 고치면 계산기·항목 페이지·수치 페이지가 함께 바뀐다.

export type Sex = 'm' | 'f';
export type Level = 'A' | 'B' | 'D' | 'X'; // X: 기준표에 판정이 없는 범위(예: 혈색소가 정상 상한보다 높음)
export type Band = { level: Level; label: string; range: string };
export type LabItem = {
  slug: string; name: string; short: string; alias: string[]; unit: string; group: string;
  sexBased: boolean; step: number;
  /** 판정 함수 */
  judge: (v: number, sex: Sex) => Level;
  /** 기준표(성별) */
  table: (sex: Sex) => Band[];
  /** 게이지 그리기용 범위와 경계값 */
  gauge: (sex: Sex) => { min: number; max: number; cuts: number[]; reverse?: boolean };
  what: string;      // 무엇을 보는 검사인가
  high: string[];    // 수치가 나쁘게 나오는 흔한 이유
  tips: string[];    // 생활에서 할 수 있는 것
  next: Record<'A' | 'B' | 'D', string>; // 판정별로 할 일
  values: number[];  // 수치별 페이지를 만들 값
  higherIsBetter?: boolean;
};

export const LEVEL_NAME: Record<Level, string> = { A: '정상', B: '경계(정상B)', D: '질환의심', X: '기준표 밖' };
export const LEVEL_SHORT: Record<Level, string> = { A: '정상A', B: '정상B', D: '질환의심', X: '참고' };

const between = (v: number, a: number, b: number) => v >= a && v <= b;

export const LAB: LabItem[] = [
  {
    slug: 'fasting-glucose', name: '공복혈당', short: '공복혈당', alias: ['혈당', '공복 혈당', 'FBS'], unit: 'mg/dL', group: '당뇨병', sexBased: false, step: 1,
    judge: (v) => (v < 100 ? 'A' : v <= 125 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '100 미만' }, { level: 'B', label: '공복혈당장애(경계)', range: '100~125' }, { level: 'D', label: '당뇨병 의심', range: '126 이상' }],
    gauge: () => ({ min: 70, max: 160, cuts: [100, 126] }),
    what: '8시간 넘게 아무것도 먹지 않은 상태에서 잰 혈액 속 포도당 농도예요. 당뇨병과 그 전 단계를 가려내는 가장 기본 검사예요.',
    high: ['검사 전 금식을 제대로 하지 않았거나 단 음료를 마신 경우', '복부비만, 운동 부족', '가족 중 당뇨병이 있는 경우', '스트레스·수면 부족, 스테로이드 같은 약'],
    tips: ['흰쌀·빵·면처럼 정제된 탄수화물과 단 음료를 줄인다', '식사 뒤 10~20분 걷기만으로도 혈당이 덜 오른다', '체중의 5~7%를 줄이면 당뇨병으로 넘어갈 위험이 크게 줄어든다는 연구가 많다', '늦은 밤 야식을 줄인다'],
    next: { A: '지금처럼 관리하고 다음 검진에서 다시 확인하면 돼요.', B: '당뇨병 전 단계일 수 있어요. 식습관·운동을 바꾸고 1년 안에 다시 재 보세요. 당화혈색소(HbA1c) 검사를 함께 받아 보면 최근 2~3달 평균을 알 수 있어요.', D: '한 번의 결과만으로 당뇨병을 확정하지는 않아요. 결과지에 안내된 기한 안에 병·의원에서 공단의 확진검사(진찰과 혈당검사)를 본인부담 없이 받을 수 있으니 꼭 받아 보세요.' },
    values: [90, 95, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 112, 115, 118, 120, 122, 125, 126, 128, 130, 135, 140, 150],
  },
  {
    slug: 'blood-pressure', name: '혈압(수축기)', short: '혈압', alias: ['수축기 혈압', '최고혈압', '혈압 140'], unit: 'mmHg', group: '고혈압', sexBased: false, step: 1,
    judge: (v) => (v < 120 ? 'A' : v <= 139 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '수축기 120 미만이면서 이완기 80 미만' }, { level: 'B', label: '고혈압 전단계(경계)', range: '수축기 120~139 또는 이완기 80~89' }, { level: 'D', label: '고혈압 의심', range: '수축기 140 이상 또는 이완기 90 이상' }],
    gauge: () => ({ min: 90, max: 170, cuts: [120, 140] }),
    what: '심장이 피를 내보낼 때 혈관에 걸리는 압력이에요. 수축기(높은 숫자)와 이완기(낮은 숫자) 중 하나라도 기준을 넘으면 그 단계로 봐요. 이 페이지는 수축기 기준으로 정리했어요.',
    high: ['검진 날 긴장하거나 서둘러 와서 잰 경우(진료실 고혈압)', '짠 음식, 음주, 흡연', '체중 증가와 운동 부족', '수면무호흡, 일부 약(진통소염제 등)'],
    tips: ['아침·저녁 집에서 앉아 5분 쉰 뒤 재서 기록해 본다', '국물·젓갈·가공식품의 소금을 줄인다', '체중을 줄이고 빠르게 걷기 같은 유산소 운동을 꾸준히 한다', '술은 줄이고 담배는 끊는다'],
    next: { A: '정상이에요. 1년에 한두 번은 재 보세요.', B: '고혈압 전단계예요. 집에서 며칠 재 본 평균이 계속 높으면 생활을 바꾸고 다음 검진에서 다시 확인하세요.', D: '고혈압 의심이에요. 결과지에 안내된 기한 안에 병·의원에서 공단의 확진검사(진찰)를 본인부담 없이 받을 수 있어요. 집에서 잰 혈압 기록을 가져가면 좋아요.' },
    values: [115, 118, 120, 122, 125, 128, 130, 132, 135, 138, 140, 142, 145, 150, 155, 160],
  },
  {
    slug: 'ldl', name: 'LDL 콜레스테롤', short: 'LDL', alias: ['저밀도 콜레스테롤', '나쁜 콜레스테롤', 'LDL-C'], unit: 'mg/dL', group: '이상지질혈증', sexBased: false, step: 1,
    judge: (v) => (v < 130 ? 'A' : v <= 159 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '130 미만' }, { level: 'B', label: '경계', range: '130~159' }, { level: 'D', label: '이상지질혈증 의심', range: '160 이상' }],
    gauge: () => ({ min: 70, max: 220, cuts: [130, 160] }),
    what: '혈관 벽에 쌓여 동맥경화를 일으키는 쪽이라 흔히 "나쁜 콜레스테롤"이라 불러요. 판정기준표에는 당뇨병이 있으면 100 미만을 목표로 한다는 단서가 붙어 있어요.',
    high: ['포화지방(기름진 고기, 버터, 튀김)과 트랜스지방이 많은 식사', '유전(가족성 고콜레스테롤혈증)', '체중 증가, 운동 부족', '갑상선 기능 저하 같은 다른 질환'],
    tips: ['기름진 고기·튀김·과자를 줄이고 생선·콩·채소를 늘린다', '귀리·보리·채소의 식이섬유가 LDL을 조금 낮춘다', '유산소 운동과 체중 감량', '160 이상이 계속되면 약이 필요한지 진료로 판단한다'],
    next: { A: '정상이에요. 당뇨병이 있다면 100 미만인지도 확인하세요.', B: '경계예요. 식사를 바꾸고 다음 검진에서 다시 보세요. 고혈압·당뇨·흡연 같은 위험 요인이 있으면 더 낮게 관리하라는 권고가 많아요.', D: '이상지질혈증 의심이에요. 다른 위험 요인에 따라 치료 기준이 달라지므로 병·의원 진료를 받아 보세요.' },
    values: [100, 110, 120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 180, 190, 200],
  },
  {
    slug: 'hdl', name: 'HDL 콜레스테롤', short: 'HDL', alias: ['고밀도 콜레스테롤', '좋은 콜레스테롤', 'HDL-C'], unit: 'mg/dL', group: '이상지질혈증', sexBased: false, step: 1, higherIsBetter: true,
    judge: (v) => (v >= 60 ? 'A' : v >= 40 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '60 이상' }, { level: 'B', label: '경계', range: '40~59' }, { level: 'D', label: '이상지질혈증 의심', range: '40 미만' }],
    gauge: () => ({ min: 20, max: 90, cuts: [40, 60], reverse: true }),
    what: '혈관에 쌓인 콜레스테롤을 간으로 실어 가는 쪽이라 "좋은 콜레스테롤"이라 불러요. 다른 수치와 달리 높을수록 좋아요.',
    high: ['흡연', '운동 부족', '복부비만, 단 음식·정제 탄수화물이 많은 식사', '중성지방이 높을 때 함께 낮아지는 경우가 많다'],
    tips: ['담배를 끊는 것이 HDL을 올리는 데 가장 확실하다', '꾸준한 유산소 운동', '체중 감량', '튀김·과자의 트랜스지방을 줄인다'],
    next: { A: '좋은 상태예요.', B: '경계예요. 운동과 금연으로 올릴 수 있어요.', D: '낮은 HDL은 심혈관 위험을 높여요. LDL·중성지방과 함께 진료로 상담해 보세요.' },
    values: [30, 35, 38, 40, 42, 45, 50, 55],
  },
  {
    slug: 'triglyceride', name: '중성지방', short: '중성지방', alias: ['TG', '트리글리세라이드'], unit: 'mg/dL', group: '이상지질혈증', sexBased: false, step: 1,
    judge: (v) => (v < 150 ? 'A' : v <= 199 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '150 미만' }, { level: 'B', label: '경계', range: '150~199' }, { level: 'D', label: '이상지질혈증 의심', range: '200 이상' }],
    gauge: () => ({ min: 50, max: 400, cuts: [150, 200] }),
    what: '몸에 저장되는 지방의 형태예요. 먹은 음식과 술에 따라 크게 움직여서, 검사 전날 과식하거나 술을 마시면 높게 나올 수 있어요.',
    high: ['검사 전 금식이 충분하지 않았거나 전날 술을 마신 경우', '단 음식·흰쌀·면 같은 탄수화물 과다', '음주', '복부비만, 당뇨병'],
    tips: ['술을 줄이는 것이 가장 빨리 효과가 나는 경우가 많다', '단 음료·과일주스·과자를 줄인다', '등푸른생선 같은 오메가3 지방을 늘린다', '체중 감량과 운동'],
    next: { A: '정상이에요.', B: '경계예요. 술과 단 음식을 줄이고 다음 검진에서 다시 보세요.', D: '이상지질혈증 의심이에요. 500 이상처럼 매우 높으면 췌장염 위험도 있어 진료가 필요해요. 금식과 금주를 지킨 뒤 다시 재 보는 것도 방법이에요.' },
    values: [120, 140, 150, 160, 170, 180, 200, 220, 250, 300, 400],
  },
  {
    slug: 'total-cholesterol', name: '총콜레스테롤', short: '총콜레스테롤', alias: ['콜레스테롤', 'TC'], unit: 'mg/dL', group: '이상지질혈증', sexBased: false, step: 1,
    judge: (v) => (v < 200 ? 'A' : v <= 239 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '200 미만' }, { level: 'B', label: '경계', range: '200~239' }, { level: 'D', label: '이상지질혈증 의심', range: '240 이상' }],
    gauge: () => ({ min: 130, max: 300, cuts: [200, 240] }),
    what: 'LDL·HDL 등을 모두 합한 콜레스테롤 양이에요. HDL이 높아서 총콜레스테롤이 높은 경우도 있어 LDL·HDL을 함께 봐야 해요.',
    high: ['기름진 식사, 체중 증가', '유전', '갑상선 기능 저하', '폐경 이후 여성은 자연스럽게 오르는 경우가 많다'],
    tips: ['LDL과 HDL 수치를 함께 확인한다', '포화지방을 줄이고 식이섬유를 늘린다', '유산소 운동과 체중 관리'],
    next: { A: '정상이에요.', B: '경계예요. LDL이 높은지 HDL이 높은지에 따라 의미가 다르니 함께 보세요.', D: '이상지질혈증 의심이에요. LDL·중성지방과 함께 진료로 상담해 보세요.' },
    values: [190, 200, 210, 220, 230, 240, 250, 260, 280],
  },
  {
    slug: 'ast', name: 'AST(SGOT)', short: 'AST', alias: ['간수치 AST', 'SGOT', '에이에스티'], unit: 'U/L', group: '간장질환', sexBased: false, step: 1,
    judge: (v) => (v <= 40 ? 'A' : v <= 50 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '40 이하' }, { level: 'B', label: '경계', range: '41~50' }, { level: 'D', label: '간장질환 의심', range: '51 이상' }],
    gauge: () => ({ min: 10, max: 120, cuts: [41, 51] }),
    what: '간세포에 많은 효소로, 간이 손상되면 혈액으로 나와 수치가 올라요. 근육과 심장에도 있어서 전날 심한 운동을 해도 오를 수 있어요.',
    high: ['지방간', '음주', '전날 무리한 운동(근육 손상)', '일부 약·건강보조식품, 바이러스 간염'],
    tips: ['검사 전 2~3일은 술과 무리한 운동을 피한다', '복용 중인 약·영양제를 확인한다', '지방간이 원인이면 체중의 5~10% 감량이 가장 효과적이다'],
    next: { A: '정상이에요.', B: '경계예요. 술과 운동, 복용 약을 확인하고 몇 주 뒤 다시 재 보세요.', D: '간장질환 의심이에요. ALT·감마지티피와 함께 보고, 계속 높으면 간 초음파나 간염 검사가 필요한지 진료로 확인하세요.' },
    values: [35, 40, 42, 45, 48, 50, 55, 60, 70, 80, 100],
  },
  {
    slug: 'alt', name: 'ALT(SGPT)', short: 'ALT', alias: ['간수치 ALT', 'SGPT', '에이엘티'], unit: 'U/L', group: '간장질환', sexBased: false, step: 1,
    judge: (v) => (v <= 35 ? 'A' : v <= 45 ? 'B' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '35 이하' }, { level: 'B', label: '경계', range: '36~45' }, { level: 'D', label: '간장질환 의심', range: '46 이상' }],
    gauge: () => ({ min: 10, max: 120, cuts: [36, 46] }),
    what: '주로 간세포에 들어 있는 효소라 AST보다 간 손상을 더 잘 보여 줘요. 기준이 AST(40)보다 낮은 35라서 AST는 정상인데 ALT만 경계로 나오는 경우가 흔해요.',
    high: ['지방간(가장 흔함)', '음주', '복부비만·당뇨병', '일부 약·한약·건강보조식품, 바이러스 간염'],
    tips: ['체중 감량과 운동이 지방간 개선에 가장 효과적이다', '단 음료와 과당·정제 탄수화물을 줄인다', '술을 줄인다', '새로 먹기 시작한 약·영양제가 있는지 확인한다'],
    next: { A: '정상이에요.', B: '경계예요. 지방간 여부를 의심해 보고 생활을 바꾼 뒤 다시 재 보세요.', D: '간장질환 의심이에요. 계속 높으면 간 초음파, B·C형 간염 검사가 필요한지 진료로 확인하세요.' },
    values: [30, 33, 35, 36, 38, 40, 42, 45, 48, 50, 55, 60, 70, 80, 100],
  },
  {
    slug: 'ggt', name: '감마지티피(γ-GTP)', short: '감마지티피', alias: ['감마GTP', 'γ-GTP', 'GGT', '감마지티피 수치'], unit: 'U/L', group: '간장질환', sexBased: true, step: 1,
    judge: (v, s) => (s === 'm' ? (v <= 63 ? 'A' : v <= 77 ? 'B' : 'D') : (v <= 35 ? 'A' : v <= 45 ? 'B' : 'D')),
    table: (s) => (s === 'm'
      ? [{ level: 'A', label: '정상', range: '11~63' }, { level: 'B', label: '경계', range: '64~77' }, { level: 'D', label: '간장질환 의심', range: '78 이상' }]
      : [{ level: 'A', label: '정상', range: '8~35' }, { level: 'B', label: '경계', range: '36~45' }, { level: 'D', label: '간장질환 의심', range: '46 이상' }]),
    gauge: (s) => (s === 'm' ? { min: 10, max: 200, cuts: [64, 78] } : { min: 5, max: 120, cuts: [36, 46] }),
    what: '간과 담도(쓸개즙이 지나는 길)에 있는 효소예요. 술에 특히 예민하게 반응해서 "술 수치"로도 불려요. 남녀 기준이 달라요.',
    high: ['음주(가장 흔함)', '지방간', '담도 질환', '일부 약(항경련제 등)'],
    tips: ['술이 원인이면 2~4주 이상 끊은 뒤 다시 재면 많이 내려가는 경우가 많다', '체중 감량과 운동', '복용 약을 확인한다'],
    next: { A: '정상이에요.', B: '경계예요. 술을 줄이고 몇 주 뒤 다시 재 보세요.', D: '간장질환 의심이에요. 금주 후에도 높으면 간·담도 초음파 등이 필요한지 진료로 확인하세요.' },
    values: [40, 50, 60, 64, 70, 78, 80, 90, 100, 120, 150, 200],
  },
  {
    slug: 'egfr', name: '신사구체여과율(eGFR)', short: 'eGFR', alias: ['사구체여과율', '신장 수치', '콩팥 기능'], unit: 'mL/min/1.73㎡', group: '신장질환', sexBased: false, step: 1, higherIsBetter: true,
    judge: (v) => (v >= 60 ? 'A' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '60 이상' }, { level: 'D', label: '신장질환 의심', range: '60 미만' }],
    gauge: () => ({ min: 20, max: 120, cuts: [60], reverse: true }),
    what: '콩팥이 1분에 피를 얼마나 걸러 내는지를 혈청크레아티닌·나이·성별로 계산한 값이에요. 높을수록 좋고 나이가 들수록 조금씩 낮아져요.',
    high: ['나이(자연스럽게 감소)', '고혈압·당뇨병', '탈수, 검사 전 고기를 많이 먹은 경우', '일부 진통소염제를 오래 먹은 경우'],
    tips: ['혈압·혈당을 관리하는 것이 콩팥을 지키는 기본이다', '진통소염제를 습관적으로 먹지 않는다', '짠 음식을 줄인다', '60 미만이면 몇 달 뒤 다시 재서 계속 낮은지 확인한다'],
    next: { A: '정상이에요.', B: '정상이에요.', D: '신장질환 의심이에요. 60 미만이 3개월 넘게 이어지면 만성콩팥병으로 봐요. 요단백 결과와 함께 진료로 확인하세요.' },
    values: [45, 50, 55, 58, 60, 65, 70, 80, 90],
  },
  {
    slug: 'creatinine', name: '혈청크레아티닌', short: '크레아티닌', alias: ['크레아티닌', '신장 수치 크레아티닌'], unit: 'mg/dL', group: '신장질환', sexBased: false, step: 0.1,
    judge: (v) => (v <= 1.5 ? 'A' : 'D'),
    table: () => [{ level: 'A', label: '정상', range: '1.5 이하' }, { level: 'D', label: '신장질환 의심', range: '1.5 초과' }],
    gauge: () => ({ min: 0.4, max: 2.5, cuts: [1.51] }),
    what: '근육이 쓰고 남은 노폐물로 콩팥으로 빠져나가요. 콩팥 기능이 떨어지면 혈액에 쌓여 수치가 올라요. 근육이 많으면 조금 높게 나올 수 있어요.',
    high: ['콩팥 기능 저하', '근육량이 많거나 단백질 보충제를 먹는 경우', '탈수', '전날 심한 운동'],
    tips: ['물을 충분히 마시고 검사 전 무리한 운동을 피한다', 'eGFR 값을 함께 본다', '혈압·혈당 관리'],
    next: { A: '정상이에요. eGFR도 함께 확인하세요.', B: '정상이에요.', D: '신장질환 의심이에요. eGFR·요단백과 함께 진료로 확인하세요.' },
    values: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0],
  },
  {
    slug: 'hemoglobin', name: '혈색소(헤모글로빈)', short: '혈색소', alias: ['헤모글로빈', '빈혈 수치', 'Hb'], unit: 'g/dL', group: '빈혈', sexBased: true, step: 0.1, higherIsBetter: true,
    judge: (v, s) => (s === 'm' ? (v > 16.5 ? 'X' : v >= 13 ? 'A' : v >= 12 ? 'B' : 'D') : (v > 15.5 ? 'X' : v >= 12 ? 'A' : v >= 10 ? 'B' : 'D')),
    table: (s) => (s === 'm'
      ? [{ level: 'A', label: '정상', range: '13.0~16.5' }, { level: 'B', label: '경계', range: '12.0~12.9' }, { level: 'D', label: '빈혈 의심', range: '12.0 미만' }]
      : [{ level: 'A', label: '정상', range: '12.0~15.5' }, { level: 'B', label: '경계', range: '10.0~11.9' }, { level: 'D', label: '빈혈 의심', range: '10.0 미만' }]),
    gauge: (s) => (s === 'm' ? { min: 9, max: 18, cuts: [12, 13], reverse: true } : { min: 8, max: 17, cuts: [10, 12], reverse: true }),
    what: '적혈구 안에서 산소를 나르는 단백질이에요. 낮으면 빈혈을 의심해요. 남녀 기준이 달라요.',
    high: ['철분 부족(여성은 생리, 출산)', '위장 출혈 같은 숨은 출혈', '편식·다이어트', '만성 질환'],
    tips: ['붉은 살코기·간·시금치·콩 같은 철분 많은 음식', '비타민C와 함께 먹으면 철분 흡수가 잘 된다', '이유 없이 낮으면 출혈 원인이 있는지 진료로 확인한다'],
    next: { A: '정상이에요.', B: '경계예요. 철분 섭취를 늘리고 다음 검진에서 다시 보세요.', D: '빈혈 의심이에요. 원인(철 결핍, 출혈 등)을 찾기 위해 진료를 받아 보세요.' },
    values: [],
  },
];

export const labBySlug = (s: string) => LAB.find((x) => x.slug === s)!;

/** 수치 표시(정수/소수) */
export const fmt = (it: LabItem, v: number) => (it.step < 1 ? v.toFixed(1) : String(v));

/** 다음 단계까지의 거리 설명 */
export function distance(it: LabItem, v: number, sex: Sex): string {
  const lv = it.judge(v, sex);
  if (it.slug === 'fasting-glucose') return lv === 'A' ? `경계(100)까지 ${100 - v} 남았어요.` : lv === 'B' ? `정상(100 미만)이 되려면 ${v - 99} 낮춰야 하고, 126부터는 당뇨병 의심이에요.` : `정상 기준(100 미만)보다 ${v - 99} 높아요.`;
  if (lv === 'X') return '기준표의 정상 상한보다 높아요. 탈수나 흡연 등으로 높게 나올 수 있으니 결과지 소견을 확인하세요.';
  if (it.slug === 'creatinine') return lv === 'A' ? `기준(1.5)까지 ${(1.5 - v).toFixed(1)} 남았어요.` : `기준(1.5)보다 ${(v - 1.5).toFixed(1)} 높아요.`;
  const gs = it.gauge(sex);
  if (it.higherIsBetter) {
    if (lv === 'A') return '정상 범위예요.';
    const target = gs.cuts[gs.cuts.length - 1];
    return `정상(${it.step < 1 ? target.toFixed(1) : target} 이상)까지 ${(target - v).toFixed(it.step < 1 ? 1 : 0)} 올라야 해요.`;
  }
  const first = gs.cuts[0];
  if (lv === 'A') return `경계 기준까지 ${(first - v).toFixed(it.step < 1 ? 1 : 0)} 남았어요.`;
  return `정상 상한보다 ${(v - (first - it.step)).toFixed(it.step < 1 ? 1 : 0)} 높아요.`;
}

/** 받침 여부(한글·영문 약어·숫자) — 조사 고르기용 */
export function batchim(word: string): boolean {
  const ch = word.trim().replace(/[)\]]+$/, '').slice(-1);
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return '013678'.includes(ch);
  return /[LMNRlmnr]/.test(ch);
}
/** josa('LDL', '을', '를') → 'LDL을' */
export const josa = (w: string, withB: string, without: string) => w + (batchim(w) ? withB : without);
