(function () {
  const PARTIAL_PATH = '/partials/character-detail-modal.html';
  const apiFetch = window.apiFetch || ((...args) => fetch(...args));
  const DEFAULT_AVATAR = window.DEFAULT_AVATAR_PLACEHOLDER || '/assets/sample-character-01.png';

  let partialPromise = null;
  const el = {};

  const state = {
    comments: [],
    commentsExpanded: false,
    currentCharacter: null,
    stats: null,
    likeBusy: false,
    creatorProfile: null,
  };

  async function ensurePartialLoaded() {
    if (partialPromise) return partialPromise;
    partialPromise = fetch(PARTIAL_PATH)
      .then((res) => {
        if (!res.ok) throw new Error('detail_partial_load_failed');
        return res.text();
      })
      .then((html) => {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper);
        bindElements();
        return true;
      })
      .catch((error) => {
        console.error('characterDetail partial load error', error);
        partialPromise = null;
        throw error;
      });
    return partialPromise;
  }

  function bindElements() {
    el.modal = document.getElementById('characterDetailModal');
    el.body = document.getElementById('characterDetailBody');
    el.body = document.getElementById('characterDetailBody');
    el.commentsList = document.getElementById('characterDetailComments');
    el.commentsToggle = document.getElementById('characterDetailCommentsToggle');
    el.likeBtn = document.getElementById('characterDetailLikeBtn');
    el.likeCount = document.getElementById('characterDetailLikeCount');
    el.likesMeta = document.getElementById('characterDetailLikes');
    el.chatsMeta = document.getElementById('characterDetailChats');
    el.commentStat = document.getElementById('characterDetailCommentCount');
    el.commentsHeaderCount = document.getElementById('characterDetailCommentsCount');
    el.description = document.getElementById('characterDetailDescription');
    el.tagline = document.getElementById('characterDetailModalTagline');
    el.title = document.getElementById('characterDetailModalName');
    el.thumb = document.getElementById('characterDetailThumb');
    el.displayName = document.getElementById('characterDetailDisplayName');
    el.heroBadge = document.getElementById('characterDetailHeroBadge');
    el.oneLine = document.getElementById('characterDetailOneLine');
    el.badges = document.getElementById('characterDetailBadges');
    el.sceneCount = document.getElementById('characterDetailSceneCount');
    el.genre = document.getElementById('characterDetailGenre');
    el.target = document.getElementById('characterDetailTarget');
    el.creatorName = document.getElementById('characterDetailCreatorName');
    el.creatorHandle = document.getElementById('characterDetailCreatorHandle');
    el.creatorAvatar = document.getElementById('characterDetailCreatorAvatar');
    el.creatorLink = document.getElementById('characterDetailCreatorLink');
    el.followBtn = document.getElementById('characterDetailFollowBtn');
    el.introBlock = document.getElementById('characterDetailIntroBlock');
    el.introImage = document.getElementById('characterDetailIntroImage');
    el.introText = document.getElementById('characterDetailIntroText');
    el.guideBlock = document.getElementById('characterDetailGuideBlock');
    el.guideText = document.getElementById('characterDetailGuideText');
    el.scenesBlock = document.getElementById('characterDetailScenesBlock');
    el.sceneList = document.getElementById('characterDetailSceneList');
    el.sceneEmpty = document.getElementById('characterDetailSceneEmpty');
    el.exampleBlock = document.getElementById('characterDetailExampleBlock');
    el.exampleList = document.getElementById('characterDetailExampleList');
    el.exampleEmpty = document.getElementById('characterDetailExampleEmpty');
    el.enterBtn = document.getElementById('characterDetailEnterBtn');
    el.avatarModal = document.getElementById('avatarPreviewModal');
    el.avatarImg = document.getElementById('avatarPreviewImage');
    el.avatarCaption = document.getElementById('avatarPreviewCaption');

    document.querySelectorAll('[data-character-detail-close]').forEach((node) => {
      if (node.dataset.bound) return;
      node.addEventListener('click', closeModal);
      node.dataset.bound = '1';
    });

    document.querySelectorAll('[data-avatar-close]').forEach((node) => {
      if (node.dataset.bound) return;
      node.addEventListener('click', closeAvatarPreview);
      node.dataset.bound = '1';
    });

    document.querySelectorAll('[data-collapsible-toggle]').forEach((btn) => {
      if (btn.dataset.bound) return;
      btn.addEventListener('click', () => toggleCollapsible(btn.getAttribute('data-collapsible-toggle')));
      btn.dataset.bound = '1';
    });

    if (el.commentsToggle && !el.commentsToggle.dataset.bound) {
      el.commentsToggle.addEventListener('click', () => {
        state.commentsExpanded = !state.commentsExpanded;
        renderComments();
      });
      el.commentsToggle.dataset.bound = '1';
    }

    if (el.likeBtn && !el.likeBtn.dataset.bound) {
      el.likeBtn.addEventListener('click', handleLike);
      el.likeBtn.dataset.bound = '1';
    }

    if (el.enterBtn && !el.enterBtn.dataset.bound) {
      el.enterBtn.addEventListener('click', handleEnterClick);
      el.enterBtn.dataset.bound = '1';
    }

    if (el.creatorLink && !el.creatorLink.dataset.bound) {
      el.creatorLink.addEventListener('click', navigateToCreator);
      el.creatorLink.dataset.bound = '1';
    }

    if (el.followBtn && !el.followBtn.dataset.bound) {
      el.followBtn.addEventListener('click', handleFollowAction);
      el.followBtn.dataset.bound = '1';
    }

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      if (!closeAvatarPreview()) closeModal();
    });
  }

  function toggleCollapsible(id) {
    const body = document.querySelector(`[data-collapsible-body="${id}"]`);
    if (!body) return;
    const isCollapsed = body.classList.toggle('is-collapsed');
    const toggle = document.querySelector(`[data-collapsible-toggle="${id}"]`);
    if (toggle) toggle.textContent = isCollapsed ? '펼치기' : '접기';
  }

  function resetCollapsibles() {
    document.querySelectorAll('[data-collapsible-body]').forEach((body) => {
      body.classList.add('is-collapsed');
      const id = body.getAttribute('data-collapsible-body');
      const toggle = document.querySelector(`[data-collapsible-toggle="${id}"]`);
      if (toggle) toggle.textContent = '펼치기';
    });
  }

  function setBodyModalState() {
    const hasOpen =
      (el.modal && !el.modal.classList.contains('hidden')) ||
      (el.avatarModal && !el.avatarModal.classList.contains('hidden'));
    document.body.classList.toggle('modal-open', hasOpen);
  }

  function toggleModal(show) {
    if (!el.modal) return;
    el.modal.classList.toggle('hidden', !show);
    el.modal.setAttribute('aria-hidden', show ? 'false' : 'true');
    setBodyModalState();
  }

  function closeModal() {
    if (!el.modal || el.modal.classList.contains('hidden')) return false;
    toggleModal(false);
    return true;
  }

  function escapeHtml(value = '') {
    const text = typeof value === 'string' ? value : String(value ?? '');
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  function formatCount(value) {
    if (value === null || value === undefined) return '0';
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    return num.toLocaleString('ko-KR');
  }

  function updateCommentSummary() {
    const count = state.comments.length;
    if (el.commentStat) el.commentStat.textContent = formatCount(count);
    if (el.commentsHeaderCount) el.commentsHeaderCount.textContent = `(${formatCount(count)})`;
  }

  function renderComments() {
    if (!el.commentsList) return;
    const data = state.commentsExpanded ? state.comments : state.comments.slice(0, 1);
    if (!data.length) {
      el.commentsList.innerHTML =
        '<li class="detail-comment detail-comment--empty">아직 댓글이 없습니다. 첫 감상을 남겨보세요.</li>';
      if (el.commentsToggle) el.commentsToggle.style.visibility = 'hidden';
      updateCommentSummary();
      return;
    }
    el.commentsList.innerHTML = data
      .map((comment) => {
        const author = escapeHtml(comment.author || comment.nickname || '이용자');
        const likes = Number(comment.likes || comment.like_count || 0).toLocaleString('ko-KR');
        const body = escapeHtml(comment.content || comment.body || '');
        return `
          <li class="detail-comment">
            <div class="detail-comment__meta">
              <strong>${author}</strong>
              <span>👍 ${likes}</span>
            </div>
            <p>${body || '내용이 없습니다.'}</p>
          </li>
        `;
      })
      .join('');
    if (el.commentsToggle) {
      el.commentsToggle.style.visibility = state.comments.length > 1 ? 'visible' : 'hidden';
      el.commentsToggle.textContent = state.commentsExpanded
        ? '접기'
        : `전체보기 (${state.comments.length})`;
    }
    updateCommentSummary();
  }

  async function buildAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (!window.sb?.auth) return headers;
    try {
      const { data } = await window.sb.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    } catch (error) {
      console.warn('auth session fetch failed', error);
    }
    return headers;
  }

  async function isUserLoggedIn() {
    if (!window.sb?.auth) return false;
    try {
      const { data } = await window.sb.auth.getSession();
      return Boolean(data?.session);
    } catch (error) {
      console.warn('session fetch failed', error);
      return false;
    }
  }

  async function handleEnterClick() {
    if (!state.currentCharacter?.id) return;
    const targetUrl = `/character?id=${state.currentCharacter.id}`;
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
  }

  async function handleLike() {
    if (!state.currentCharacter?.id || state.likeBusy) return;
    state.likeBusy = true;
    el.likeBtn?.classList.add('is-active');
    try {
      const headers = await buildAuthHeaders();
      const res = await apiFetch(`/api/characters/${state.currentCharacter.id}/like`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        alert('좋아요 처리 중 문제가 발생했습니다.');
        return;
      }
      const payload = await res.json();
      if (typeof payload.like_count !== 'undefined') {
        state.stats = state.stats || {};
        state.stats.like_count = payload.like_count;
        updateStats();
      }
    } catch (error) {
      console.error('character like failed', error);
    } finally {
      state.likeBusy = false;
    }
  }

  async function fetchStats(id) {
    if (!id) return null;
    try {
      const res = await apiFetch(`/api/characters/${id}/stats`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('fetchStats error', error);
      return null;
    }
  }

  async function fetchCharacterData(id) {
    if (!id) return null;
    try {
      const res = await apiFetch(`/api/characters/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch (error) {
      console.warn('fetchCharacterData error', error);
      return null;
    }
  }

  async function fetchComments(id) {
    if (!id) return [];
    try {
      const res = await apiFetch(`/api/characters/${id}/comments?sort=likes`);
      if (!res.ok) return [];
      const payload = await res.json();
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload)) return payload;
      return [];
    } catch (error) {
      console.warn('fetchComments error', error);
      return [];
    }
  }

  async function loadCreatorProfile(ownerId) {
    if (!ownerId) return null;
    if (state.creatorProfile?.id === ownerId) return state.creatorProfile;
    if (!window.sb) return null;
    try {
      const { data, error } = await window.sb
        .from('profiles')
        .select('id, display_name, handle, avatar_url')
        .eq('id', ownerId)
        .maybeSingle();
      if (error) throw error;
      state.creatorProfile = data || null;
      return state.creatorProfile;
    } catch (error) {
      console.warn('creator profile fetch failed', error);
      return null;
    }
  }

  function handleFollowAction() {
    const ownerId = state.currentCharacter?.owner_id || state.currentCharacter?.user_id;
    if (!ownerId) return;
    handleFollowInternal(ownerId);
  }

  async function handleFollowInternal(ownerId) {
    const loggedIn = await isUserLoggedIn();
    if (!loggedIn) {
      if (window.openLoginModal) {
        window.openLoginModal({ redirect: `/creator?user=${ownerId}` });
      } else {
        window.location.href = `/login?redirect=${encodeURIComponent(`/creator?user=${ownerId}`)}`;
      }
      return;
    }
    alert('팔로우 기능은 준비 중입니다.');
  }

  function navigateToCreator() {
    const ownerId = state.currentCharacter?.owner_id || state.currentCharacter?.user_id;
    if (!ownerId) return;
    window.location.href = `/creator?user=${ownerId}`;
  }

  function updateStats() {
    if (!state.currentCharacter) return;
    const likes = state.stats?.like_count ?? state.currentCharacter.like_count;
    const chats = state.stats?.chat_count ?? state.currentCharacter.chat_count;
    const comments = state.comments.length;
    if (el.likesMeta) el.likesMeta.textContent = formatCount(likes);
    if (el.chatsMeta) el.chatsMeta.textContent = formatCount(chats);
    if (el.likeCount) el.likeCount.textContent = formatCount(likes);
    if (el.commentStat) el.commentStat.textContent = formatCount(comments);
  }

  function renderScenePreview(templates = []) {
    if (!el.scenesBlock || !el.sceneList || !el.sceneEmpty) return;
    const hasScenes = Array.isArray(templates) && templates.length > 0;
    el.scenesBlock.classList.toggle('hidden', !hasScenes);
    if (!hasScenes) return;
    el.sceneList.innerHTML = templates
      .slice(0, 6)
      .map((scene) => {
        const label = escapeHtml(scene.label || 'Scene');
        const image = escapeHtml(scene.image_url || scene.url || '/assets/sample-character-02.png');
        return `
          <div class="scene-card">
            <img src="${image}" alt="${label}">
            <div>${label}</div>
          </div>
        `;
      })
      .join('');
    el.sceneEmpty.style.display = templates.length ? 'none' : 'block';
  }

  function renderCreatorAvatar(url, fallback) {
    if (!el.creatorAvatar) return;
    const initials = (fallback || '').trim().slice(0, 2).toUpperCase() || 'CR';
    if (typeof window.applyAvatarVisual === 'function') {
      window.applyAvatarVisual(el.creatorAvatar, url, initials, {
        setAria: false,
        placeholderUrl: DEFAULT_AVATAR,
      });
      return;
    }
    // Fallback if applyAvatarVisual is unavailable
    if (url) {
      const sanitized = url.replace(/(["'()])/g, '\\$1');
      el.creatorAvatar.style.backgroundImage = `url("${sanitized}")`;
      el.creatorAvatar.textContent = '';
    } else {
      el.creatorAvatar.style.backgroundImage = '';
      el.creatorAvatar.textContent = initials;
    }
  }

  function renderExamplePreview(character = {}) {
    if (!el.exampleBlock || !el.exampleList || !el.exampleEmpty) return;
    const pairs = Array.isArray(character.example_dialog_pairs) ? character.example_dialog_pairs : [];
    const normalized = pairs
      .map((pair) => ({
        user: pair.user || pair.User || '',
        character: pair.character || pair.Character || pair.char || '',
      }))
      .filter((pair) => pair.user || pair.character);
    const exampleLines = [];
    if (normalized.length) {
      normalized.forEach((pair) => {
        if (pair.user) {
          exampleLines.push({ role: '사용자', text: pair.user, type: 'user' });
        }
        if (pair.character) {
          exampleLines.push({ role: character.name || '캐릭터', text: pair.character, type: 'character' });
        }
      });
    } else if (character.example_dialog) {
      character.example_dialog
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line, idx) => {
          exampleLines.push({ role: `${character.name || '캐릭터'} 예시 ${idx + 1}`, text: line, type: 'character' });
        });
    }
    el.exampleBlock.classList.toggle('hidden', !exampleLines.length);
    if (!exampleLines.length) return;
    const characterAvatar = state.currentCharacter?.avatar_url || DEFAULT_AVATAR;
    el.exampleList.innerHTML = exampleLines
      .map((line) => {
        const isUser = line.type === 'user';
        const avatarSrc = isUser ? '/assets/sample-character-03.png' : characterAvatar;
        return `
          <li class="chat-message ${isUser ? 'chat-message--user' : 'chat-message--character'}">
            <div class="chat-message__avatar">
              <img src="${avatarSrc}" alt="${escapeHtml(line.role || '')}">
            </div>
            <div class="chat-message__bubble">
              <div class="chat-message__name">${escapeHtml(line.role || '')}</div>
              <div class="chat-message__text">${escapeHtml(line.text || '')}</div>
            </div>
          </li>
        `;
      })
      .join('');
    el.exampleEmpty.style.display = exampleLines.length ? 'none' : 'block';
  }

  function renderCreatorSection() {
    const ownerId = state.currentCharacter?.owner_id || state.currentCharacter?.user_id;
    const profile = state.creatorProfile;
    const displayName = profile?.display_name || profile?.handle || (ownerId ? '크리에이터' : '등록되지 않음');
    const handleText = profile?.handle
      ? `@${profile.handle}`
      : ownerId
      ? '프로필 정보 없음'
      : '크리에이터 정보 없음';
    if (el.creatorName) {
      el.creatorName.textContent = displayName;
    }
    if (el.creatorHandle) {
      el.creatorHandle.textContent = handleText;
    }
    renderCreatorAvatar(profile?.avatar_url, displayName);
    if (el.creatorLink) {
      el.creatorLink.disabled = !ownerId;
      el.creatorLink.style.opacity = ownerId ? '1' : '0.5';
    }
    if (el.followBtn) {
      el.followBtn.disabled = !ownerId;
      el.followBtn.textContent = ownerId ? '팔로우' : '팔로우 불가';
    }
  }

  function renderCharacterDetail(data) {
    if (!data) return;
    if (el.title) el.title.textContent = data.name || '캐릭터';
    if (el.displayName) el.displayName.textContent = data.name || '캐릭터';
    if (el.tagline) el.tagline.textContent = data.one_line || '소개 문구가 아직 없습니다.';
    if (el.oneLine) el.oneLine.textContent = data.one_line || '한 줄 소개가 아직 없습니다.';
    if (el.thumb) el.thumb.src = data.avatar_url || DEFAULT_AVATAR;
    if (el.heroBadge) {
      el.heroBadge.textContent = data.is_monetized ? '수익 공유' : '일반';
      el.heroBadge.classList.toggle('is-premium', Boolean(data.is_monetized));
    }
    if (el.description) {
      const desc = data.description?.trim();
      el.description.textContent = desc || '제작자가 아직 설명을 입력하지 않았습니다.';
    }
    if (el.sceneCount) {
      const count = Array.isArray(data.scene_image_templates) ? data.scene_image_templates.length : 0;
      el.sceneCount.textContent = `Scene ${count}`;
    }
    if (el.genre) el.genre.textContent = `장르 ${data.genre?.trim() || '-'}`;
    if (el.target) el.target.textContent = `타깃 ${data.target?.trim() || '-'}`;
    const tags = normalizeTags(data.tags);
    if (el.badges) {
      el.badges.innerHTML = tags.length ? tags.map((tag) => `<span>#${escapeHtml(tag)}</span>`).join('') : '';
      el.badges.classList.toggle('hidden', !tags.length);
    }

    const hasIntro = Boolean(data.intro || data.intro_image_url);
    if (el.introBlock) {
      el.introBlock.classList.toggle('hidden', !hasIntro);
    }
    if (hasIntro) {
      if (el.introImage) {
        el.introImage.src = data.intro_image_url || data.avatar_url || DEFAULT_AVATAR;
      }
      if (el.introText) {
        el.introText.textContent = data.intro?.trim() || '인트로가 아직 등록되지 않았습니다.';
      }
    }

    renderScenePreview(data.scene_image_templates || []);
    renderExamplePreview(data);
    renderPlayGuide(data.play_guide);
    renderCreatorSection();
    updateStats();
  }

  function renderPlayGuide(guide) {
    if (!el.guideBlock || !el.guideText) return;
    const hasGuide = Boolean(guide && guide.trim());
    el.guideBlock.classList.toggle('hidden', !hasGuide);
    if (hasGuide) el.guideText.textContent = guide.trim();
  }

  function normalizeTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) {
      return tags.map((tag) => (typeof tag === 'string' ? tag.trim() : '')).filter(Boolean);
    }
    if (typeof tags === 'string') {
      return tags
        .split(/[,#\s]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
    }
    return [];
  }

  function needsFullDetailPayload(data) {
    if (!data) return true;
    const required = ['description', 'intro', 'intro_image_url', 'scene_image_templates', 'example_dialog', 'example_dialog_pairs', 'play_guide'];
    return required.some((key) => typeof data[key] === 'undefined');
  }

  async function hydrateDetail(character) {
    if (!character?.id) return;
    let base = { ...character };
    if (needsFullDetailPayload(base)) {
      const remote = await fetchCharacterData(character.id);
      if (remote) {
        base = { ...base, ...remote };
      }
    }
    state.currentCharacter = base;
    state.stats = {
      like_count: base.like_count,
      chat_count: base.chat_count,
      view_count: base.view_count,
    };
    state.creatorProfile = base.creator_profile || null;
    resetCollapsibles();
    const ownerId = base.owner_id || base.user_id;
    if (!state.creatorProfile && ownerId) {
      await loadCreatorProfile(ownerId);
    }
    const [stats, comments] = await Promise.all([fetchStats(base.id), fetchComments(base.id)]);
    if (stats) state.stats = stats;
    state.comments = comments;
    state.commentsExpanded = false;
    renderCharacterDetail(state.currentCharacter);
    renderComments();
  }

  async function openWithData(character) {
    if (!character || !character.id) return;
    await ensurePartialLoaded();
    await hydrateDetail(character);
    toggleModal(true);
  }

  async function openById(id) {
    await ensurePartialLoaded();
    const data = await fetchCharacterData(id);
    if (!data) {
      alert('캐릭터 정보를 불러오지 못했습니다.');
      return;
    }
    await hydrateDetail(data);
    toggleModal(true);
  }

  function openAvatarPreview(src, caption) {
    if (!el.avatarModal || !el.avatarImg || !el.avatarCaption) return;
    el.avatarImg.src = src || state.currentCharacter?.avatar_url || DEFAULT_AVATAR;
    el.avatarCaption.textContent = caption || state.currentCharacter?.name || '캐릭터 프로필';
    el.avatarModal.classList.remove('hidden');
    el.avatarModal.setAttribute('aria-hidden', 'false');
    setBodyModalState();
  }

  function closeAvatarPreview() {
    if (!el.avatarModal || el.avatarModal.classList.contains('hidden')) return false;
    el.avatarModal.classList.add('hidden');
    el.avatarModal.setAttribute('aria-hidden', 'true');
    setBodyModalState();
    return true;
  }

  window.CharacterDetailModal = {
    ensureLoaded: ensurePartialLoaded,
    openWithData,
    openById,
    openAvatarPreview,
    closeAvatarPreview,
  };
})();
