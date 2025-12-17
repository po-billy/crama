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

function toggleVisibility(el, shouldShow) {
  if (!el) return;
  if (shouldShow) el.classList.remove('is-hidden');
  else el.classList.add('is-hidden');
}

function ensureTopUserControls() {
  const topBar = document.querySelector('.top-bar');
  if (!topBar) return;
  let right = topBar.querySelector('.top-bar-right');
  if (!right) {
    right = document.createElement('div');
    right.className = 'top-bar-right';
    topBar.appendChild(right);
  }
  if (!document.getElementById('topLoginBtn')) {
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.id = 'topLoginBtn';
    loginBtn.className = 'top-login-btn';
    loginBtn.textContent = '로그인';
    right.appendChild(loginBtn);
  }
  const chip = document.getElementById('topUserChip');
  if (chip) chip.remove();
}

function applyAvatarVisual(target, url, fallbackText = '', options = {}) {
  if (!target) return;
  const safeUrl = typeof url === 'string' && url.trim() ? url.trim() : '';
  const safeFallback = fallbackText || '';
  const setText = options.keepText !== true;
  const setAria = options.setAria !== false;

  if (safeUrl) {
    const sanitized = safeUrl.replace(/(["'()])/g, '\\$1');
    target.style.backgroundImage = `url("${sanitized}")`;
    target.classList.add('has-image');
    if (setText) target.textContent = '';
    if (setAria && safeFallback) {
      target.setAttribute('aria-label', safeFallback);
    }
  } else {
    target.style.backgroundImage = '';
    target.classList.remove('has-image');
    if (setText) target.textContent = safeFallback;
    if (setAria) {
      if (safeFallback) target.setAttribute('aria-label', safeFallback);
      else target.removeAttribute('aria-label');
    }
  }
}

function getPreferredUserNickname(context) {
  if (!context) return '사용자';
  return (
    context.profile?.handle ||
    context.profile?.display_name ||
    context.user?.user_metadata?.user_name ||
    context.user?.user_metadata?.name ||
    context.user?.email?.split('@')[0] ||
    '사용자'
  );
}

window.apiFetch = apiFetch;
window.resolveApiUrl = resolveApiUrl;

if (typeof supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.error('Supabase 클라이언트 생성에 실패했습니다.', err);
    window.sb = null;
  }
} else if (!window.sb) {
  window.sb = null;
}
const sb = window.sb;

function clearOAuthHash() {
  const hash = window.location.hash || '';
  if (!hash || hash === '#') return;
  const hasOAuthParams = /(access_token|refresh_token|error_description|type)=/i.test(hash);
  if (!hasOAuthParams) return;
  try {
    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, document.title, cleanUrl);
  } catch (err) {
    console.warn('failed to clear oauth hash', err);
  }
}

if (sb?.auth) {
  sb.auth.getSession().finally(() => {
    clearOAuthHash();
  });
}

const loginModalState = {
  redirect: null,
  fromStandalone: false,
  modal: null,
  statusEl: null,
  isOpen: false,
};
let loginModalLoadPromise = null;

function fallbackLoginRedirect(redirect) {
  const search = redirect ? `?redirect=${encodeURIComponent(redirect)}` : '';
  window.location.href = `/login${search}`;
}

function bindLoginAuthListener() {
  if (!window.sb?.auth || window.sb.auth.__loginModalBound) return;
  window.sb.auth.__loginModalBound = true;
  window.sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      handleLoginSuccess();
    }
  });
}

function setLoginStatus(message, variant = '') {
  if (!loginModalState.statusEl) return;
  loginModalState.statusEl.textContent = message || '';
  loginModalState.statusEl.classList.remove('error', 'success', 'muted');
  if (variant) loginModalState.statusEl.classList.add(variant);
}

function closeLoginModal(options = {}) {
  const modal = loginModalState.modal;
  if (!modal) return;
  modal.classList.add('login-modal--hidden');
  modal.setAttribute('aria-hidden', 'true');
  setLoginStatus('');
  loginModalState.isOpen = false;
  if (!options.preserveContext) {
    loginModalState.redirect = null;
    loginModalState.fromStandalone = false;
  }
}

function handleLoginSuccess() {
  if (!loginModalState.isOpen && !loginModalState.fromStandalone) {
    return;
  }
  setLoginStatus('로그인이 완료되었습니다.', 'success');
  setTimeout(() => {
    const target = loginModalState.redirect;
    const shouldReload = !target || target === window.location.href;
    closeLoginModal({ preserveContext: true });
    loginModalState.redirect = null;
    loginModalState.fromStandalone = false;
    if (shouldReload) {
      window.location.reload();
      return;
    }
    window.location.assign(target);
  }, 700);
}

