// 인물·출생연도 공용 계산 — 띠, 별자리, 학번, 국민연금 수급 개시 나이 등.
// 데이터 원본: src/data/people.json (automation/sync-people.mjs 가 위키데이터에서 생성)
import data from '../data/people.json';

export type Person = {
  id: string; slug: string; name: string; en: string; birth: string; job: string; jobs: string[]; links: number; views?: number;
  img?: string; credit?: { artist: string; license: string; url: string };
};
export const PEOPLE = (data as any).people as Person[];
export const PEOPLE_UPDATED = (data as any).generatedAt as string;
export const THIS_YEAR = 2026;

export const ZODIAC = [
  { slug: 'rat', name: '쥐띠', emoji: '🐭' }, { slug: 'ox', name: '소띠', emoji: '🐮' }, { slug: 'tiger', name: '호랑이띠', emoji: '🐯' },
  { slug: 'rabbit', name: '토끼띠', emoji: '🐰' }, { slug: 'dragon', name: '용띠', emoji: '🐲' }, { slug: 'snake', name: '뱀띠', emoji: '🐍' },
  { slug: 'horse', name: '말띠', emoji: '🐴' }, { slug: 'sheep', name: '양띠', emoji: '🐑' }, { slug: 'monkey', name: '원숭이띠', emoji: '🐵' },
  { slug: 'rooster', name: '닭띠', emoji: '🐔' }, { slug: 'dog', name: '개띠', emoji: '🐶' }, { slug: 'pig', name: '돼지띠', emoji: '🐷' },
];
/** 양력 출생연도 기준 띠(음력 설 이전 출생자는 전년도 띠일 수 있음) */
export const zodiacOf = (year: number) => ZODIAC[(((year - 4) % 12) + 12) % 12];
export const zodiacYears = (slug: string, from = 1940, to = THIS_YEAR) => {
  const out: number[] = [];
  for (let y = from; y <= to; y++) if (zodiacOf(y).slug === slug) out.push(y);
  return out;
};

// 별자리 — [시작 월, 시작 일] 순서대로(염소자리는 12/25 시작, 1/19 까지)
export const STARS = [
  { slug: 'capricorn', name: '염소자리', emoji: '♑', from: [12, 25], to: [1, 19] },
  { slug: 'aquarius', name: '물병자리', emoji: '♒', from: [1, 20], to: [2, 18] },
  { slug: 'pisces', name: '물고기자리', emoji: '♓', from: [2, 19], to: [3, 20] },
  { slug: 'aries', name: '양자리', emoji: '♈', from: [3, 21], to: [4, 19] },
  { slug: 'taurus', name: '황소자리', emoji: '♉', from: [4, 20], to: [5, 20] },
  { slug: 'gemini', name: '쌍둥이자리', emoji: '♊', from: [5, 21], to: [6, 21] },
  { slug: 'cancer', name: '게자리', emoji: '♋', from: [6, 22], to: [7, 22] },
  { slug: 'leo', name: '사자자리', emoji: '♌', from: [7, 23], to: [8, 22] },
  { slug: 'virgo', name: '처녀자리', emoji: '♍', from: [8, 23], to: [9, 23] },
  { slug: 'libra', name: '천칭자리', emoji: '♎', from: [9, 24], to: [10, 22] },
  { slug: 'scorpio', name: '전갈자리', emoji: '♏', from: [10, 23], to: [11, 22] },
  { slug: 'sagittarius', name: '사수자리', emoji: '♐', from: [11, 23], to: [12, 24] },
];
export function starOf(month: number, day: number) {
  const v = month * 100 + day;
  for (const s of STARS) {
    const a = s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1];
    if (a <= b ? v >= a && v <= b : v >= a || v <= b) return s;
  }
  return STARS[0];
}
export const starRange = (s: (typeof STARS)[number]) => `${s.from[0]}월 ${s.from[1]}일 ~ ${s.to[0]}월 ${s.to[1]}일`;

export const parts = (birth: string) => { const [y, m, d] = birth.split('-').map(Number); return { y, m, d }; };
export const personZodiac = (p: Person) => zodiacOf(parts(p.birth).y);
export const personStar = (p: Person) => { const { m, d } = parts(p.birth); return starOf(m, d); };
export const birthLabel = (p: Person) => { const { y, m, d } = parts(p.birth); return `${y}년 ${m}월 ${d}일`; };
/** 이름 뒤 조사(은/는) — 받침 유무로 고른다. 한글이 아니면 '은(는)' */
export function topic(name: string) {
  const c = name.charCodeAt(name.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '은(는)';
  return (c - 0xac00) % 28 === 0 ? '는' : '은';
}
export const initial = (name: string) => name.trim().charAt(0);

/** 학번(빠른년생 제외, 만 18세 되는 해의 다음 해 3월 입학 기준) */
export const classOf = (year: number) => String((year + 19) % 100).padStart(2, '0');
/** 국민연금 노령연금 수급 개시 나이(국민연금법 부칙의 출생연도별 단계 상향) */
export function pensionAge(year: number) {
  if (year <= 1952) return 60;
  if (year <= 1956) return 61;
  if (year <= 1960) return 62;
  if (year <= 1964) return 63;
  if (year <= 1968) return 64;
  return 65;
}
/** 올해 일반건강검진 대상 여부(지역가입자·피부양자·사무직: 2년 주기, 출생연도 끝자리 홀짝 기준) */
export const checkupTarget = (year: number) => year % 2 === THIS_YEAR % 2;
export const koreanAge = (year: number) => THIS_YEAR - year + 1; // 세는 나이
export const yearAge = (year: number) => THIS_YEAR - year; // 연 나이(생일이 지나면 만 나이와 같음)

export const BORN_FROM = 1947, BORN_TO = 2007; // 건강검진 연도 페이지(/health-check/[year])와 같은 범위
export const bornYears = () => { const o: number[] = []; for (let y = BORN_TO; y >= BORN_FROM; y--) o.push(y); return o; };
export const peopleOfYear = (year: number) => PEOPLE.filter((p) => parts(p.birth).y === year);
