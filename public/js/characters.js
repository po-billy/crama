// characters.js
// 캐릭터 리스트 페이지 스크립트 (UTF-8)
(function () {
  const apiFetchLocal = window.apiFetch || ((...args) => fetch(...args));

  let charactersCache = [];
  let previewSelected = null;

  async function isUserLoggedIn() {
    if (!window.sb?.auth) return false;
    try {
      const { data } = await window.sb.auth.getSession();
      return !!data?.session;
    } catch (e) {
      console.warn('session check failed', e);
      return false;
    }
  }

  async function fetchCharacterStats(id) {
    try {
      const res = await apiFetchLocal(`/api/characters/${id}/stats`);
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.warn('fetchCharacterStats error', e);
      return null;
    }
  }

  // 카드 렌더: 크리에이터 정보 포함
  function renderCharacterCard(character) {
  const card = document.createElement('div');
  card.className = 'character-card card';
  card.dataset.id = character.id;

  const creator = character.creator_profile || {};
  const creatorName = creator.display_name || ''; 
  const creatorHandle = creator.handle || 'unknown';
  const creatorInitial = (creator.display_name || creator.handle || '?').slice(0, 2);
  const ownerId = character.owner_id || character.user_id;

  card.innerHTML = `
    <div class="character-card__thumb">
      <img src="${character.avatar_url || './assets/sample-character.png'}" alt="${character.name}" />
      ${character.is_monetized ? `<div class="character-card__badge character-card__badge--share">공유 가능</div>` : ''}
    </div>
    <div class="character-card__body">
      <div class="character-card__title-row">
        <h2 class="character-card__name">${character.name}</h2>
      </div>
      <p class="character-card__summary">
        ${character.one_line || ''}
      </p>
      <div class="character-card__meta">
        <span class="meta-item">좋아요 ${character.like_count || 0}</span>
        <span class="meta-item">채팅 ${character.chat_count || 0}</span>
        <span class="meta-item">조회수 ${character.view_count || 0}</span>
      </div>
      <div class="character-card__creator">
        <div class="creator-avatar">${creatorInitial}</div>
        <div class="creator-info">
          <div class="creator-name">${creatorName}</div>
          <div class="creator-handle">@${creatorHandle}</div>
        </div>
      </div>
      <div class="character-card__tags">
        ${(character.tags || []).slice(0, 3).map(t => `<span class="tag">#${t}</span>`).join('')}
      </div>
    </div>
  `;

  card.addEventListener('click', (e) => {
    e.preventDefault();
    openCharacterPreview(character);
  });

  // 크리에이터 정보 클릭 시 creator 페이지로 이동
  const creatorBlock = card.querySelector('.character-card__creator');
  if (creatorBlock && ownerId) {
    creatorBlock.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/creator?user=${ownerId}`;
    });
  }

  return card;
}

  // ===== Hero carousel (샘플 데이터) =====
  const heroSlidesData = [
  {
    title: '샘플 캐릭터 1',
    subtitle: '추천 캐릭터를 만나보세요',
    tags: ['#추천', '#인기'],
    badge: '오늘의 캐릭터',
    progress: '1/3',
    image: './assets/로판.webp'
  },
  {
    title: '샘플 캐릭터 2',
    subtitle: '새로운 이야기가 시작됩니다',
    tags: ['#스토리', '#모험'],
    badge: '에디터 추천',
    progress: '2/3',
    image: './assets/모에.webp'
  },
  {
    title: '샘플 캐릭터 3',
    subtitle: '다양한 장르를 즐겨보세요',
    tags: ['#판타지', '#액션'],
    badge: '인기 급상승',
    progress: '3/3',
    image: './assets/액션.webp'
  }
  ];

  function buildHeroSlides() {
  const container = document.getElementById('heroCarousel');
  if (!container) return;
  container.innerHTML = `
    <article class="hero-slide hero-slide--ghost" data-pos="prev">
      <img src="${heroSlidesData[1].image}" alt="${heroSlidesData[1].title}" />
    </article>
    <article class="hero-slide hero-slide--main" data-pos="main">
      <img src="${heroSlidesData[0].image}" alt="${heroSlidesData[0].title}" />
      <div class="hero-slide__overlay"></div>
      <div class="hero-slide__content"></div>
      <div class="hero-slide__progress"></div>
    </article>
    <article class="hero-slide hero-slide--ghost" data-pos="next">
      <img src="${heroSlidesData[2].image}" alt="${heroSlidesData[2].title}" />
    </article>
  `;
}