async function handleGoogleLogin() {
  if (!window.sb?.auth) {
    setLoginStatus('Supabase 클라이언트를 초기화할 수 없습니다.', 'error');
    fallbackLoginRedirect(loginModalState.redirect);
    return;
  }
  setLoginStatus('Google 로그인 창을 여는 중...', 'muted');
  try {
    await window.sb.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: loginModalState.redirect || window.location.origin,
      },
    });
  } catch (error) {
    console.error('login modal oauth error', error);
    setLoginStatus(error?.message || '로그인 중 오류가 발생했습니다.', 'error');
  }
}

function initLoginModal() {
  const modal = document.getElementById('loginModal');
  if (!modal || modal.dataset.loginReady) return;
  loginModalState.modal = modal;
  loginModalState.statusEl = modal.querySelector('#loginModalStatus');
  modal.querySelectorAll('[data-login-close]').forEach((btn) => {
    btn.addEventListener('click', () => closeLoginModal());
  });
  const googleBtn = modal.querySelector('#loginModalGoogleBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', () => handleGoogleLogin());
  }
  modal.dataset.loginReady = '1';
  bindLoginAuthListener();
}

function ensureLoginModalLoaded() {
  if (loginModalLoadPromise) return loginModalLoadPromise;
  loginModalLoadPromise = (async () => {
    if (document.getElementById('loginModal')) {
      initLoginModal();
      return;
    }
    try {
      const res = await fetch('./partials/login-modal.html');
      const html = await res.text();
      document.body.insertAdjacentHTML('beforeend', html);
      initLoginModal();
    } catch (e) {
      console.error('login modal load failed', e);
      loginModalLoadPromise = null;
    }
  })();
  return loginModalLoadPromise;
}

async function openLoginModal(options = {}) {
  loginModalState.redirect = options.redirect || window.location.href;
  loginModalState.fromStandalone = options.fromStandalone || false;
  await ensureLoginModalLoaded();
  const modal = loginModalState.modal;
  if (!modal) {
    fallbackLoginRedirect(loginModalState.redirect);
    return;
  }
  setLoginStatus('');
  modal.classList.remove('login-modal--hidden');
  modal.setAttribute('aria-hidden', 'false');
  loginModalState.isOpen = true;
}

