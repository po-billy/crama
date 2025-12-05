/* Global Supabase client */
const runtimeEnv = window.__ENV__ || {};
const SUPABASE_URL = runtimeEnv.SUPABASE_URL || runtimeEnv.PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY =
  runtimeEnv.SUPABASE_ANON_KEY || runtimeEnv.PUBLIC_SUPABASE_ANON_KEY || '';
const API_BASE_URL = (runtimeEnv.API_BASE_URL || '').replace(/\/+$/, '');

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 환경 변수가 누락되었습니다. /env.js 설정을 확인하세요.');
}

function resolveApiUrl(path) {
  if (!path || /^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

function apiFetch(path, options) {
  const target = resolveApiUrl(path);
  return fetch(target || path, options);
}

window.apiFetch = apiFetch;
window.resolveApiUrl = resolveApiUrl;

if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else if (!window.sb) {
  window.sb = null;
}
const sb = window.sb;

async function loadHead() {
  try {
    const res = await fetch('./partials/head.html');
    const html = await res.text();
    document.head.insertAdjacentHTML('afterbegin', html);
  } catch (e) {
    console.error('head.html load failed', e);
  }
}


async function initSidebar() {
  const container = document.getElementById('sidebar-container');
  if (!container) return;
  try {
    const res = await fetch('./partials/sidebar.html');
    container.innerHTML = await res.text();
    const currentPage = document.body.dataset.page;
    if (currentPage) {
      const activeItem = container.querySelector(`.side-item[data-page="${currentPage}"]`);
      if (activeItem) activeItem.classList.add('active');
    }
    updateSidebarUserInfo();
    setupAccountPopover();
  } catch (e) {
    console.error('sidebar load failed', e);
  }
}

async function initDrawer() {
  const container = document.getElementById('drawer-container');
  if (!container) return;
  try {
    const res = await fetch('./partials/drawer.html');
    container.innerHTML = await res.text();
  } catch (e) {
    console.error('drawer load failed', e);
    return;
  }

  const drawer = document.getElementById('globalDrawer');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const mobileNavBtn = document.getElementById('mobileNavBtn');
  const drawerList = document.getElementById('drawerList');
  const drawerEmpty = document.getElementById('drawerEmpty');
  const tabButtons = drawer ? drawer.querySelectorAll('.drawer-tab') : [];
  if (!drawer || !drawerList || !drawerEmpty) return;

  drawerCloseBtn?.addEventListener('click', () => drawer.classList.add('drawer-hidden'));
  mobileNavBtn?.addEventListener('click', () => drawer.classList.toggle('drawer-hidden'));

  const currentPage = document.body.dataset.page;
  if (currentPage) {
    const activeNav = drawer.querySelector(`.drawer-nav-item[data-page="${currentPage}"]`);
    activeNav?.classList.add('active');
  }

  function getLocalHistory() {
    try {
      const raw = localStorage.getItem('seobaHistory');
      if (!raw) return { images: [], chats: [] };
      const data = JSON.parse(raw);
      return { images: data.images || [], chats: data.chats || [] };
    } catch (e) {
      console.error('local history parse error', e);
      return { images: [], chats: [] };
    }
  }

  async function fetchDbImages() {
    try {
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !sessionData.session) return [];
      const userId = sessionData.session.user.id;
      const { data, error } = await sb
        .from('user_contents')
        .select('id, kind, title, prompt, thumb_url, created_at, service_code')
        .eq('user_id', userId)
        .eq('kind', 'image')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) {
        console.error('user_contents fetch error', error);
        return [];
      }
      return (data || []).map((row) => ({
        source: 'db',
        id: row.id,
        kind: row.kind,
        title:
          row.title ||
          (row.prompt && row.prompt.slice(0, 20) + (row.prompt.length > 20 ? '...' : '')) ||
          'content',
        subtitle: row.created_at ? new Date(row.created_at).toLocaleDateString('ko-KR') : '',
        thumbUrl: row.thumb_url || row.full_url,
        serviceCode: row.service_code,
      }));
    } catch (e) {
      console.error('fetchDbImages error', e);
      return [];
    }
  }

  async function fetchDbChats() {
    try {
      const { data: sessionData, error: sessionError } = await sb.auth.getSession();
      if (sessionError || !sessionData.session) return [];
      const userId = sessionData.session.user.id;

      const { data, error } = await sb
        .from('character_chats')
        .select('id, character_id, content, created_at, characters(name, avatar_url)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('character_chats fetch error', error);
        return [];
      }

      // Show the most recent chat per character
      const seen = new Set();
      const rows = data || [];
      const uniqueByCharacter = [];
      for (const row of rows) {
        if (!row?.character_id || seen.has(row.character_id)) continue;
        seen.add(row.character_id);
        uniqueByCharacter.push(row);
      }

      return uniqueByCharacter.map((row) => ({
        source: 'db',
        kind: 'chat',
        id: row.character_id,
        characterId: row.character_id,
        title: row.characters?.name || 'Character chat',
        subtitle:
          (row.content && row.content.slice(0, 30) + (row.content.length > 30 ? '...' : '')) ||
          (row.created_at ? new Date(row.created_at).toLocaleDateString('ko-KR') : ''),
        thumbUrl: row.characters?.avatar_url || null,
      }));
    } catch (e) {
      console.error('fetchDbChats error', e);
      return [];
    }
  }

  async function renderDrawerList(activeTab = 'all') {
    const { images, chats } = getLocalHistory();
    const localItems = [];

    (chats || []).forEach((c) =>
      localItems.push({
        source: 'local',
        kind: 'chat',
        id: c.character_id || c.id,
        characterId: c.character_id || c.id,
        title: c.title || 'Character chat',
        subtitle: c.date || '',
      })
    );
    (images || []).forEach((img) =>
      localItems.push({
        source: 'local',
        kind: 'image',
        id: img.id,
        title: img.title || img.prompt || 'Image generation',
        subtitle: img.createdAt ? new Date(img.createdAt).toLocaleDateString() : '',
        thumbUrl: img.thumbUrl || img.url,
      })
    );

    const [dbImages, dbChats] = await Promise.all([fetchDbImages(), fetchDbChats()]);
    const merged = [...dbImages, ...dbChats, ...localItems];
    const seen = new Set();
    const items = merged.filter((item) => {
      const key = `${item.kind}-${item.id || ''}`;
      const thumbKey =
        item.kind === 'image' && (item.thumbUrl || item.full_url || item.url)
          ? `${item.kind}-thumb-${item.thumbUrl || item.full_url || item.url}`
          : null;
      if (seen.has(key) || (thumbKey && seen.has(thumbKey))) return false;
      seen.add(key);
      if (thumbKey) seen.add(thumbKey);
      return true;
    });

    const filtered = items.filter((item) => {
      if (activeTab === 'all') return ['image', 'chat'].includes(item.kind);
      if (activeTab === 'image') return item.kind === 'image';
      if (activeTab === 'chat') return item.kind === 'chat';
      return true;
    });

    drawerList.innerHTML = '';
    if (!filtered.length) {
      drawerEmpty.style.display = 'block';
      return;
    }
    drawerEmpty.style.display = 'none';

    const imagesOnly = filtered.filter((i) => i.kind === 'image');
    const chatsOnly = filtered.filter((i) => i.kind === 'chat');

    function renderSection(title, arr, kind) {
      const section = document.createElement('div');
      section.className = 'drawer-group';
      const heading = document.createElement('div');
      heading.className = 'drawer-section-title';
      heading.textContent = title;
      section.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'drawer-sublist';

      arr.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'drawer-item';
        btn.dataset.kind = item.kind;
        btn.dataset.id = item.id;

        const thumb =
          item.kind === 'image' && item.thumbUrl
            ? `<img src="${item.thumbUrl}" alt="thumb" />`
            : item.kind === 'chat' && item.thumbUrl
            ? `<img src="${item.thumbUrl}" alt="avatar" />`
            : item.kind === 'chat'
            ? 'Chat'
            : 'Content';

        btn.innerHTML = `
        <div class="drawer-thumb">${thumb}</div>
        <div class="drawer-meta">
          <div class="drawer-title">${item.title}</div>
          <div class="drawer-subline">${item.subtitle || ''}</div>
        </div>
        <div class="drawer-type-badge">
          ${item.kind === 'image' ? 'Image' : 'Chat'}
        </div>
      `;

        btn.addEventListener('click', () => {
          if (item.kind === 'image') {
            openDrawerImageModal(imagesOnly, item.id);
          } else if (item.kind === 'chat') {
            const targetId = item.characterId || item.id;
            window.location.href = `/character?id=${targetId}`;
          }
        });

        list.appendChild(btn);
      });

      section.appendChild(list);
      drawerList.appendChild(section);
    }

    if (activeTab === 'all') {
      renderSection('최근 이미지', imagesOnly, 'image');
      renderSection('최근 채팅', chatsOnly, 'chat');
    } else if (activeTab === 'image') {
      renderSection('최근 이미지', imagesOnly, 'image');
    } else {
      renderSection('최근 채팅', chatsOnly, 'chat');
    }
  }
  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.getAttribute('data-drawer-tab') || 'all';
      renderDrawerList(tab);
    });
  });

  renderDrawerList('all');
}

