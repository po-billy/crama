// 정책 캘린더 iCalendar(.ics) 피드 — Google Calendar, Apple Calendar 등에서 구독 가능
import type { APIRoute } from 'astro';

const EVENTS = [
  { m: 1, d: 15, title: '연말정산 간소화 서비스 오픈', desc: '홈택스에서 소득·세액공제 자료 확인' },
  { m: 1, d: 25, title: '부가가치세 확정신고 마감', desc: '전년 2기분 부가세 신고·납부' },
  { m: 2, d: 3, title: '청년 전세자금 대출 상반기 접수', desc: '만 19~34세 무주택자, 보증금 3억 이하 전세 대출' },
  { m: 2, d: 28, title: '연말정산 환급 시작', desc: '근로소득 연말정산 환급금 지급 시작' },
  { m: 3, d: 2, title: '근로·자녀장려금 반기 신청 (~3/15)', desc: '상반기분 장려금 신청' },
  { m: 3, d: 3, title: '국민취업지원제도 상반기 신청', desc: '구직촉진수당 월 50만원 + 취업지원 서비스' },
  { m: 3, d: 31, title: '건강보험료 정산', desc: '전년도 소득 기준 건보료 정산·추가 납부' },
  { m: 4, d: 1, title: '신혼부부 특별공급 상반기 접수', desc: '혼인 7년 이내 무주택 세대 대상 특별공급' },
  { m: 4, d: 25, title: '부가가치세 예정신고 마감', desc: '1기 부가세 예정 신고·납부' },
  { m: 5, d: 1, title: '종합소득세 신고 시작', desc: '프리랜서·N잡러 종소세 신고 (~5/31)' },
  { m: 5, d: 1, title: '근로·자녀장려금 정기 신청 (~5/31)', desc: '전년 귀속 장려금 신청' },
  { m: 5, d: 31, title: '⚠️ 종합소득세 신고 마감', desc: '기한 내 미신고 시 가산세 부과' },
  { m: 6, d: 1, title: '재산세(건축물) 납부 (~6/30)', desc: '건축물분 재산세 납부' },
  { m: 6, d: 16, title: '청년도약계좌 신규 신청 (~7/3)', desc: '출생연도 5부제 적용' },
  { m: 7, d: 1, title: '부모급여 하반기 지급 시작', desc: '만 0세 월 100만원, 만 1세 월 50만원 지급' },
  { m: 7, d: 3, title: '⚠️ 청년도약계좌 신청 마감', desc: '하반기 신규 가입 마감' },
  { m: 7, d: 25, title: '부가가치세 확정신고 마감', desc: '1기분 부가세 확정 신고·납부' },
  { m: 7, d: 31, title: '재산세(주택 1기) 납부 마감', desc: '주택분 재산세 1기 납부' },
  { m: 8, d: 1, title: '⚠️ 청년 월세 지원 하반기 접수', desc: '만 19~34세, 월세 20만원(최대 12개월) 지원' },
  { m: 8, d: 31, title: '주민세 납부 마감', desc: '개인분 주민세 납부' },
  { m: 9, d: 1, title: '근로·자녀장려금 지급', desc: '5월 신청분 장려금 지급 시작' },
  { m: 9, d: 1, title: '국민내일배움카드 하반기 신청', desc: '직업훈련비 최대 500만원 지원' },
  { m: 9, d: 15, title: '국가장학금 2학기 신청 마감', desc: '2학기 국가장학금 신청' },
  { m: 9, d: 30, title: '재산세(주택 2기) 납부 마감', desc: '주택분 재산세 2기 납부' },
  { m: 10, d: 1, title: '청년창업지원패키지 하반기 접수', desc: '만 39세 이하 예비·초기 창업자 최대 1억 지원' },
  { m: 10, d: 25, title: '부가가치세 예정신고 마감', desc: '2기 부가세 예정 신고·납부' },
  { m: 11, d: 1, title: '주거안정 월세 대출 연중 접수', desc: '연소득 5천만원 이하, 보증금 1억 이하 월세 대출' },
  { m: 11, d: 15, title: '종합부동산세 고지', desc: '종부세 고지서 발송·납부 (~12/15)' },
  { m: 11, d: 30, title: '건강보험 피부양자 요건 점검', desc: '연소득 2천만원 초과 시 지역가입 전환' },
  { m: 12, d: 1, title: '⚠️ IRP·연금저축 납입 마감 임박', desc: '세액공제 한도(900만원) 채우기 (~12/31)' },
  { m: 12, d: 15, title: '⚠️ 종합부동산세 납부 마감', desc: '기한 내 미납부 시 가산세' },
  { m: 12, d: 31, title: 'ISA 계좌 납입 마감', desc: '올해 비과세 한도를 채우려면 연내 납입' },
  { m: 12, d: 31, title: '연말정산 준비 완료', desc: '기부금·의료비·교육비 영수증 챙기기' },
];

function pad(n: number) { return String(n).padStart(2, '0'); }
function icsDate(year: number, m: number, d: number) { return `${year}${pad(m)}${pad(d)}`; }

export const GET: APIRoute = () => {
  const year = 2026;
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Crama//Policy Calendar//KO',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:크라마 정책 캘린더 2026',
    'X-WR-TIMEZONE:Asia/Seoul',
  ];

  EVENTS.forEach((ev, i) => {
    const dtStart = icsDate(year, ev.m, ev.d);
    // 종일 이벤트: DTEND는 다음 날
    const nextDay = new Date(year, ev.m - 1, ev.d + 1);
    const dtEnd = icsDate(nextDay.getFullYear(), nextDay.getMonth() + 1, nextDay.getDate());

    ics.push(
      'BEGIN:VEVENT',
      `UID:crama-policy-${year}-${i}@crama.app`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dtStart}`,
      `DTEND;VALUE=DATE:${dtEnd}`,
      `SUMMARY:${ev.title}`,
      `DESCRIPTION:${ev.desc}\\n\\n자세히 보기: https://crama.app/policy-calendar/`,
      `URL:https://crama.app/policy-calendar/`,
      // 하루 전 알림
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:내일: ${ev.title}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });

  ics.push('END:VCALENDAR');

  return new Response(ics.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="crama-policy-2026.ics"',
    },
  });
};