async function requireLogin(options = {}) {
  if (!window.sb?.auth) {
    await openLoginModal(options);
    return false;
  }
  try {
    const { data } = await window.sb.auth.getSession();
    if (data?.session) return true;
  } catch (err) {
    console.warn('requireLogin session check failed', err);
  }
  await openLoginModal(options);
  return false;
}

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
    updateSidebarUserInfo();
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

  async function renderDrawerList(activeTab = 'chat') {
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

    if (activeTab === 'image') {
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

  renderDrawerList('chat');
}

async function updateSectionNickname() {
  const target = document.getElementById('sectionNickname');
  if (!target) return;
  try {
    const context = await fetchUserContext();
    const nickname = getPreferredUserNickname(context);
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

function ensureDrawerAccountCardNav(card) {
  if (!card || card.dataset.cardNavBound) return;
  const handleActivation = (event) => {
    if (card.classList.contains('needs-login')) return;
    if (event.type === 'keydown') {
      const key = event.key || event.code;
      if (key !== 'Enter' && key !== ' ') return;
    }
    event.preventDefault();
    window.location.href = '/mypage';
  };
  card.addEventListener('click', handleActivation);
  card.addEventListener('keydown', handleActivation);
  card.dataset.cardNavBound = '1';
}

function setDrawerAccountCardInteractive(card, enabled) {
  if (!card) return;
  ensureDrawerAccountCardNav(card);
  if (enabled) {
    card.classList.add('is-link');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
  } else {
    card.classList.remove('is-link');
    card.removeAttribute('role');
    card.tabIndex = -1;
  }
}

async function updateSidebarUserInfo() {
  ensureTopUserControls();
  const creditsEl = document.getElementById('sidebarCredits');
  const avatarBtn = document.getElementById('sidebarAvatar');
  const accountName = document.getElementById('accountName');
  const accountCredits = document.getElementById('accountCredits');
  const accountAvatarCircle = document.getElementById('accountAvatarCircle');
  const topLoginBtn = document.getElementById('topLoginBtn');
  const sidebarAccountSection = document.getElementById('sidebarAccountSection');
  const sidebarLoginHint = document.getElementById('sidebarLoginHint');
  const drawerAccountCard = document.getElementById('drawerAccountCard');
  const drawerAccountName = document.getElementById('drawerAccountName');
  const drawerAccountCredits = document.getElementById('drawerAccountCredits');
  const drawerAccountAvatar = document.getElementById('drawerAccountAvatar');
  const drawerAccountAction = document.getElementById('drawerAccountAction');
  const drawerAccountHint = document.getElementById('drawerAccountHint');

  let ctx = null;
  try {
    ctx = await fetchUserContext();
  } catch (e) {
    console.error('fetchUserContext error', e);
  }

  if (topLoginBtn && !topLoginBtn.dataset.loginBound) {
    topLoginBtn.addEventListener('click', () => openLoginModal());
    topLoginBtn.dataset.loginBound = '1';
  }

  if (!ctx || !ctx.user) {
    if (creditsEl) creditsEl.textContent = '-';
    if (accountName) accountName.textContent = '로그인이 필요합니다';
    if (accountCredits) accountCredits.textContent = '-';
    applyAvatarVisual(avatarBtn, '', '게스트');
    applyAvatarVisual(accountAvatarCircle, '', '게스트');
    toggleVisibility(topLoginBtn, true);
    sidebarAccountSection?.classList.add('needs-login');
    if (sidebarLoginHint) sidebarLoginHint.textContent = '로그인하고 무료 Scene을 받으세요!';
    if (drawerAccountCard) drawerAccountCard.classList.add('needs-login');
    applyAvatarVisual(drawerAccountAvatar, '', '게스트');
    if (drawerAccountName) drawerAccountName.textContent = '로그인이 필요합니다';
    if (drawerAccountCredits) drawerAccountCredits.textContent = '-';
    if (drawerAccountHint) drawerAccountHint.textContent = '로그인하고 무료 Scene을 받으세요!';
    if (drawerAccountAction) {
      drawerAccountAction.textContent = '로그인하기';
      drawerAccountAction.onclick = () => {
        window.location.href = '/login';
      };
    }
    setDrawerAccountCardInteractive(drawerAccountCard, false);
    if (avatarBtn && !avatarBtn.dataset.loginBound) {
      avatarBtn.addEventListener('click', () => openLoginModal());
      avatarBtn.dataset.loginBound = '1';
    }
    return;
  }

  const displayName = getPreferredUserNickname(ctx);
  const shortName = displayName.length <= 2 ? displayName : displayName.slice(-2);
  const credits = ctx.wallet?.balance ?? ctx.profile?.current_credits ?? 0;
  const avatarUrl = ctx.profile?.avatar_url || ctx.user?.user_metadata?.avatar_url || '';

  if (creditsEl) creditsEl.textContent = `${credits.toLocaleString('ko-KR')} scene`;
  if (accountName) accountName.textContent = displayName;
  if (accountCredits) accountCredits.textContent = credits.toLocaleString('ko-KR');
  applyAvatarVisual(avatarBtn, avatarUrl, shortName);
  applyAvatarVisual(accountAvatarCircle, avatarUrl, shortName);
  applyAvatarVisual(drawerAccountAvatar, avatarUrl, shortName);
  if (drawerAccountName) drawerAccountName.textContent = displayName;
  if (drawerAccountCredits) drawerAccountCredits.textContent = credits.toLocaleString('ko-KR');
  if (drawerAccountHint) drawerAccountHint.textContent = '';
  if (drawerAccountCard) drawerAccountCard.classList.remove('needs-login');
  sidebarAccountSection?.classList.remove('needs-login');
  toggleVisibility(topLoginBtn, false);
  setDrawerAccountCardInteractive(drawerAccountCard, true);
  if (drawerAccountAction) {
    drawerAccountAction.onclick = null;
  }

  if (typeof window.activeCharacterId !== 'undefined' && typeof window.requestCharacterBackgroundReload === 'function') {
    window.requestCharacterBackgroundReload();
  }
}

async function performLogout() {
  try {
    await sb?.auth?.signOut();
  } catch (e) {
    console.error('logout error', e);
  }
  window.location.href = '/';
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
    logoutBtn.addEventListener('click', () => performLogout());
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
window.openLoginModal = openLoginModal;
window.requireLogin = requireLogin;

const URL_BAR_MEDIA_QUERY = '(max-width: 960px)';
function initMobileUrlBarHider() {
  if (window.__urlBarHiderInstance) return;
  const instance = {
    targetHeight: 0,
    resizeObserver: null,
  };
  window.__urlBarHiderInstance = instance;

  const state = {
    scheduled: false,
    meta: null,
    viewportUnit: 'vh',
  };
  const mediaQuery = window.matchMedia
    ? window.matchMedia(URL_BAR_MEDIA_QUERY)
    : { matches: window.innerWidth <= 960 };

  const shouldApply = () =>
    mediaQuery.matches && !window.matchMedia('(display-mode: standalone)').matches;

  const updateTargetHeight = () => {
    if (!shouldApply()) {
      instance.targetHeight = 0;
      return;
    }
    const viewportEl = document.documentElement;
    const height =
      typeof window.visualViewport?.height === 'number'
        ? window.visualViewport.height
        : viewportEl.clientHeight || window.innerHeight;
    instance.targetHeight = height;
    viewportEl.style.setProperty('--vh', `${height * 0.01}px`);
  };

  const ensureMetaTag = () => {
    if (state.meta) return;
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    state.meta = meta;
  };

  const applyViewportAdjustment = () => {
    state.scheduled = false;
    if (!shouldApply()) {
      if (state.meta) {
        state.meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, viewport-fit=cover'
        );
      }
      document.documentElement.classList.remove('url-bar-hidden');
      document.documentElement.style.removeProperty('--vh');
      return;
    }
    ensureMetaTag();
    updateTargetHeight();
    if (state.meta) {
      state.meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover'
      );
    }
    document.documentElement.classList.add('url-bar-hidden');
  };

  const scheduleAdjust = () => {
    if (state.scheduled) return;
    state.scheduled = true;
    window.requestAnimationFrame(applyViewportAdjustment);
  };

  if (window.visualViewport) {
    instance.resizeObserver = () => {
      updateTargetHeight();
      scheduleAdjust();
    };
    window.visualViewport.addEventListener('resize', instance.resizeObserver);
    window.visualViewport.addEventListener('scroll', instance.resizeObserver);
  }

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', scheduleAdjust);
  } else if (mediaQuery.addListener) {
    mediaQuery.addListener(scheduleAdjust);
  }

  window.addEventListener('orientationchange', () => setTimeout(scheduleAdjust, 150));
  window.addEventListener('focus', scheduleAdjust);
  window.addEventListener('resize', scheduleAdjust);
  window.addEventListener('scroll', () => {
    if (!shouldApply()) return;
    scheduleAdjust();
  });

  window.addEventListener('load', () => setTimeout(scheduleAdjust, 200));
  scheduleAdjust();
}

async function initMobileTabbar() {
  if (document.getElementById('mobileTabbar')) return;
  try {
    const res = await fetch('./partials/tabbar.html');
    if (!res.ok) return;
    const html = await res.text();
    document.body.insertAdjacentHTML('beforeend', html);
  } catch (e) {
    console.error('tabbar load failed', e);
    return;
  }
  const bar = document.getElementById('mobileTabbar');
  if (!bar) return;
  const currentPage = document.body.dataset.page || '';
  const tabMap = {
    home: ['home', 'index'],
    chat: ['characters', 'character'],
    create: ['studio', 'create-character'],
    mypage: ['mypage'],
  };
  Object.entries(tabMap).forEach(([key, list]) => {
    if (list.includes(currentPage)) {
      const btn = bar.querySelector(`[data-tab="${key}"]`);
      btn?.classList.add('tabbar-btn--active');
    }
  });
  bar.querySelectorAll('.tabbar-btn').forEach((btn) => {
    const tab = btn.dataset.tab;
    if (tab === 'create') return;
    const target = btn.dataset.target;
    if (!target || btn.dataset.tabBound) return;
    btn.addEventListener('click', () => {
      window.location.href = target;
    });
    btn.dataset.tabBound = '1';
  });
  const overlay = document.getElementById('tabbarOverlay');
  const sheet = document.getElementById('tabbarCreateSheet');
  const cancel = document.getElementById('tabbarCreateCancel');
  const createBtn = bar.querySelector('[data-tab="create"]');
  const closeSheet = () => {
    sheet?.classList.add('hidden');
    overlay?.classList.add('hidden');
  };
  const openSheet = () => {
    sheet?.classList.remove('hidden');
    overlay?.classList.remove('hidden');
  };
  createBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    openSheet();
  });
  overlay?.addEventListener('click', closeSheet);
  cancel?.addEventListener('click', closeSheet);
  sheet?.querySelectorAll('[data-target]').forEach((btn) => {
    if (btn.dataset.sheetBound) return;
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      if (target) window.location.href = target;
    });
    btn.dataset.sheetBound = '1';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadHead();
  ensureTopUserControls();
  initSidebar();
  initDrawer();
  initMobileTabbar();
  updateSectionNickname();
  ensureLoginModalLoaded();
  updateSidebarUserInfo();
  initMobileUrlBarHider();
});

/* Credit Upsell Partial */