function renderHeroContent(data) {
  const mainSlide = document.querySelector('.hero-slide--main');
  if (!mainSlide) return;
  const content = mainSlide.querySelector('.hero-slide__content');
  const progress = mainSlide.querySelector('.hero-slide__progress');
  const img = mainSlide.querySelector('img');
  if (img) img.src = data.image;
  if (img) img.alt = data.title;
  if (progress) progress.textContent = data.progress || '';
  if (content) {
    content.innerHTML = `
      <div class="hero-slide__eyebrow">${data.badge || ''}</div>
      <h1 class="hero-slide__title">${data.title || ''}</h1>
      <p class="hero-slide__subtitle">${data.subtitle || ''}</p>
      <div class="hero-slide__tags">
        ${(data.tags || []).map(t => `<span>${t}</span>`).join('')}
      </div>
    `;
  }
}

function syncSideSlides(prevData, nextData) {
  const prevSlide = document.querySelector('.hero-slide[data-pos="prev"] img');
  const nextSlide = document.querySelector('.hero-slide[data-pos="next"] img');
  if (prevSlide && prevData) {
    prevSlide.src = prevData.image;
    prevSlide.alt = prevData.title;
  }
  if (nextSlide && nextData) {
    nextSlide.src = nextData.image;
    nextSlide.alt = nextData.title;
  }
  }

  function initHeroCarousel() {
  const container = document.getElementById('heroCarousel');
  if (!container) return;
  if (!heroSlidesData || heroSlidesData.length === 0) return;

  buildHeroSlides();
  let current = 0;
  let timer = null;

  function updateSlides() {
    const prev = (current - 1 + heroSlidesData.length) % heroSlidesData.length;
    const next = (current + 1) % heroSlidesData.length;
    renderHeroContent(heroSlidesData[current]);
    syncSideSlides(heroSlidesData[prev], heroSlidesData[next]);
  }

  function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
      current = (current + 1) % heroSlidesData.length;
      updateSlides();
    }, 6000);
  }

  updateSlides();
  startTimer();

  const prevBtn = document.getElementById('heroPrev');
  const nextBtn = document.getElementById('heroNext');
  const goPrev = () => {
    current = (current - 1 + heroSlidesData.length) % heroSlidesData.length;
    updateSlides();
    startTimer();
  };
  const goNext = () => {
    current = (current + 1) % heroSlidesData.length;
    updateSlides();
    startTimer();
  };
  if (prevBtn) prevBtn.addEventListener('click', goPrev);
  if (nextBtn) prevBtn && nextBtn.addEventListener('click', goNext);

  container.addEventListener('touchstart', (e) => {
    const touchStartX = e.touches[0].clientX;
    const touchHandler = (moveEvent) => {
      const deltaX = moveEvent.touches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 50) {
        deltaX > 0 ? goPrev() : goNext();
        container.removeEventListener('touchmove', touchHandler);
      }
    };
    container.addEventListener('touchmove', touchHandler);
  });
  }

  function initChipScrollControls() {
  const chipsBar = document.querySelector('.chips-bar');
  if (!chipsBar) return;
  const scrollEl = chipsBar.querySelector('.chips-scroll');
  const prevBtn = chipsBar.querySelector('.chips-nav--prev');
  const nextBtn = chipsBar.querySelector('.chips-nav--next');
  if (!scrollEl || !prevBtn || !nextBtn) return;

  const updateButtons = () => {
    const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
    const tolerance = 4;
    prevBtn.classList.toggle('hidden', scrollEl.scrollLeft <= tolerance);
    nextBtn.classList.toggle('hidden', scrollEl.scrollLeft >= maxScroll - tolerance);
  };

  const scrollByAmount = (delta) => {
    scrollEl.scrollBy({ left: delta, behavior: 'smooth' });
  };

  prevBtn.addEventListener('click', () => scrollByAmount(-260));
  nextBtn.addEventListener('click', () => scrollByAmount(260));
  scrollEl.addEventListener('scroll', updateButtons);
  window.addEventListener('resize', updateButtons);
  updateButtons();
  }

  async function loadCharacters() {
    const sbClient = window.sb;
    const listEl = document.querySelector('.characters-grid');
    if (!listEl) return;
    if (!sbClient) {
      listEl.innerHTML = '<div>Supabase 클라이언트를 초기화하지 못했습니다.</div>';
      return;
    }

    listEl.textContent = '불러오는 중...';

    try {
      // public characters 조회
      const { data, error } = await sbClient
        .from('characters')
        .select('id, owner_id, name, one_line, avatar_url, tags, like_count, view_count, is_monetized, genre, target')
        .eq('visibility', 'public')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error(error);
        listEl.innerHTML = '<div>캐릭터를 불러오지 못했습니다.</div>';
        return;
      }

      if (!data || data.length === 0) {
        listEl.innerHTML = '<div>표시할 캐릭터가 없습니다.</div>';
        return;
      }

      charactersCache = data;
      // stats 병합
      const statsList = await Promise.all(
        data.map((ch) => fetchCharacterStats(ch.id).catch(() => null))
      );
      statsList.forEach((stats, idx) => {
        if (stats) {
          data[idx].like_count = stats.like_count;
          data[idx].view_count = stats.view_count;
          data[idx].chat_count = stats.chat_count;
        }
      });

      // 프로필 매핑
      const userIds = [...new Set((data || []).map((ch) => ch.owner_id || ch.user_id).filter(Boolean))];
      const profileMap = new Map();
      if (userIds.length) {
        const { data: profiles, error: pErr } = await sbClient
          .from('profiles')
          .select('id, display_name, handle')
          .in('id', userIds);
        if (!pErr && profiles) {
          profiles.forEach((p) => profileMap.set(p.id, p));
        }
      }
      data.forEach((ch) => {
        const ownerId = ch.owner_id || ch.user_id;
        if (ownerId && profileMap.has(ownerId)) {
          ch.creator_profile = profileMap.get(ownerId);
        }
        ch.owner_id = ownerId || null;
      });

      listEl.innerHTML = '';
      data.forEach((ch) => listEl.appendChild(renderCharacterCard(ch)));
    } catch (e) {
      console.error('loadCharacters exception', e);
      // 실패 시 간단한 샘플 카드
      const fallback = [
        {
          id: 'sample-1',
          name: '샘플 캐릭터',
          one_line: '여기에 캐릭터 요약이 표시됩니다.',
          like_count: 0,
          chat_count: 0,
          view_count: 0,
          tags: ['샘플', '예시'],
        },
      ];
      charactersCache = fallback;
      listEl.innerHTML = '';
      fallback.forEach((ch) => listEl.appendChild(renderCharacterCard(ch)));
    }
  }

  // ===== Preview modal =====
  function initPreviewModal() {
  const modal = document.getElementById('characterPreviewModal');
  const closeBtn = document.getElementById('previewCloseBtn');
  const enterBtn = document.getElementById('previewEnterBtn');
  const backdrop = document.querySelector('.character-preview-backdrop');
  if (!modal) return;

  const close = () => {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    previewSelected = null;
  };
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });
  if (enterBtn) {
    enterBtn.addEventListener('click', async () => {
      if (!previewSelected) return;
      const targetUrl = `/character?id=${previewSelected.id}`;
      const loggedIn = await isUserLoggedIn();
      if (!loggedIn) {
        if (window.openLoginModal) {
          window.openLoginModal({ redirect: targetUrl });
        } else {
          window.location.href = `/login?redirect=${encodeURIComponent(targetUrl)}`;
        }
        return;
      }
      window.location.href = targetUrl;
    });
  }
  }

  function openCharacterPreview(character) {
  const modal = document.getElementById('characterPreviewModal');
  const track = document.getElementById('previewTrack');
  const meta = document.getElementById('previewMeta');
  const enterBtn = document.getElementById('previewEnterBtn');
  if (!modal || !track || !meta || !enterBtn) return;

  previewSelected = character;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  meta.innerHTML = `
    <span>좋아요 ${character.like_count || 0}</span>
    <span>채팅 ${character.chat_count || 0}</span>
    <span>조회수 ${character.view_count || 0}</span>
  `;

  const tags = (character.tags || []).map((t) => `#${t}`).join(' ');
  track.innerHTML = `
    <div class="preview-slide">
      <div class="preview-hero">
        <img src="${character.avatar_url || './assets/sample-character.png'}" alt="${character.name}">
        <div class="hero-badge"><span class="dot"></span>${character.is_monetized ? '수익 공유' : '일반'}</div>
      </div>
      <h3 class="preview-name">${character.name || ''}</h3>
      <p class="preview-one-line">${character.one_line || ''}</p>
      <div class="preview-tags">
        ${(character.tags || []).slice(0, 6).map((t) => `<span class="preview-tag">#${t}</span>`).join('')}
      </div>
    </div>
    <div class="preview-slide">
      <div class="preview-field">
        <div class="preview-label">설명</div>
        <div class="preview-box">${character.description || '설명이 없습니다.'}</div>
      </div>
      <div class="preview-field">
        <div class="preview-label">플레이 가이드</div>
        <div class="preview-box">${character.play_guide || '가이드가 없습니다.'}</div>
      </div>
    </div>
    <div class="preview-slide">
      <div class="preview-field">
        <div class="preview-label">장르</div>
        <div class="preview-box">${character.genre || '-'}</div>
      </div>
      <div class="preview-field">
        <div class="preview-label">타겟</div>
        <div class="preview-box">${character.target || '-'}</div>
      </div>
      <div class="preview-field">
        <div class="preview-label">태그</div>
        <div class="preview-box">${tags || '-'}</div>
      </div>
    </div>
  `;

  enterBtn.focus();
  }

  // DOM 로드 후 초기화
  document.addEventListener('DOMContentLoaded', () => {
  initHeroCarousel();
  initChipScrollControls();
  loadCharacters();

  const createBtn = document.getElementById('createCharacterBtn');
  if (createBtn) {
    createBtn.addEventListener('click', () => {
      window.location.href = '/create-character';
    });
  }

  initPreviewModal();
  });

})();