async function updateSectionNickname() {
  const target = document.getElementById('sectionNickname');
  if (!target) return;
  try {
    const context = await fetchUserContext();
    const nickname = context?.profile?.display_name || context?.profile?.handle || context?.user?.email;
    if (nickname) {
      target.textContent = nickname;
    }
  } catch (e) {
    console.warn('updateSectionNickname failed', e);
  }
}

// Global image modal for drawer
function ensureDrawerModal() {
  let modal = document.getElementById('drawerImageModal');
  if (modal) return modal;
  const html = `
    <div class="drawer-image-modal hidden" id="drawerImageModal">
      <div class="dim"></div>
      <div class="modal-inner">
        <button class="close-btn" id="drawerImageClose" aria-label="닫기">×</button>
        <button class="nav-btn prev" id="drawerImagePrev" aria-label="이전">‹</button>
        <button class="nav-btn next" id="drawerImageNext" aria-label="다음">›</button>
        <div class="image-frame">
          <img id="drawerImageViewer" alt="generated" />
        </div>
        <div class="modal-actions">
          <a id="drawerImageDownload" class="btn btn-ghost" download>다운로드</a>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', html);
  modal = document.getElementById('drawerImageModal');
  const closeBtn = document.getElementById('drawerImageClose');
  const dim = modal.querySelector('.dim');
  [closeBtn, dim].forEach((el) => el?.addEventListener('click', () => modal.classList.add('hidden')));
  return modal;
}

function openDrawerImageModal(imageItems, startId) {
  const modal = ensureDrawerModal();
  const viewer = document.getElementById('drawerImageViewer');
  const download = document.getElementById('drawerImageDownload');
  const prev = document.getElementById('drawerImagePrev');
  const next = document.getElementById('drawerImageNext');

  const onlyImages = (imageItems || []).filter((i) => i && i.thumbUrl);
  if (!onlyImages.length) return;
  let idx = Math.max(
    0,
    onlyImages.findIndex((i) => String(i.id) === String(startId) || i.id === startId)
  );

  const show = (i) => {
    const item = onlyImages[i];
    if (!item) return;
    viewer.src = item.thumbUrl;
    download.href = item.thumbUrl;
    modal.classList.remove('hidden');
  };

  if (prev) {
    prev.onclick = () => {
      idx = (idx - 1 + onlyImages.length) % onlyImages.length;
      show(idx);
    };
  }
  if (next) {
    next.onclick = () => {
      idx = (idx + 1) % onlyImages.length;
      show(idx);
    };
  }

  show(idx);
}

async function fetchUserContext() {
  if (!window.sb || !sb?.auth) return null;

  const { data: sessionData, error: sessionError } = await sb.auth.getSession();
  if (sessionError || !sessionData?.session) return null;

  const user = sessionData.session.user;

  // Fetch related rows in parallel; if one fails, fall back to null.
  async function fetchSingle(table, column, value) {
    try {
      const { data, error } = await sb.from(table).select('*').eq(column, value).limit(1);
      if (error) throw error;
      return data && data.length ? data[0] : null;
    } catch (e) {
      console.warn(`${table} fetch error`, e);
      return null;
    }
  }

  const [profile, wallet, subscription] = await Promise.all([
    fetchSingle('profiles', 'id', user.id),
    fetchSingle('credit_wallets', 'user_id', user.id),
    fetchSingle('subscriptions', 'user_id', user.id),
  ]);

  // Auto-assign handle if missing
  if (!profile?.handle) {
    try {
      const res = await apiFetch('/api/profile/ensure-handle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const json = await res.json().catch(() => null);
      if (json?.handle) {
        profile.handle = json.handle;
        profile.handle_updated_at = new Date().toISOString();
      }
    } catch (e) {
      console.warn('ensure-handle failed', e);
    }
  }

  return { user, profile, wallet, subscription };
}

async function updateSidebarUserInfo() {
  const creditsEl = document.getElementById('sidebarCredits');
  const avatarBtn = document.getElementById('sidebarAvatar');
  const avatarText = document.getElementById('sidebarAvatarText');
  const accountName = document.getElementById('accountName');
  const accountCredits = document.getElementById('accountCredits');
  const accountAvatarCircle = document.getElementById('accountAvatarCircle');

  let ctx = null;
  try {
    ctx = await fetchUserContext();
  } catch (e) {
    console.error('fetchUserContext error', e);
  }

  if (!ctx || !ctx.user) {
    if (creditsEl) creditsEl.textContent = '-';
    if (avatarText) avatarText.textContent = '로그인';
    if (accountName) accountName.textContent = '로그인이 필요합니다';
    if (accountCredits) accountCredits.textContent = '-';
    if (accountAvatarCircle) accountAvatarCircle.textContent = '로그인';

    if (avatarBtn && !avatarBtn.dataset.loginBound) {
      avatarBtn.addEventListener('click', () => {
        window.location.href = '/login';
      });
      avatarBtn.dataset.loginBound = '1';
    }
    return;
  }

  const displayName =
    ctx.profile?.display_name ||
    ctx.user.user_metadata?.name ||
    ctx.user.email?.split('@')[0] ||
    '사용자';
  const shortName = displayName.length <= 2 ? displayName : displayName.slice(-2);
  const credits = ctx.wallet?.balance ?? ctx.profile?.current_credits ?? 0;

  if (creditsEl) creditsEl.textContent = `${credits.toLocaleString('ko-KR')} scene`;
  if (avatarText) avatarText.textContent = displayName;
  if (accountName) accountName.textContent = displayName;
  if (accountCredits) accountCredits.textContent = credits.toLocaleString('ko-KR');
  if (accountAvatarCircle) accountAvatarCircle.textContent = shortName;
}

function setupAccountPopover() {
  const avatarBtn = document.getElementById('sidebarAvatar');
  const popover = document.getElementById('accountPopover');
  if (!avatarBtn || !popover || avatarBtn.dataset.popoverBound) return;

  avatarBtn.dataset.popoverBound = '1';

  const closePopover = () => popover.classList.remove('open');
  const togglePopover = () => popover.classList.toggle('open');

  avatarBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover();
  });

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && e.target !== avatarBtn) {
      closePopover();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePopover();
  });

  const logoutBtn = document.getElementById('accountLogout');
  if (logoutBtn && !logoutBtn.dataset.logoutBound) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await sb.auth.signOut();
      } catch (e) {
        console.error('logout error', e);
      }
      window.location.href = '/';
    });
    logoutBtn.dataset.logoutBound = '1';
  }

  document.querySelectorAll('[data-account-link]').forEach((btn) => {
    if (btn.dataset.linkBound) return;
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-account-link');
      if (target === 'credits' && typeof window.openCreditUpsell === 'function') {
        window.openCreditUpsell();
        return;
      }
      if (target) {
        const cleanTarget = target.startsWith('/') ? target : `/${target}`;
        window.location.href = cleanTarget === '/home' ? '/' : cleanTarget;
      }
    });
    btn.dataset.linkBound = '1';
  });
}

async function loadCreditUpsellPartial() {
  if (document.getElementById('creditUpsellModal')) return;
  try {
    const res = await fetch('./partials/credit-upsell.html');
    if (!res.ok) return;
    const html = await res.text();
    document.body.insertAdjacentHTML('beforeend', html);

    const modal = document.getElementById('creditUpsellModal');
    const closeBtn = document.querySelector('[data-credit-upsell-close]');
    const closeHandler =
      typeof window.closeCreditUpsell === 'function'
        ? window.closeCreditUpsell
        : () => modal?.classList.add('hidden');

    if (closeBtn && !closeBtn.dataset.cuBound) {
      closeBtn.addEventListener('click', closeHandler);
      closeBtn.dataset.cuBound = '1';
    }
    if (modal && !modal.dataset.backdropBound) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeHandler();
      });
      modal.dataset.backdropBound = '1';
    }
  } catch (e) {
    console.error('credit upsell partial load failed', e);
  }
}

// expose helpers to other scripts
window.fetchUserContext = fetchUserContext;
window.updateSidebarUserInfo = updateSidebarUserInfo;
window.setupAccountPopover = setupAccountPopover;
window.loadCreditUpsellPartial = loadCreditUpsellPartial;
window.openDrawerImageModal = openDrawerImageModal;

document.addEventListener('DOMContentLoaded', () => {
  loadHead();
  initSidebar();
  initDrawer();
  updateSectionNickname();
});

/* Credit Upsell Partial */
