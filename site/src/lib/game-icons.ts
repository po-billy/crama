// 게임·재미 콘텐츠 공용 미니 아이콘 — 24 viewBox, stroke 2, currentColor(사이트 아이콘 톤과 통일)
// 서버(set:html)와 클라이언트(define:vars로 주입) 양쪽에서 문자열로 사용.
const P: Record<string, string> = {
  // UI
  crystal: '<circle cx="12" cy="10" r="6.2"/><path d="M8 20h8M9.8 16.6h4.4"/><path d="M10 8.2c.5-1 1.4-1.7 2.5-1.9" stroke-width="1.6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none"/>',
  capsule: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h16.4"/><circle cx="12" cy="12" r="2.6" fill="none" stroke-width="1.5"/>',
  flame: '<path d="M12 3c.8 3.2-3.4 4.8-3.4 8.4a3.4 3.4 0 0 0 6.8.3c1.2.9 1.9 2.1 1.9 3.3M12 3c3.6 2.2 7 5.6 7 10a7 7 0 1 1-14 0c0-2.4 1-4.3 2.6-6"/>',
  heart: '<path d="M12 20.5 5.2 13.6a4.4 4.4 0 1 1 6.2-6.2l.6.6.6-.6a4.4 4.4 0 1 1 6.2 6.2z"/>',
  heartBroken: '<path d="M12 20.5 5.2 13.6a4.4 4.4 0 1 1 6.2-6.2l.6.6.6-.6a4.4 4.4 0 1 1 6.2 6.2z"/><path d="m12.4 7.6-1.8 3.1 2.8 1.9-1.6 3.2"/>',
  check: '<circle cx="12" cy="12" r="8.6"/><path d="m8.4 12.4 2.5 2.6 4.7-5.4"/>',
  sad: '<circle cx="12" cy="12" r="8.6"/><path d="M9 10h.01M15 10h.01M8.6 16.2c1-1.4 2.1-2 3.4-2s2.4.6 3.4 2"/>',
  trophy: '<path d="M8 21h8M12 17.5V21M7.5 4h9v4.5a4.5 4.5 0 0 1-9 0zM7.5 5.5h-3a3 3 0 0 0 3.4 4M16.5 5.5h3a3 3 0 0 1-3.4 4"/>',
  rain: '<path d="M7.2 14.5a4.4 4.4 0 1 1 .7-8.7A5 5 0 0 1 17.6 7 3.7 3.7 0 0 1 17 14.5z"/><path d="m8.8 17.5-.9 2M12.8 17.5l-.9 2M16.8 17.5l-.9 2"/>',
  crown: '<path d="M4.5 8.5 8.6 12 12 6.5 15.4 12l4.1-3.5V17a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 17z"/>',
  medal: '<path d="M8.5 3h7L13.4 8h-2.8z"/><circle cx="12" cy="13.5" r="5"/>',
  sparkle: '<path d="M12 4.5 13.4 8l3.6 1.4-3.6 1.4L12 14.5l-1.4-3.7L7 9.4 10.6 8zM18.6 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7zM5.4 14.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/>',
  wind: '<path d="M4 9.5h8.5A2.4 2.4 0 1 0 10 5M3.5 13.5h13a2.9 2.9 0 1 1-2.9 2.9M4 17.5h4.5"/>',
  worm: '<g fill="currentColor" stroke="none"><circle cx="5.4" cy="16.2" r="3.2"/><circle cx="9" cy="14.4" r="3.6"/><circle cx="12.8" cy="12.2" r="3.7"/><circle cx="16.2" cy="9.9" r="3.3"/><circle cx="18.9" cy="8" r="2.7"/></g>',
  sprout: '<path d="M12 21v-8M12 13c0-3.5-2.6-6-6.5-6C5.6 10.6 8.2 13 12 13zM12 11c.3-3 2.6-5 6.4-5-.2 3.4-2.7 5.4-6.4 5"/>',
  house: '<path d="M4 11.5 12 5l8 6.5M6 10v9h12v-9M10.5 19v-5h3v5"/>',
  chartUp: '<path d="M4 19.5h16M5 15.5l4.2-5 3 3L18 6.5M18 6.5h-3.4M18 6.5v3.4"/>',
  // 예측 종목
  dollar: '<circle cx="12" cy="12" r="8.6"/><path d="M12 6.8v10.4M14.8 8.8c-2.6-1.5-5.6-.5-5.6 1.5 0 2.8 6 1.6 6 4.4 0 2-3.2 3-5.9 1.4"/>',
  btc: '<path d="M9.2 5.5v13M9.2 5.5h4a2.6 2.6 0 1 1 0 5.2h-4m0 0h4.6a2.9 2.9 0 1 1 0 5.8H9.2M10.8 3.5v2m2.8-2v2M10.8 18.5v2m2.8-2v2"/>',
  phone: '<rect x="7" y="3" width="10" height="18" rx="2.2"/><path d="M10.5 5.2h3M12 17.8h.01"/>',
  chip: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4" rx="0.8"/><path d="M9 3.5v3.5M15 3.5v3.5M9 17v3.5M15 17v3.5M3.5 9H7M3.5 15H7M17 9h3.5M17 15h3.5"/>',
  ingot: '<path d="m5 15 1.6-4.6h4L9 15zM13.4 15l1.6-4.6h4L17.4 15z"/><path d="m9.2 9 1.6-4.6h4L13.2 9z" transform="translate(-1.2 4.6) scale(0.98)"/>',
  car: '<path d="M5.5 12.5 7 8.6A2 2 0 0 1 8.9 7.2h6.2a2 2 0 0 1 1.9 1.4l1.5 3.9M5.5 12.5h13M5.5 12.5A2 2 0 0 0 3.8 14.5v2.6h1.9M18.5 12.5a2 2 0 0 1 1.7 2v2.6h-1.9M5.7 17.1v1.7M18.3 17.1v1.7M8.2 15h.01M15.8 15h.01"/>',
  chat: '<path d="M12 4.5c-4.7 0-8.5 2.9-8.5 6.6 0 2.3 1.5 4.3 3.8 5.5L6.6 20l3.6-2.2c.6.1 1.2.2 1.8.2 4.7 0 8.5-2.9 8.5-6.8S16.7 4.5 12 4.5z"/>',
  gem: '<path d="M7 4h10l3.5 5L12 20.5 1.5 9zM1.5 9h21M7 4l5 5 5-5M12 9v11.5"/>',
  memory: '<rect x="4" y="7" width="16" height="8" rx="1.4"/><path d="M7 15v2.5M11 15v2.5M15 15v2.5M19 15v2.5M7.5 10.2h2v2h-2zM14.5 10.2h2v2h-2z" /> ',
  apple: '<path d="M15.5 8.2c-1.2-.5-2.3-.4-3.5.2-1.2-.6-2.3-.7-3.5-.2C6 9.2 5.2 12 6.4 15c1 2.6 2.6 4.4 4 4.3.6 0 1-.3 1.6-.3s1 .3 1.6.3c1.4.1 3-1.7 4-4.3 1.2-3 .4-5.8-2.1-6.8zM12 8.4c-.2-2 .8-3.6 2.6-4.4.3 1.9-.9 3.7-2.6 4.4z"/>',
  gold: '<path d="m4.5 16 1.7-5h4.2l1.1 5zM12.5 16l1.1-5h4.2l1.7 5zM8.4 9.5l1.4-4h4.4l1.4 4z"/>',
  drumstick: '<path d="M14.5 3.5a6 6 0 0 1 6 6c0 3.2-2.6 5.6-5.8 5.9l-4.3 4.3a2.3 2.3 0 1 1-3.3-3.2l.1-.1a2.3 2.3 0 1 1-3.2-3.3l4.3-4.3c.3-3.1 2.9-5.3 6.2-5.3z"/>',
  coffee: '<path d="M5 9h11v6.5a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15.5zM16 10.5h1.6a2.7 2.7 0 1 1 0 5.4H16M7.7 5.5c0-1 .8-1 .8-2M11.2 5.5c0-1 .8-1 .8-2"/>',
  coin: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="5" stroke-width="1.6"/><path d="M12 9.4v5.2" stroke-width="1.6"/>',
  users: '<circle cx="9" cy="9" r="3.4"/><path d="M3.5 20c0-3.2 2.4-5 5.5-5s5.5 1.8 5.5 5M16 6.2a3.4 3.4 0 0 1 0 6M17.8 15.3c1.9.6 3.2 2 3.2 4.7"/>',
  pin: '<path d="M12 21s-6.8-5.8-6.8-11a6.8 6.8 0 1 1 13.6 0c0 5.2-6.8 11-6.8 11z"/><circle cx="12" cy="9.8" r="2.4"/>',
};

export function gIcon(name: string, size = 18, cls = ''): string {
  const body = P[name] || P.sparkle;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${body}</svg>`;
}

// 클라이언트 주입용(예측 종목 key → 아이콘, 기타 UI)
export const G_ICONS: Record<string, string> = Object.fromEntries(
  Object.keys(P).map((k) => [k, gIcon(k, 18)])
);
export const Q_ICON_KEYS: Record<string, string> = {
  kospi: 'chartUp', usd: 'dollar', btc: 'btc',
  samsung: 'phone', nvidia: 'chip', gold: 'gold', tesla: 'car', kakao: 'chat', eth: 'gem', skhynix: 'memory', apple: 'apple',
};
