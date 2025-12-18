// characters.js
// 캐릭터 리스트 페이지 스크립트 (UTF-8)
(function () {
  const apiFetchLocal = window.apiFetch || ((...args) => fetch(...args));

  let charactersCache = [];
  let previewSelected = null;
  let activeFilterKey = 'recommended';
  let currentUserNickname = '게스트';

  const GENRE_FILTERS = [
    '로맨스',
    '로판',
    'SF/판타지',
    '일상/현대',
    '무협',
    '시대',
    'BL',
    'GL',
    '2차 창작',
    '유틸리티',
    '기타',
  ];
  const TARGET_FILTERS = ['남성향', '여성향', '전체'];
  const SPECIAL_FILTERS = [
    { key: 'recommended', label: '추천', type: 'recommended' },
    { key: 'all', label: '전체', type: 'all' },
  ];
  const FILTER_DEFINITIONS = [
    ...SPECIAL_FILTERS,
    ...GENRE_FILTERS.map((label) => ({
      key: `genre-${label}`,
      label,
      type: 'genre',
      value: label,
    })),
    ...TARGET_FILTERS.map((label) => ({
      key: `target-${label}`,
      label: label === '전체' ? '전체 이용자' : label,
      type: 'target',
      value: label,
    })),
  ];
  const AVATAR_PLACEHOLDER =
    window.DEFAULT_AVATAR_PLACEHOLDER || './assets/sample-character-01.png';

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

  function getFilterByKey(key) {
    return FILTER_DEFINITIONS.find((filter) => filter.key === key) || FILTER_DEFINITIONS[0];
  }

  function buildFilterChips() {
    const container = document.getElementById('charactersFilterChips');
    if (!container) return;
    container.innerHTML = '';
    FILTER_DEFINITIONS.forEach((filter) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = filter.label;
      chip.dataset.filterKey = filter.key;
      if (filter.key === activeFilterKey) chip.classList.add('chip--active');
      chip.addEventListener('click', () => setActiveFilter(filter.key));
      container.appendChild(chip);
    });
  }

  function refreshFilterActiveState() {
    const container = document.getElementById('charactersFilterChips');
    if (!container) return;
    container
      .querySelectorAll('.chip')
      .forEach((chip) =>
        chip.classList.toggle('chip--active', chip.dataset.filterKey === activeFilterKey)
      );
  }

  function normalizeValue(value) {
    return (value || '').toString().trim().toLowerCase();
  }

  function selectRecommendedCharacters(list) {
    if (!Array.isArray(list) || !list.length) return [];
    const scored = list.map((character) => {
      const like = Number(character.like_count || 0);
      const view = Number(character.view_count || 0);
      const chat = Number(character.chat_count || 0);
      const premium = character.is_monetized ? 30 : 0;
      return {
        character,
        score: like * 3 + chat * 2 + view + premium,
      };
    });
    const highlighted = scored.filter(
      (entry) =>
        entry.character.is_monetized ||
        Number(entry.character.like_count || 0) >= 5 ||
        Number(entry.character.view_count || 0) >= 30
    );
    const pool = highlighted.length ? highlighted : scored;
    return pool
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.character)
      .slice(0, 16);
  }

  function filterCharacters(list, filter) {
    if (!Array.isArray(list) || !list.length) return [];
    if (!filter) return [...list];
    if (filter.type === 'genre') {
      const value = normalizeValue(filter.value);
      return list.filter((ch) => normalizeValue(ch.genre) === value);
    }
    if (filter.type === 'target') {
      const value = normalizeValue(filter.value);
      return list.filter((ch) => normalizeValue(ch.target) === value);
    }
    if (filter.type === 'recommended') {
      return selectRecommendedCharacters(list);
    }
    return [...list];
  }

  function setCharactersListMessage(message) {
    const listEl = document.getElementById('charactersList');
    if (!listEl) return;
    listEl.innerHTML = `<div class="characters-grid-empty">${message}</div>`;
  }

  function updateSectionHeading(filter) {
    const nicknameEl = document.getElementById('sectionNickname');
    const suffixEl = document.getElementById('sectionEyebrowSuffix');
    const titleEl = document.getElementById('charactersSectionTitle');

    if (nicknameEl) nicknameEl.textContent = currentUserNickname;

    const activeFilter = filter || getFilterByKey(activeFilterKey);
    let titleText = '추천 캐릭터';
    let suffixText = '님을 위한 추천';
    if (activeFilter.type === 'genre') {
      titleText = `${activeFilter.label} 캐릭터`;
      suffixText = `님을 위한 ${activeFilter.label} 추천`;
    } else if (activeFilter.type === 'target') {
      const label =
        activeFilter.value === '전체' ? '전체 이용자' : activeFilter.label || activeFilter.value;
      titleText = `${label} 취향 캐릭터`;
      suffixText = `님을 위한 ${label} 추천`;
    } else if (activeFilter.type === 'all') {
      titleText = '전체 캐릭터';
      suffixText = '님이 고른 전체 캐릭터';
    }
    if (titleEl) titleEl.textContent = titleText;
    if (suffixEl) suffixEl.textContent = suffixText;
  }

  function renderCharactersList(list, filter) {
    const listEl = document.getElementById('charactersList');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (!list || !list.length) {
      setCharactersListMessage('조건에 맞는 캐릭터가 아직 없어요.');
      updateSectionHeading(filter);
      return;
    }
    list.forEach((character) => listEl.appendChild(renderCharacterCard(character)));
    updateSectionHeading(filter);
  }

  function applyActiveFilter() {
    if (!charactersCache.length) return;
    const filter = getFilterByKey(activeFilterKey);
    const filtered = filterCharacters(charactersCache, filter);
    renderCharactersList(filtered, filter);
  }

  async function hydrateUserNickname() {
    const nicknameEl = document.getElementById('sectionNickname');
    if (!nicknameEl) return;
    try {
      if (typeof window.fetchUserContext === 'function') {
        const ctx = await window.fetchUserContext();
        if (ctx) {
          const resolver =
            typeof window.getPreferredUserNickname === 'function'
              ? window.getPreferredUserNickname
              : null;
          const nickname =
            (resolver && resolver(ctx)) ||
            ctx.profile?.display_name ||
            ctx.user?.email?.split('@')?.[0];
          if (nickname) currentUserNickname = nickname;
        }
      }
    } catch (error) {
      console.warn('hydrateUserNickname failed', error);
    }
    nicknameEl.textContent = currentUserNickname;
    updateSectionHeading(getFilterByKey(activeFilterKey));
  }

  function setActiveFilter(key) {
    if (!FILTER_DEFINITIONS.some((filter) => filter.key === key)) {
      key = 'recommended';
    }
    if (activeFilterKey === key && charactersCache.length) {
      applyActiveFilter();
      return;
    }
    activeFilterKey = key;
    refreshFilterActiveState();
    updateSectionHeading(getFilterByKey(activeFilterKey));
    applyActiveFilter();
  }

  // 카드 렌더: 크리에이터 정보 포함
  function renderCharacterCard(character) {
    const card = document.createElement('div');
    card.className = 'character-card card';
    card.dataset.id = character.id;

    const creator = character.creator_profile || {};
    const creatorName = creator.display_name || character.creator_name || '크리에이터';
    const creatorHandle = creator.handle || 'unknown';
    const creatorAvatar = creator.avatar_url || character.creator_avatar_url || AVATAR_PLACEHOLDER;
    const ownerId = character.owner_id || character.user_id;
    const coverImage = character.avatar_url || AVATAR_PLACEHOLDER;

    card.innerHTML = `
      <div class="character-card__thumb">
        <img src="${coverImage}" alt="${character.name}" loading="lazy" />
        ${
          character.is_monetized
            ? `<div class="character-card__badge character-card__badge--share">공유 가능</div>`
            : ''
        }
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
          <div class="creator-avatar">
            <img src="${creatorAvatar}" alt="${creatorName} 프로필" loading="lazy" />
          </div>
          <div class="creator-info">
            <div class="creator-name">${creatorName}</div>
            <div class="creator-handle">@${creatorHandle}</div>
          </div>
        </div>
        <div class="character-card__tags">
          ${(character.tags || []).slice(0, 3).map((t) => `<span class="tag">#${t}</span>`).join('')}
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      e.preventDefault();
      openCharacterPreview(character);
    });

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
    const listEl = document.getElementById('charactersList');
    if (!listEl) return;
    if (!sbClient) {
      setCharactersListMessage('Supabase 클라이언트를 초기화하지 못했습니다.');
      return;
    }

    setCharactersListMessage('불러오는 중...');

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
        setCharactersListMessage('캐릭터를 불러오지 못했습니다.');
        return;
      }

      if (!data || data.length === 0) {
        setCharactersListMessage('아직 등록된 캐릭터가 없습니다.');
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
          .select('id, display_name, handle, avatar_url')
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

      applyActiveFilter();
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
      applyActiveFilter();
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
        <img src="${character.avatar_url || AVATAR_PLACEHOLDER}" alt="${character.name}">
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
    buildFilterChips();
    initHeroCarousel();
    initChipScrollControls();
    hydrateUserNickname();
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
