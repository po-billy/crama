(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const listEl = document.getElementById('myWorksList');
    if (!listEl) return;

    const emptyEl = document.getElementById('myWorksEmpty');
    const countEl = document.getElementById('myWorksCount');
    const sortSelect = document.getElementById('myWorksSort');
    const createBtn = document.getElementById('myWorksCreateBtn');
    const emptyBtn = document.getElementById('myWorksEmptyBtn');
    const sbClient = window.sb;

    const state = {
      loading: false,
      items: [],
      userId: null,
      filters: {
        type: 'all',
        visibility: 'all',
        sort: 'latest'
      }
    };

    const FALLBACK_THUMB = './assets/sample-character-01.png';
    let toastTimer = null;

    function escapeHtml(value) {
      return (value || '')
        .toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function setEmptyVisible(visible) {
      if (!emptyEl) return;
      emptyEl.classList.toggle('is-visible', visible);
      listEl.style.display = visible ? 'none' : 'grid';
    }

    function updateCount(value) {
      if (countEl) countEl.textContent = Number(value || 0);
    }

    function normalizeVisibility(value) {
      const normalized = (value || '').toString().toLowerCase();
      if (normalized === 'public') return 'public';
      if (normalized === 'private') return 'private';
      if (normalized === 'draft') return 'draft';
      return 'private';
    }

    function inferType(character) {
      const meta = character?.metadata || {};
      const candidates = [meta.type, meta.content_type, meta.category, meta.kind, meta.context, meta.status]
        .map((item) => (typeof item === 'string' ? item.toLowerCase() : ''));
      if (candidates.some((value) => value.includes('story'))) return 'story';
      if (candidates.some((value) => value.includes('draft'))) return 'draft';
      if (candidates.some((value) => value.includes('scene'))) return 'story';
      if (character?.visibility === 'draft') return 'draft';
      if (Array.isArray(character?.tags)) {
        const tagBlob = character.tags.join(' ').toLowerCase();
        if (tagBlob.includes('스토리')) return 'story';
      }
      return 'character';
    }

    function normalizeTypeForFilter(type) {
      return type === 'draft' ? 'draft' : 'character';
    }

    function formatMetaValue(value, fallback) {
      if (!value) return fallback;
      return String(value);
    }

    function ensureToastContainer() {
      let el = document.getElementById('myWorksToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'myWorksToast';
        el.className = 'myworks-toast';
        document.body.appendChild(el);
      }
      return el;
    }

    function showWorksToast(message) {
      if (!message) return;
      const container = ensureToastContainer();
      container.textContent = message;
      container.classList.add('myworks-toast--visible');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        container.classList.remove('myworks-toast--visible');
      }, 3200);
    }

    function renderVisibilityControl(work) {
      const visibility = normalizeVisibility(work.visibility);
      if (visibility === 'draft') {
        return `
          <div class="visibility-toggle visibility-toggle--disabled" data-draft-toggle="true">
            <span class="visibility-toggle__track" data-draft-toggle="true"></span>
            <span class="visibility-toggle__label" data-draft-toggle="true">임시 저장</span>
          </div>
        `;
      }
      const isPublic = visibility === 'public';
      return `
        <label class="visibility-toggle">
          <input type="checkbox" class="visibility-toggle__input" data-visibility-toggle="${work.id}" ${isPublic ? 'checked' : ''}>
          <span class="visibility-toggle__track"></span>
          <span class="visibility-toggle__label">${isPublic ? '공개' : '비공개'}</span>
        </label>
      `;
    }

    function renderWorkCard(work) {
      const card = document.createElement('article');
      card.className = 'mywork-card';
      card.dataset.workId = work.id;
      const visibility = normalizeVisibility(work.visibility);
      const isDraft = visibility === 'draft';
      const thumb = escapeHtml(work.thumbnail_image_url || work.avatar_url || FALLBACK_THUMB);
      card.innerHTML = `
        <div class="mywork-card__header">
          <div class="mywork-card__info">
            <div class="mywork-thumb">
              <img src="${thumb}" alt="${escapeHtml(work.name || '캐릭터')}" loading="lazy" />
            </div>
            <div class="mywork-card__title-block">
              <div class="mywork-title">${escapeHtml(work.name || '제목 미정')}</div>
              <div class="mywork-meta-row">
                <span class="mywork-meta-item">장르 ${escapeHtml(formatMetaValue(work.genre, '미정'))}</span>
                <span class="mywork-meta-item">타깃 ${escapeHtml(formatMetaValue(work.target, '미정'))}</span>
              </div>
            </div>
          </div>
          ${renderVisibilityControl(work)}
        </div>
        <div class="mywork-actions">
          <div class="mywork-action-group">
            <button class="mywork-action-btn" data-work-action="edit" data-work-id="${work.id}">${isDraft ? '캐릭터 완성하기' : '수정'}</button>
          </div>
          <button class="mywork-action-btn mywork-action-btn--danger" data-work-action="delete" data-work-id="${work.id}">삭제</button>
        </div>
      `;
      return card;
    }

    function applyFilters() {
      const { type, visibility, sort } = state.filters;
      let list = [...state.items];
      if (type !== 'all') {
        list = list.filter((item) => normalizeTypeForFilter(inferType(item)) === type);
      }
      if (visibility !== 'all') {
        list = list.filter((item) => normalizeVisibility(item.visibility) === visibility);
      }
      list.sort((a, b) => {
        if (sort === 'oldest') {
          return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        }
        if (sort === 'popular') {
          return Number(b.like_count || 0) - Number(a.like_count || 0);
        }
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      });
      return list;
    }

    function renderList() {
      if (!listEl) return;
      if (state.loading) {
        listEl.innerHTML = '<div class="myworks-loading">작품을 불러오는 중입니다...</div>';
        setEmptyVisible(false);
        updateCount(0);
        return;
      }
      const filtered = applyFilters();
      updateCount(filtered.length);
      listEl.innerHTML = '';
      if (!filtered.length) {
        setEmptyVisible(true);
        return;
      }
      setEmptyVisible(false);
      filtered.forEach((work) => listEl.appendChild(renderWorkCard(work)));
    }

    async function ensureAuthenticated() {
      if (!sbClient?.auth) {
        listEl.innerHTML = '<div class="myworks-loading">Supabase 클라이언트를 초기화할 수 없습니다.</div>';
        return false;
      }
      const requireLogin = window.requireLogin || (async () => false);
      const ok = await requireLogin({ redirect: window.location.href });
      if (!ok) {
        listEl.innerHTML = '<div class="myworks-loading">로그인 후 작품을 확인할 수 있습니다.</div>';
        return false;
      }
      try {
        const { data } = await sbClient.auth.getSession();
        state.userId = data?.session?.user?.id || null;
        return !!state.userId;
      } catch (err) {
        console.warn('session fetch failed', err);
        return false;
      }
    }

    async function fetchMyWorks() {
      if (!sbClient) {
        listEl.innerHTML = '<div class="myworks-loading">Supabase 연결을 확인해 주세요.</div>';
        return;
      }
      state.loading = true;
      renderList();
      try {
        const { data, error } = await sbClient
          .from('characters')
          .select(
            `id, owner_id, name, one_line, description, genre, target, visibility, metadata, tags, like_count, view_count, created_at, avatar_url, thumbnail_image_url, is_monetized`
          )
          .eq('owner_id', state.userId)
          .order('created_at', { ascending: false });
        if (error) throw error;
        state.items = data || [];
      } catch (err) {
        console.error('fetchMyWorks error', err);
        listEl.innerHTML = '<div class="myworks-loading">작품을 불러오지 못했습니다.</div>';
        setEmptyVisible(false);
        state.items = [];
      } finally {
        state.loading = false;
        renderList();
      }
    }

    async function toggleVisibility(workId, desiredState) {
      const target = state.items.find((item) => item.id === workId);
      if (!target) return;
      const current = normalizeVisibility(target.visibility);
      if (current === 'draft') {
        renderList();
        return;
      }
      const next = desiredState || (current === 'public' ? 'private' : 'public');
      if (next === current) {
        renderList();
        return;
      }
      try {
        const { error } = await sbClient
          .from('characters')
          .update({ visibility: next })
          .eq('id', workId)
          .eq('owner_id', state.userId);
        if (error) throw error;
        target.visibility = next;
        renderList();
      } catch (err) {
        console.error('toggle visibility failed', err);
        alert('공개 여부를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        renderList();
      }
    }

    function handleEdit(workId) {
      if (!workId) return;
      const url = `/create-character?id=${encodeURIComponent(workId)}`;
      window.location.href = url;
    }

    async function handleDelete(workId) {
      if (!workId) return;
      if (!confirm('정말 삭제할까요? 삭제 후에는 되돌릴 수 없습니다.')) return;
      try {
        const { error } = await sbClient
          .from('characters')
          .delete()
          .eq('id', workId)
          .eq('owner_id', state.userId);
        if (error) throw error;
        state.items = state.items.filter((item) => item.id !== workId);
        renderList();
      } catch (err) {
        console.error('delete work failed', err);
        alert('작품 삭제에 실패했습니다.');
      }
    }

    function bindActionHandlers() {
      listEl.addEventListener('click', (event) => {
        const actionBtn = event.target.closest('[data-work-action]');
        if (!actionBtn) return;
        const workId = actionBtn.dataset.workId;
        const action = actionBtn.dataset.workAction;
        if (!workId || !action) return;
        if (action === 'edit') {
          handleEdit(workId);
        } else if (action === 'delete') {
          handleDelete(workId);
        }
      });
      listEl.addEventListener('change', (event) => {
        const input = event.target.closest('[data-visibility-toggle]');
        if (!input) return;
        if (input.disabled) {
          event.preventDefault();
          input.checked = !input.checked;
          return;
        }
        const workId = input.dataset.visibilityToggle;
        if (!workId) return;
        const nextState = input.checked ? 'public' : 'private';
        toggleVisibility(workId, nextState);
      });
      listEl.addEventListener('click', (event) => {
        const disabledToggle = event.target.closest('[data-draft-toggle]');
        if (!disabledToggle) return;
        event.preventDefault();
        showWorksToast('임시 저장 콘텐츠는 캐릭터 제작 완료 후 공개할 수 있어요.');
      });
    }

    function bindFilterControls() {
      const typeChips = document.querySelectorAll('[data-filter-type]');
      typeChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          typeChips.forEach((c) => c.classList.remove('chip--active'));
          chip.classList.add('chip--active');
          state.filters.type = chip.dataset.filterType || 'all';
          renderList();
        });
      });

      const visibilityChips = document.querySelectorAll('[data-visibility]');
      visibilityChips.forEach((chip) => {
        chip.addEventListener('click', () => {
          visibilityChips.forEach((c) => c.classList.remove('chip--active'));
          chip.classList.add('chip--active');
          state.filters.visibility = chip.dataset.visibility || 'all';
          renderList();
        });
      });

      if (sortSelect) {
        sortSelect.addEventListener('change', (event) => {
          state.filters.sort = event.target.value || 'latest';
          renderList();
        });
      }

      const goCreate = () => {
        window.location.href = '/create-character';
      };
      if (createBtn && !createBtn.dataset.bound) {
        createBtn.addEventListener('click', goCreate);
        createBtn.dataset.bound = '1';
      }
      if (emptyBtn && !emptyBtn.dataset.bound) {
        emptyBtn.addEventListener('click', goCreate);
        emptyBtn.dataset.bound = '1';
      }
    }

    async function init() {
      bindFilterControls();
      bindActionHandlers();
      const authenticated = await ensureAuthenticated();
      if (!authenticated) return;
      await fetchMyWorks();
    }

    init();
  });
})();
