document.addEventListener('DOMContentLoaded', () => {
  initCreatorPage();
});

const PLACEHOLDER_AVATAR = './assets/sample-character-01.png';
const PLACEHOLDER_IMAGE = './assets/og-default.png';
const creatorApiFetch = window.apiFetch || ((...args) => fetch(...args));
const FEED_API_UNAVAILABLE_ERROR = 'feed_api_unavailable';
const FEED_UNAVAILABLE_MESSAGE = '피드 기능은 준비 중입니다. 잠시 후 다시 이용해주세요.';
const FOLLOW_TABLE = 'follows';
const AVATAR_BUCKET = 'character_profile';

const creatorPageState = {
  targetUserId: null,
  viewerUserId: null,
  isSelf: false,
  isLoggedIn: false,
  following: false,
  followerCount: 0,
  followingCount: 0,
  workTab: 'characters',
  charactersEmpty: false,
  profileData: null,
  targetDisplayName: '작가',
  shareData: null,
  feed: {
    posts: [],
    nextCursor: null,
    loading: false,
    editingPostId: null,
    initialized: false,
    loadingDetail: false,
    apiAvailable: true,
  },
};

let currentFeedDetail = null;
const toDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

async function uploadAvatarFile(file, targetUserId) {
  const dataUrl = await toDataUrl(file);
  const res = await creatorApiFetch('/api/upload/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataUrl,
      fileName: file.name,
      bucket: AVATAR_BUCKET,
      folder: 'creator-avatars',
      userId: targetUserId,
    }),
  });
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || '업로드에 실패했습니다.');
  }
  const json = await res.json();
  if (!json?.url) throw new Error('업로드 URL을 받을 수 없습니다.');
  return json.url;
}

async function getCurrentUserId() {
  try {
    const { data } = await window.sb?.auth?.getSession();
    return data?.session?.user?.id || null;
  } catch (e) {
    console.warn('getCurrentUserId failed', e);
    return null;
  }
}

async function fetchFollowState(targetUserId) {
  if (!targetUserId || !window.sb) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    const { data, error } = await window.sb
      .from(FOLLOW_TABLE)
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', targetUserId)
      .maybeSingle();
    if (error) throw error;
    return Boolean(data);
  } catch (e) {
    console.warn('fetchFollowState error', e);
    return false;
  }
}

async function setFollowState(targetUserId, follow) {
  if (!targetUserId || !window.sb) return false;
  const userId = await getCurrentUserId();
  if (!userId) return false;
  try {
    if (follow) {
      const { error } = await window.sb
        .from(FOLLOW_TABLE)
        .upsert({ follower_id: userId, following_id: targetUserId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: false });
      if (error) throw error;
    } else {
      const { error } = await window.sb
        .from(FOLLOW_TABLE)
        .delete()
        .eq('follower_id', userId)
        .eq('following_id', targetUserId);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.warn('setFollowState error', e);
    return false;
  }
}

async function initCreatorPage() {
  try {
    let ctx = null;
    try {
      ctx = await window.fetchUserContext();
    } catch (error) {
      console.warn('fetchUserContext unavailable', error);
    }

    const params = new URLSearchParams(window.location.search);
    const requestedUserId = params.get('user');
    const viewerUserId = ctx?.user?.id || null;
    const targetUserId = requestedUserId || viewerUserId;

    if (!targetUserId) {
      showCreatorUnavailableState('공유된 크리에이터 정보를 찾을 수 없어요. 로그인 후 내 프로필을 확인해보세요.');
      return;
    }

    const isSelf = Boolean(viewerUserId && targetUserId === viewerUserId);
    const targetProfile = isSelf && ctx?.profile ? ctx.profile : await fetchProfileById(targetUserId);
    if (!targetProfile) {
      showCreatorUnavailableState('크리에이터 정보를 불러오지 못했어요.');
      return;
    }

    creatorPageState.targetUserId = targetUserId;
    creatorPageState.viewerUserId = viewerUserId;
    creatorPageState.isSelf = isSelf;
    creatorPageState.isLoggedIn = Boolean(viewerUserId);
    creatorPageState.profileData = targetProfile;

    await renderHero(targetProfile, isSelf ? ctx?.user : null, isSelf, Boolean(viewerUserId));

    const { items: characterItems, totalCharacters, totalChats } = await fetchCharacterItems(targetUserId);

    updateHeroStats({
      characterCount: characterItems.length,
      totalCharacters,
      totalChats,
      followers: targetProfile.followers_count || 0,
    });
    renderCharacterHighlights(characterItems);
    renderGrid(characterItems);

    setupWorksTabs();

    setupFeed(creatorPageState);
    setupShareButton(targetProfile, targetUserId);
    setupBioToggle();
    initCreatorProfileEditor();
    setupFollowShortcuts();
    await loadFollowStatsAndList('followers');
  } catch (e) {
    console.error('creator init error', e);
    showCreatorUnavailableState('페이지를 불러오는 중 문제가 발생했습니다.');
  }
}

async function renderHero(profile, fallbackUser, isSelf, viewerLoggedIn) {
  const displayName =
    profile?.display_name ||
    profile?.handle ||
    fallbackUser?.user_metadata?.name ||
    fallbackUser?.user_metadata?.user_name ||
    fallbackUser?.email?.split('@')[0] ||
    '크리에이터';

  const handle =
    profile?.handle ||
    fallbackUser?.user_metadata?.user_name ||
    fallbackUser?.email?.split('@')[0] ||
    'creator';

  setCreatorAvatar(profile?.avatar_url || fallbackUser?.user_metadata?.avatar_url, displayName);
  creatorPageState.targetDisplayName = displayName;

  const nameEl = document.getElementById('creatorName');
  if (nameEl) nameEl.textContent = displayName;
  const handleEl = document.getElementById('creatorHandle');
  if (handleEl) handleEl.textContent = `@${handle}`;
  const badgeEl = document.getElementById('creatorBadge');
  if (badgeEl) badgeEl.textContent = profile?.role?.toUpperCase() || 'CREATOR';

  const bioEl = document.getElementById('creatorBio');
  if (bioEl) bioEl.textContent = profile?.bio?.trim() || '자기소개를 작성하면 여기서 바로 소개됩니다.';
  refreshCreatorBioClamp();
  const jobEl = document.getElementById('creatorJob');
  if (jobEl) jobEl.textContent = profile?.job?.trim() || '정보 없음';
  const genderEl = document.getElementById('creatorGender');
  if (genderEl) genderEl.textContent = profile?.gender?.trim() || '정보 없음';
  const ageEl = document.getElementById('creatorAge');
  if (ageEl) ageEl.textContent = profile?.age_range?.trim() || '정보 없음';

  const websiteEl = document.getElementById('creatorWebsite');
  if (websiteEl) {
    const website = normalizeWebsite(profile?.website);
    if (website) {
      websiteEl.href = website;
      websiteEl.textContent = website.replace(/^https?:\/\//, '');
      websiteEl.hidden = false;
    } else {
      websiteEl.hidden = true;
    }
  }

  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    if (isSelf && viewerLoggedIn) {
      followBtn.textContent = '프로필 관리';
      followBtn.onclick = () => openCreatorProfileEditor();
    } else if (!viewerLoggedIn) {
      followBtn.textContent = '로그인';
      followBtn.onclick = () => (window.location.href = '/login');
    } else {
      const updateBtn = () => {
        followBtn.textContent = creatorPageState.isSelf ? '프로필 관리' : (creatorPageState.isLoggedIn ? (creatorPageState.following ? '언팔로우' : '팔로우') : '로그인');
      };
      const handleFollow = async () => {
        if (!creatorPageState.isLoggedIn) {
          window.location.href = '/login';
          return;
        }
        const next = !creatorPageState.following;
        followBtn.disabled = true;
        const ok = await setFollowState(creatorPageState.targetUserId, next);
        if (!ok) {
          alert('팔로우 처리 중 오류가 발생했습니다.');
        } else {
          creatorPageState.following = next;
        }
        followBtn.disabled = false;
        updateBtn();
      };
      creatorPageState.following = Boolean(await fetchFollowState(creatorPageState.targetUserId));
      followBtn.onclick = handleFollow;
      updateBtn();
    }
  }
  // stats click -> follow modal
  const statsSpans = document.querySelectorAll('#creatorStats span');
  statsSpans.forEach((span) => {
    span.style.cursor = 'pointer';
    if (span.dataset.followBound) return;
    span.addEventListener('click', () => {
      const label = span.textContent || '';
      const mode = label.includes('팔로잉') ? 'followings' : 'followers';
      openFollowModal(mode);
    });
    span.dataset.followBound = '1';
  });
}

function setCreatorAvatar(url, fallbackInitial) {
  const avatarEl = document.getElementById('creatorAvatar');
  if (!avatarEl) return;
  if (url) {
    avatarEl.style.backgroundImage = `url("${url}")`;
    avatarEl.classList.add('has-image');
    avatarEl.textContent = '';
  } else {
    avatarEl.style.backgroundImage = '';
    avatarEl.classList.remove('has-image');
    avatarEl.textContent = fallbackInitial?.slice(0, 2) || 'CR';
  }
}

function updateHeroStats({ characterCount = 0, totalCharacters = 0, totalChats = 0, followers = 0 }) {
  const charEl = document.getElementById('creatorCharacterCount');
  if (charEl) charEl.textContent = characterCount.toLocaleString('ko-KR');
  const totalCharEl = document.getElementById('creatorTotalCharacters');
  if (totalCharEl) totalCharEl.textContent = totalCharacters.toLocaleString('ko-KR');
  const totalChatsEl = document.getElementById('creatorTotalChats');
  if (totalChatsEl) totalChatsEl.textContent = totalChats.toLocaleString('ko-KR');
  const followersEl = document.getElementById('creatorFollowers');
  if (followersEl) followersEl.textContent = (creatorPageState.followerCount || followers || 0).toLocaleString('ko-KR');
  const followingsEl = document.getElementById('creatorFollowings');
  if (followingsEl) followingsEl.textContent = (creatorPageState.followingCount || 0).toLocaleString('ko-KR');
}

function showCreatorUnavailableState(message) {
  const nameEl = document.getElementById('creatorName');
  if (nameEl) nameEl.textContent = '크리에이터 정보를 찾을 수 없어요';
  const bioEl = document.getElementById('creatorBio');
  if (bioEl) bioEl.textContent = message || '';
  const statsEl = document.getElementById('creatorStats');
  if (statsEl) statsEl.style.display = 'none';
  const followBtn = document.getElementById('followBtn');
  if (followBtn) {
    followBtn.textContent = '로그인';
    followBtn.onclick = () => (window.location.href = '/login');
  }
  document.getElementById('creatorCharactersSection')?.classList.add('hidden');
  document.getElementById('creatorWorksSection')?.classList.add('hidden');
  document.getElementById('creatorFeedBlock')?.classList.add('hidden');
  document.getElementById('feedDetailSheet')?.classList.add('hidden');
}

function renderCharacterHighlights(items) {
  const section = document.getElementById('creatorCharactersSection');
  const list = document.getElementById('creatorCharacterList');
  if (!section || !list) return;

  list.innerHTML = '';
  if (!items.length) {
    section.classList.add('hidden');
    return;
  }
  section.classList.remove('hidden');

  items.slice(0, 6).forEach((item) => {
    const card = document.createElement('article');
    card.className = 'creator-character-card';

    const title = document.createElement('h3');
    title.textContent = item.title || '나의 캐릭터';
    const desc = document.createElement('p');
    desc.textContent = item.subtitle || '짧은 소개가 아직 없습니다.';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '대화하기';
    button.addEventListener('click', () => {
      window.location.href = `/character?id=${item.id}`;
    });

    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(button);
    list.appendChild(card);
  });
}

async function fetchFollowList(mode = 'followers') {
  const listEl = document.getElementById('followListBody');
  const emptyEl = document.getElementById('followListEmpty');
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';
  emptyEl.textContent = '불러오는 중...';
  emptyEl.style.display = 'block';

  const targetId = creatorPageState.targetUserId;
  if (!targetId || !window.sb) {
    emptyEl.textContent = '목록을 불러올 수 없습니다.';
    return;
  }
  try {
    const { data, error } = await window.sb
      .from(FOLLOW_TABLE)
      .select('follower_id, following_id')
      .eq(mode === 'followings' ? 'follower_id' : 'following_id', targetId);
    if (error) throw error;
    if (!data?.length) {
      emptyEl.textContent = '목록이 없습니다.';
      listEl.innerHTML = '';
      return;
    }
    // collect user ids
    const ids = Array.from(
      new Set(
        data.map((row) => (mode === 'followings' ? row.following_id : row.follower_id)).filter(Boolean)
      )
    );
    if (!ids.length) {
      emptyEl.textContent = '목록이 없습니다.';
      listEl.innerHTML = '';
      return;
    }
    const { data: profiles, error: pErr } = await window.sb
      .from('profiles')
      .select('id, display_name, handle, avatar_url')
      .in('id', ids);
    if (pErr) throw pErr;

    const map = new Map();
    profiles?.forEach((p) => map.set(p.id, p));
    listEl.innerHTML = '';
    ids.forEach((id) => {
      const p = map.get(id) || {};
      const name = p.display_name || p.handle || '사용자';
      const handle = p.handle ? `@${p.handle}` : '';
      const avatar = p.avatar_url || PLACEHOLDER_AVATAR;
      const card = document.createElement('div');
      card.className = 'follow-card';
      card.innerHTML = `
        <div class="follow-card__avatar">${p.avatar_url ? `<img src="${avatar}" alt="${name}">` : name.slice(0,2)}</div>
        <div class="follow-card__meta">
          <div class="follow-card__name">${name}</div>
          <div class="follow-card__handle">${handle}</div>
        </div>
      `;
      card.addEventListener('click', () => {
        window.location.href = `/creator?user=${id}`;
      });
      listEl.appendChild(card);
    });
    emptyEl.style.display = 'none';
  } catch (e) {
    console.warn('fetchFollowList error', e);
    emptyEl.textContent = '목록을 불러올 수 없습니다.';
  }
}

function bindFollowTabs() {
  const tabs = document.querySelectorAll('[data-follow-tab]');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    tab.addEventListener('click', async () => {
      tabs.forEach((t) => t.classList.toggle('follow-tab--active', t === tab));
      const mode = tab.getAttribute('data-follow-tab');
      const title = document.getElementById('followListTitle');
      if (title) title.textContent = mode === 'followings' ? '팔로잉' : '팔로워';
      await loadFollowStatsAndList(mode === 'followings' ? 'followings' : 'followers');
    });
  });
}

async function loadFollowStatsAndList(mode = 'followers') {
  if (!window.sb || !creatorPageState.targetUserId) return;
  try {
    const targetId = creatorPageState.targetUserId;
    const followerRes = await window.sb
      .from(FOLLOW_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('following_id', targetId);
    const followerCount = followerRes?.count ?? 0;

    const followingRes = await window.sb
      .from(FOLLOW_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', targetId);
    const followingCount = followingRes?.count ?? 0;

    creatorPageState.followerCount = followerCount ?? 0;
    creatorPageState.followingCount = followingCount ?? 0;
    updateHeroStats({ followers: followerCount ?? 0 });
  } catch (e) {
    console.warn('follow stats error', e);
  }
  await fetchFollowList(mode);
}

function setupFollowShortcuts() {
  const section = document.getElementById('creatorFollowList');
  const tabs = section?.querySelectorAll('[data-follow-tab]');
  const stats = document.querySelectorAll('#creatorStats span[data-follow-target]');
  const closeBtn = document.getElementById('closeFollowModal');
  const modal = document.getElementById('creatorFollowList');
  const activateTab = async (targetMode) => {
    tabs.forEach((t) => t.classList.toggle('follow-tab--active', t.getAttribute('data-follow-tab') === targetMode));
    const title = document.getElementById('followListTitle');
    if (title) title.textContent = targetMode === 'followings' ? '팔로잉' : '팔로워';
    await loadFollowStatsAndList(targetMode);
  };
  tabs?.forEach((tab, idx) => {
    tab.addEventListener('click', () => activateTab(tab.getAttribute('data-follow-tab')));
    if (idx === 0) tab.classList.add('follow-tab--active');
  });
  // bind stats clicks
  stats.forEach((node) => {
    node.style.cursor = 'pointer';
    node.addEventListener('click', () => {
      const targetMode = node.getAttribute('data-follow-target') === 'followings' ? 'followings' : 'followers';
      openFollowModal(targetMode);
    });
  });
  if (closeBtn && modal) {
    closeBtn.addEventListener('click', closeFollowModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeFollowModal();
    });
  }
}
function renderGrid(items) {
  const grid = document.getElementById('creatorGrid');
  const empty = document.getElementById('creatorEmpty');
  if (!grid || !empty) return;

  grid.innerHTML = '';
  if (!items.length) {
    empty.classList.remove('hidden');
    creatorPageState.charactersEmpty = true;
    return;
  }
  empty.classList.add('hidden');
  creatorPageState.charactersEmpty = false;

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'creator-card';
    card.dataset.kind = item.kind;
    const detailData =
      item.detailData && item.detailData.id
        ? item.detailData
        : {
            id: item.id,
            name: item.title,
            one_line: item.subtitle,
            description: item.subtitle,
            avatar_url: item.thumbUrl,
          };

    const thumb = document.createElement('div');
    thumb.className = 'creator-card-thumb';
    const picture = createPictureElement(item.thumbUrl || PLACEHOLDER_IMAGE, {
      alt: item.title || '캐릭터',
    });
    thumb.appendChild(picture);

    const body = document.createElement('div');
    body.className = 'creator-card-body';
    const title = document.createElement('div');
    title.className = 'creator-card-title';
    title.textContent = item.title || '캐릭터';
    const sub = document.createElement('div');
    sub.className = 'creator-card-sub';
    sub.textContent = item.subtitle || '';
    const meta = document.createElement('div');
    meta.className = 'creator-card-meta';
    meta.textContent = '캐릭터';

    body.appendChild(title);
    body.appendChild(sub);
    body.appendChild(meta);

    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.CharacterDetailModal) {
        window.CharacterDetailModal.openWithData(detailData);
      }
    });

    grid.appendChild(card);
  });
}

function setupWorksTabs() {
  const tabs = document.querySelectorAll('[data-work-tab]');
  if (!tabs.length) return;
  tabs.forEach((tab) => {
    if (tab.dataset.bound) return;
    tab.addEventListener('click', () => {
      const view = tab.getAttribute('data-work-tab') || 'characters';
      setWorksView(view);
    });
    tab.dataset.bound = '1';
  });
  const initialTab = document.querySelector('[data-work-tab].active');
  setWorksView(initialTab?.getAttribute('data-work-tab') || 'characters');
}

function openFollowModal(mode = 'followers') {
  const modal = document.getElementById('creatorFollowList');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('is-open');
  document.body.classList.add('modal-open');
  const tabs = modal.querySelectorAll('[data-follow-tab]');
  tabs.forEach((tab) => {
    const isActive = tab.getAttribute('data-follow-tab') === mode;
    tab.classList.toggle('follow-tab--active', isActive);
  });
  const title = document.getElementById('followListTitle');
  if (title) title.textContent = mode === 'followings' ? '팔로잉' : '팔로워';
  loadFollowStatsAndList(mode);
}

function closeFollowModal() {
  const modal = document.getElementById('creatorFollowList');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('is-open');
  document.body.classList.remove('modal-open');
}

function setWorksView(view) {
  const normalized = view === 'feed' ? 'feed' : 'characters';
  creatorPageState.workTab = normalized;
  document.querySelectorAll('[data-work-tab]').forEach((tab) => {
    const isActive = tab.getAttribute('data-work-tab') === normalized;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  const grid = document.getElementById('creatorGrid');
  const empty = document.getElementById('creatorEmpty');
  const feedBlock = document.getElementById('creatorFeedBlock');
  if (normalized === 'feed') {
    grid?.classList.add('hidden');
    empty?.classList.add('hidden');
    feedBlock?.classList.remove('hidden');
    if (!creatorPageState.feed.initialized) {
      loadFeed({ reset: true });
      creatorPageState.feed.initialized = true;
    }
  } else {
    grid?.classList.remove('hidden');
    if (empty) empty.classList.toggle('hidden', !creatorPageState.charactersEmpty);
    feedBlock?.classList.add('hidden');
  }
}

function setupBioToggle() {
  const toggle = document.getElementById('creatorBioToggle');
  if (toggle && !toggle.dataset.bound) {
    toggle.addEventListener('click', () => {
      const bioEl = document.getElementById('creatorBio');
      if (!bioEl) return;
      const expanded = bioEl.classList.toggle('is-expanded');
      toggle.textContent = expanded ? '닫기' : '더보기';
      if (!expanded) refreshCreatorBioClamp();
    });
    toggle.dataset.bound = '1';
  }
  refreshCreatorBioClamp();
}

function refreshCreatorBioClamp() {
  const bioEl = document.getElementById('creatorBio');
  const toggle = document.getElementById('creatorBioToggle');
  if (!bioEl || !toggle) return;
  bioEl.classList.remove('is-expanded');
  toggle.textContent = '더보기';
  requestAnimationFrame(() => {
    const needsToggle = bioEl.scrollHeight > bioEl.clientHeight + 1;
    toggle.classList.toggle('hidden', !needsToggle);
  });
}

async function fetchCharacterItems(userId) {
  if (!window.sb) return { items: [], totalCharacters: 0, totalChats: 0 };
  try {
    const listPromise = window.sb
      .from('character_chats')
      .select('character_id, created_at, characters(*), content')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    const countPromise = window.sb
      .from('character_chats')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    const [{ data, error }, { count, error: countError }] = await Promise.all([listPromise, countPromise]);
    if (error) throw error;
    if (countError) console.warn('character chat count error', countError);

    const seen = new Set();
    const unique = [];
    for (const row of data || []) {
      if (!row.character_id || seen.has(row.character_id)) continue;
      seen.add(row.character_id);
      unique.push(row);
    }

    return {
      items: unique.map((row) => {
        const raw = row.characters || {};
        const detailData = {
          ...raw,
          id: raw.id || row.character_id,
        };
        if (typeof detailData.like_count === 'undefined') detailData.like_count = raw.like_count || 0;
        if (typeof detailData.chat_count === 'undefined') detailData.chat_count = raw.chat_count || 0;
        if (typeof detailData.view_count === 'undefined') detailData.view_count = raw.view_count || 0;
        const subtitle =
          raw.one_line ||
          raw.description ||
          truncate(row.content, 60) ||
          '소개가 아직 없습니다.';
        return {
          id: row.character_id,
          kind: 'character',
          title: raw.name || '나의 캐릭터',
          subtitle,
          thumbUrl: raw.avatar_url || PLACEHOLDER_AVATAR,
          detailData,
        };
      }),
      totalCharacters: unique.length,
      totalChats: typeof count === 'number' ? count : data?.length || 0,
    };
  } catch (e) {
    console.error('fetchCharacterItems error', e);
    return { items: [], totalCharacters: 0, totalChats: 0 };
  }
}

async function fetchProfileById(userId) {
  if (!window.sb) return null;
  try {
    const { data, error } = await window.sb.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error('fetchProfileById error', e);
    return null;
  }
}

function setupShareButton(profile, targetUserId) {
  const shareBtn = document.getElementById('shareBtn');
  const dim = document.getElementById('creatorShareDim');
  const sheet = document.getElementById('creatorShareSheet');
  const linkInput = document.getElementById('creatorShareLink');
  const copyBtn = document.getElementById('creatorShareCopy');
  const closeBtn = document.getElementById('creatorShareClose');
  const systemBtn = document.getElementById('creatorShareSystem');
  if (!shareBtn || !dim || !sheet || !linkInput || !copyBtn || !closeBtn || !systemBtn) return;

  const shareUrl = new URL(window.location.origin + '/creator');
  if (targetUserId) {
    shareUrl.searchParams.set('user', targetUserId);
  }
  const shareData = {
    title: `${profile?.display_name || '크리에이터'} | crama`,
    text: '제가 만든 캐릭터를 소개합니다.',
    url: shareUrl.toString(),
  };
  creatorPageState.shareData = shareData;

  const closeSheet = () => {
    dim.classList.add('hidden');
    sheet.classList.add('hidden');
  };

  const openSheet = () => {
    linkInput.value = shareData.url;
    dim.classList.remove('hidden');
    sheet.classList.remove('hidden');
    linkInput.focus();
    linkInput.select();
  };

  shareBtn.onclick = () => {
    openSheet();
  };

  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard?.writeText(shareData.url);
      copyBtn.textContent = '복사 완료';
      setTimeout(() => (copyBtn.textContent = '복사'), 1500);
    } catch (e) {
      console.warn('copy failed', e);
      alert(shareData.url);
    }
  };

  systemBtn.onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        closeSheet();
        return;
      } catch (err) {
        if (err?.name !== 'AbortError') console.warn('share failed', err);
      }
    }
    copyBtn.click();
  };

  [dim, closeBtn].forEach((el) =>
    el.addEventListener('click', () => {
      closeSheet();
    })
  );
}

function normalizeWebsite(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function truncate(text, len) {
  if (!text) return '';
  const value = text.trim();
  if (value.length <= len) return value;
  return `${value.slice(0, len)}…`;
}

function getWebpCandidate(url) {
  if (!url) return '';
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return '';
  }
  try {
    const target = new URL(trimmed);
    if (target.hostname.includes('supabase.co')) {
      target.searchParams.set('format', 'webp');
      return target.toString();
    }
    if (/(\.png|\.jpe?g)(?=$|[?#])/i.test(target.pathname)) {
      target.pathname = target.pathname.replace(/(\.png|\.jpe?g)$/i, '.webp');
      return target.toString();
    }
  } catch (e) {
    console.warn('getWebpCandidate failed', e);
  }
  return '';
}

function createPictureElement(originalUrl, { alt = '', className = '' } = {}) {
  const picture = document.createElement('picture');
  const webpCandidate = getWebpCandidate(originalUrl);
  if (webpCandidate) {
    const source = document.createElement('source');
    source.type = 'image/webp';
    source.srcset = webpCandidate;
    picture.appendChild(source);
  }
  const img = document.createElement('img');
  img.src = originalUrl || PLACEHOLDER_IMAGE;
  img.alt = alt;
  img.loading = 'lazy';
  img.decoding = 'async';
  if (className) img.className = className;
  picture.appendChild(img);
  return picture;
}

function setupFeed(state) {
  if (!document.getElementById('creatorFeedBlock')) return;

  const emptyEl = document.getElementById('feedEmpty');
  if (emptyEl && !emptyEl.dataset.defaultText) {
    emptyEl.dataset.defaultText = emptyEl.textContent.trim();
  }
  const launcher = document.getElementById('feedComposeLauncher');
  if (launcher) {
    launcher.classList.toggle('hidden', !state.isSelf);
  }
  const openBtn = document.getElementById('openFeedComposer');
  if (openBtn && !openBtn.dataset.bound) {
    openBtn.addEventListener('click', () => openFeedComposer());
    openBtn.dataset.bound = '1';
  }

  initFeedComposerSheet();

  const loadMoreBtn = document.getElementById('feedLoadMore');
  if (loadMoreBtn && !loadMoreBtn.dataset.bound) {
    loadMoreBtn.addEventListener('click', () => loadFeed({ reset: false }));
    loadMoreBtn.dataset.bound = '1';
  }

  const detailSheet = document.getElementById('feedDetailSheet');
  const detailClose = document.getElementById('feedDetailClose');
  if (detailClose && !detailClose.dataset.bound) {
    detailClose.addEventListener('click', closeFeedDetail);
    detailClose.dataset.bound = '1';
  }
  if (detailSheet && !detailSheet.dataset.bound) {
    detailSheet.addEventListener('click', (event) => {
      if (event.target === detailSheet) closeFeedDetail();
    });
    detailSheet.dataset.bound = '1';
  }

  updateFeedComposerVisibility();
  state.feed.initialized = false;
}

function initFeedComposerSheet() {
  const composerForm = document.getElementById('feedComposerForm');
  if (!composerForm || composerForm.dataset.bound) return;
  const textarea = document.getElementById('feedComposerInput');
  const imageInput = document.getElementById('feedComposerImageInput');
  const statusEl = document.getElementById('feedComposerStatus');
  const cancelBtn = document.getElementById('feedComposerCancel');
  const closeBtn = document.getElementById('feedComposerClose');
  const backdrop = document.getElementById('feedComposerBackdrop');
  textarea?.addEventListener('input', updateFeedComposerCounter);
  updateFeedComposerCounter();

  const handleClose = () => {
    closeFeedComposer();
  };
  cancelBtn?.addEventListener('click', handleClose);
  closeBtn?.addEventListener('click', handleClose);
  backdrop?.addEventListener('click', handleClose);

  composerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!creatorPageState.isSelf) return;
    if (!ensureLoggedIn()) return;
    if (!ensureFeedApiAvailable('피드')) return;
    const content = (textarea?.value || '').trim();
    const imageUrl = (imageInput?.value || '').trim();
    if (!content) {
      if (statusEl) statusEl.textContent = '내용을 입력해주세요.';
      return;
    }
    composerForm.classList.add('loading');
    if (statusEl) statusEl.textContent = creatorPageState.feed.editingPostId ? '수정 중...' : '등록 중...';
    try {
      await createFeedPost({
        user_id: creatorPageState.targetUserId,
        content,
        image_url: imageUrl || null,
      });
      if (statusEl) statusEl.textContent = '등록되었습니다.';
      closeFeedComposer();
      loadFeed({ reset: true });
    } catch (err) {
      console.error('createFeedPost failed', err);
      if (statusEl) {
        statusEl.textContent =
          err?.message === FEED_API_UNAVAILABLE_ERROR
            ? FEED_UNAVAILABLE_MESSAGE
            : '등록에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
    } finally {
      composerForm.classList.remove('loading');
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 2500);
    }
  });

  composerForm.dataset.bound = '1';
}

function openFeedComposer(item = null) {
  if (!creatorPageState.isSelf) return;
  if (!ensureFeedApiAvailable('피드')) return;
  const layer = document.getElementById('feedComposerLayer');
  const textarea = document.getElementById('feedComposerInput');
  const imageInput = document.getElementById('feedComposerImageInput');
  const statusEl = document.getElementById('feedComposerStatus');
  if (!layer || !textarea || !imageInput) return;
  if (item) {
    textarea.value = item.content || '';
    imageInput.value = item.image_url || '';
    creatorPageState.feed.editingPostId = item.id;
    if (statusEl) statusEl.textContent = '수정 모드입니다. 저장하면 기존 피드가 업데이트됩니다.';
  } else {
    creatorPageState.feed.editingPostId = null;
    textarea.value = '';
    imageInput.value = '';
    if (statusEl) statusEl.textContent = '';
  }
  updateFeedComposerCounter();
  document.body.classList.add('modal-open');
  layer.classList.remove('hidden');
  setTimeout(() => textarea.focus(), 50);
}

function closeFeedComposer() {
  const layer = document.getElementById('feedComposerLayer');
  if (layer && !layer.classList.contains('hidden')) {
    layer.classList.add('hidden');
  }
  document.body.classList.remove('modal-open');
  resetFeedComposerForm();
}

function resetFeedComposerForm() {
  const textarea = document.getElementById('feedComposerInput');
  const imageInput = document.getElementById('feedComposerImageInput');
  const statusEl = document.getElementById('feedComposerStatus');
  if (textarea) textarea.value = '';
  if (imageInput) imageInput.value = '';
  if (statusEl) statusEl.textContent = '';
  creatorPageState.feed.editingPostId = null;
  updateFeedComposerCounter();
}

function updateFeedComposerCounter() {
  const counterEl = document.getElementById('feedComposerCounter');
  const textarea = document.getElementById('feedComposerInput');
  if (counterEl && textarea) {
    counterEl.textContent = String(textarea.value.length);
  }
}

function initCreatorProfileEditor() {
  const form = document.getElementById('creatorProfileForm');
  const cancelBtn = document.getElementById('creatorProfileEditCancel');
  const closeBtn = document.getElementById('creatorProfileEditClose');
  const backdrop = document.getElementById('creatorProfileEditBackdrop');
  if (!form || form.dataset.bound) return;

  const handleClose = () => closeCreatorProfileEditor();
  cancelBtn?.addEventListener('click', handleClose);
  closeBtn?.addEventListener('click', handleClose);
  backdrop?.addEventListener('click', handleClose);

  form.addEventListener('submit', handleCreatorProfileSave);
  form.dataset.bound = '1';
}

function openCreatorProfileEditor() {
  if (!creatorPageState.isSelf) return;
  const layer = document.getElementById('creatorProfileEditLayer');
  const nameInput = document.getElementById('creatorProfileNameInput');
  const bioInput = document.getElementById('creatorProfileBioInput');
  const avatarFileInput = document.getElementById('creatorProfileAvatarFile');
  const avatarUploadStatus = document.getElementById('creatorProfileAvatarUploadStatus');
  const avatarPreview = document.getElementById('creatorProfileAvatarPreview');
  const statusEl = document.getElementById('creatorProfileEditStatus');
  if (!layer || !nameInput || !bioInput) return;
  const profile = creatorPageState.profileData || {};
  creatorPageState.uploadedAvatarUrl = null;
  nameInput.value = profile.display_name || creatorPageState.targetDisplayName || '';
  bioInput.value = profile.bio || '';
  if (avatarUploadStatus) avatarUploadStatus.textContent = '';
  if (avatarFileInput) avatarFileInput.value = '';
  if (avatarPreview) {
    avatarPreview.classList.toggle('has-image', Boolean(profile.avatar_url));
    avatarPreview.innerHTML = profile.avatar_url
      ? `<img src="${profile.avatar_url}" alt="현재 아바타">`
      : '<span class="creator-profile-avatar-placeholder">+</span>';
  }
  if (statusEl) statusEl.textContent = '';
  layer.classList.remove('hidden');
  document.body.classList.add('modal-open');
  setTimeout(() => nameInput.focus(), 50);

  const triggerUpload = async (file) => {
    if (!file) {
      if (avatarUploadStatus) avatarUploadStatus.textContent = '파일을 선택하세요.';
      return;
    }
    try {
      if (avatarUploadStatus) avatarUploadStatus.textContent = '업로드 중...';
      const publicUrl = await uploadAvatarFile(file, creatorPageState.targetUserId || 'me');
      creatorPageState.uploadedAvatarUrl = publicUrl;
      if (avatarPreview) {
        avatarPreview.classList.add('has-image');
        avatarPreview.innerHTML = `<img src="${publicUrl}" alt="업로드된 아바타">`;
      }
      if (avatarUploadStatus) avatarUploadStatus.textContent = '업로드 완료! 저장을 눌러 반영하세요.';
    } catch (e) {
      console.error('avatar upload error', e);
      if (avatarUploadStatus) avatarUploadStatus.textContent = '업로드 실패. 다시 시도하세요.';
    }
  };

  if (avatarFileInput && avatarPreview && !avatarFileInput.dataset.bound) {
    avatarFileInput.dataset.bound = '1';
    avatarFileInput.addEventListener('change', () => {
      const file = avatarFileInput.files?.[0];
      if (file) triggerUpload(file);
    });
    const openPicker = () => avatarFileInput.click();
    avatarPreview.addEventListener('click', openPicker);
    avatarPreview.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPicker();
      }
    });
  }
}

function closeCreatorProfileEditor() {
  const layer = document.getElementById('creatorProfileEditLayer');
  const statusEl = document.getElementById('creatorProfileEditStatus');
  if (layer && !layer.classList.contains('hidden')) {
    layer.classList.add('hidden');
  }
  if (statusEl) statusEl.textContent = '';
  document.body.classList.remove('modal-open');
}

async function handleCreatorProfileSave(event) {
  event.preventDefault();
  if (!creatorPageState.isSelf || !window.sb) return;
  const nameInput = document.getElementById('creatorProfileNameInput');
  const bioInput = document.getElementById('creatorProfileBioInput');
  const statusEl = document.getElementById('creatorProfileEditStatus');
  const avatarUploadStatus = document.getElementById('creatorProfileAvatarUploadStatus');
  const submitBtn = document.getElementById('creatorProfileEditSubmit');
  if (!nameInput || !bioInput) return;
  const displayName = (nameInput.value || '').trim() || creatorPageState.targetDisplayName || '크리에이터';
  const bio = (bioInput.value || '').trim();
  let avatarUrl = (creatorPageState.uploadedAvatarUrl || creatorPageState.profileData?.avatar_url || '').trim();
  if (statusEl) statusEl.textContent = '저장 중...';
  if (submitBtn) submitBtn.disabled = true;
  try {
    const { error } = await window.sb
      .from('profiles')
      .update({
        display_name: displayName,
        bio: bio || null,
        avatar_url: avatarUrl || null,
      })
      .eq('id', creatorPageState.targetUserId);
    if (error) throw error;
    applyCreatorProfileUpdates(displayName, bio, avatarUrl || null);
    if (statusEl) statusEl.textContent = '저장되었습니다.';
    setTimeout(() => closeCreatorProfileEditor(), 500);
  } catch (err) {
    console.error('creator profile update error', err);
    if (statusEl) statusEl.textContent = '저장에 실패했습니다.';
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

function applyCreatorProfileUpdates(displayName, bio, avatarUrl) {
  creatorPageState.targetDisplayName = displayName;
  creatorPageState.profileData = {
    ...(creatorPageState.profileData || {}),
    display_name: displayName,
    bio,
    avatar_url: avatarUrl ?? creatorPageState.profileData?.avatar_url,
  };
  if (creatorPageState.shareData) {
    creatorPageState.shareData.title = `${displayName} | crama`;
  }
  const nameEl = document.getElementById('creatorName');
  const bioEl = document.getElementById('creatorBio');
  const avatarEl = document.getElementById('creatorAvatar');
  if (avatarEl) {
    if (avatarUrl) {
      avatarEl.style.backgroundImage = `url("${avatarUrl}")`;
      avatarEl.classList.add('has-image');
      avatarEl.textContent = '';
    } else if (creatorPageState.profileData?.avatar_url) {
      avatarEl.style.backgroundImage = `url("${creatorPageState.profileData.avatar_url}")`;
      avatarEl.classList.add('has-image');
      avatarEl.textContent = '';
    }
  }
  if (nameEl) nameEl.textContent = displayName;
  if (bioEl) bioEl.textContent = bio || '자기소개를 작성하면 여기서 바로 소개됩니다.';
  refreshCreatorBioClamp();
}

function updateFeedComposerVisibility() {
  const launcher = document.getElementById('feedComposeLauncher');
  const shouldShow = creatorPageState.isSelf && creatorPageState.feed.apiAvailable;
  if (launcher) {
    launcher.classList.toggle('hidden', !shouldShow);
  }
  if (!shouldShow) {
    closeFeedComposer();
  }
}

function setFeedApiAvailability(isAvailable, message = FEED_UNAVAILABLE_MESSAGE) {
  creatorPageState.feed.apiAvailable = isAvailable;
  updateFeedComposerVisibility();

  const emptyEl = document.getElementById('feedEmpty');
  if (emptyEl) {
    const defaultText = emptyEl.dataset.defaultText || emptyEl.textContent || '';
    if (isAvailable) {
      emptyEl.textContent = defaultText || '아직 작성된 피드가 없습니다.';
      emptyEl.classList.toggle('hidden', creatorPageState.feed.posts.length > 0);
    } else {
      emptyEl.textContent = message;
      emptyEl.classList.remove('hidden');
    }
  }

  const loadMoreBtn = document.getElementById('feedLoadMore');
  if (loadMoreBtn) {
    if (isAvailable) {
      loadMoreBtn.classList.toggle('hidden', !creatorPageState.feed.nextCursor);
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }
  if (!isAvailable) {
    creatorPageState.feed.posts = [];
    creatorPageState.feed.nextCursor = null;
    const listEl = document.getElementById('feedList');
    if (listEl) listEl.innerHTML = '';
  }
}

function markFeedApiUnavailable(message = FEED_UNAVAILABLE_MESSAGE) {
  setFeedApiAvailability(false, message);
  const error = new Error(FEED_API_UNAVAILABLE_ERROR);
  error.isFeedApiUnavailable = true;
  return error;
}

function ensureFeedApiAvailable(actionLabel) {
  if (creatorPageState.feed.apiAvailable) return true;
  const alertMessage = actionLabel
    ? `${FEED_UNAVAILABLE_MESSAGE}\n${actionLabel} 기능은 잠시 후 다시 이용해주세요.`
    : FEED_UNAVAILABLE_MESSAGE;
  window.alert(alertMessage);
  return false;
}

function ensureFeedApiResponse(res, failureCode) {
  if (res?.status === 404) {
    throw markFeedApiUnavailable();
  }
  if (!res?.ok) {
    throw new Error(failureCode || 'feed_request_failed');
  }
}

async function loadFeed({ reset = false } = {}) {
  if (
    creatorPageState.feed.loading ||
    !creatorPageState.targetUserId ||
    !creatorPageState.feed.apiAvailable
  )
    return;
  const listEl = document.getElementById('feedList');
  const emptyEl = document.getElementById('feedEmpty');
  const loadMoreBtn = document.getElementById('feedLoadMore');
  if (reset) {
    creatorPageState.feed.posts = [];
    creatorPageState.feed.nextCursor = null;
    if (listEl) listEl.innerHTML = '';
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
  }

  creatorPageState.feed.loading = true;
  try {
    const response = await fetchFeedPostsFromApi({
      user_id: creatorPageState.targetUserId,
      cursor: reset ? null : creatorPageState.feed.nextCursor,
    });
    const items = response?.items || [];
    creatorPageState.feed.nextCursor = response?.next_cursor || null;
    creatorPageState.feed.posts = reset
      ? items
      : [...creatorPageState.feed.posts, ...items];
    renderFeedList(creatorPageState.feed.posts);
    if (emptyEl) {
      emptyEl.classList.toggle('hidden', creatorPageState.feed.posts.length > 0);
    }
    if (loadMoreBtn) {
      loadMoreBtn.classList.toggle('hidden', !creatorPageState.feed.nextCursor);
    }
    creatorPageState.feed.initialized = true;
  } catch (err) {
    console.error('loadFeed error', err);
    if (err?.message === FEED_API_UNAVAILABLE_ERROR) return;
    if (emptyEl) {
      emptyEl.classList.remove('hidden');
      emptyEl.textContent = '피드를 불러오지 못했습니다.';
    }
  } finally {
    creatorPageState.feed.loading = false;
  }
}

async function fetchFeedPostsFromApi({ user_id, cursor }) {
  const url = new URL('/api/creator-feed', window.location.origin);
  url.searchParams.set('user_id', user_id);
  if (cursor) url.searchParams.set('cursor', cursor);
  const res = await creatorApiFetch(url.toString(), {
    headers: await getCreatorAuthHeaders(),
  });
  ensureFeedApiResponse(res, 'feed_fetch_failed');
  return res.json().catch(() => ({ items: [] }));
}

function renderFeedList(items) {
  const listEl = document.getElementById('feedList');
  if (!listEl) return;
  listEl.innerHTML = '';
  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'feed-post';
    card.dataset.postId = item.id;

    const header = document.createElement('div');
    header.className = 'feed-post-header';
    const meta = document.createElement('div');
    meta.className = 'feed-post-meta';
    const typeSpan = document.createElement('span');
    typeSpan.className = 'feed-post-type';
    typeSpan.textContent = '피드';
    const authorEl = document.createElement('span');
    authorEl.className = 'feed-post-author';
    authorEl.textContent = item.author_name || creatorPageState.targetDisplayName || '작가';
    const dateEl = document.createElement('span');
    dateEl.className = 'feed-post-date';
    dateEl.textContent = formatFeedDate(item.created_at);
    meta.appendChild(typeSpan);
    meta.appendChild(authorEl);
    meta.appendChild(dateEl);
    header.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'feed-post-actions';
    if (item.is_owner) {
      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.textContent = '수정';
      editBtn.addEventListener('click', () => beginEditFeedPost(item));
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.textContent = '삭제';
      deleteBtn.addEventListener('click', () => deleteFeedPost(item));
      actions.appendChild(editBtn);
      actions.appendChild(deleteBtn);
    }
    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'feed-post-body';
    body.innerHTML = renderMarkdownToHtml(item.content || '');

    let figure = null;
    if (item.image_url) {
      figure = document.createElement('div');
      figure.className = 'feed-post-image';
      const img = document.createElement('img');
      img.src = item.image_url;
      img.alt = `${authorEl.textContent} 피드 이미지`;
      img.loading = 'lazy';
      figure.appendChild(img);
    }

    const footer = document.createElement('div');
    footer.className = 'feed-post-footer';
    const likeBtn = document.createElement('button');
    likeBtn.type = 'button';
    updateFeedLikeButton(likeBtn, item);
    likeBtn.addEventListener('click', () => toggleFeedLike(item, likeBtn));

    const detailBtn = document.createElement('button');
    detailBtn.type = 'button';
    detailBtn.className = 'feed-detail-trigger';
    detailBtn.textContent = `댓글 ${item.comment_count || 0}개 · 상세 보기`;
    detailBtn.addEventListener('click', () => handleFeedDetailOpen(item));
    footer.appendChild(likeBtn);
    footer.appendChild(detailBtn);

    card.appendChild(header);
    card.appendChild(body);
    if (figure) card.appendChild(figure);
    card.appendChild(footer);
    listEl.appendChild(card);
  });
}

function updateFeedLikeButton(button, item) {
  if (!button) return;
  const liked = Boolean(item.liked);
  const count = Number(item.like_count || 0);
  button.textContent = `${liked ? '♥' : '♡'} ${count.toLocaleString('ko-KR')}`;
}

function formatFeedDate(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  if (Number.isNaN(date.valueOf())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}.${month}.${day} ${hour}:${minute}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdownToHtml(value) {
  if (!value) return '';
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const lines = html.split('\n');
  const output = [];
  let inList = false;
  lines.forEach((line) => {
    const listMatch = line.match(/^\s*-\s+(.+)/);
    if (listMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${listMatch[1]}</li>`);
    } else {
      if (inList) {
        output.push('</ul>');
        inList = false;
      }
      output.push(line);
    }
  });
  if (inList) output.push('</ul>');
  html = output.join('\n');
  html = html.replace(/\n{2,}/g, '<br><br>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

function beginEditFeedPost(item) {
  if (!creatorPageState.isSelf) return;
  if (creatorPageState.workTab !== 'feed') {
    document.querySelector('[data-work-tab="feed"]')?.click();
  }
  openFeedComposer(item);
}

async function createFeedPost(payload) {
  if (!creatorPageState.feed.apiAvailable) {
    throw markFeedApiUnavailable();
  }
  const headers = await getCreatorAuthHeaders();
  const body = JSON.stringify(payload);
  const method = creatorPageState.feed.editingPostId ? 'PUT' : 'POST';
  const url = creatorPageState.feed.editingPostId
    ? `/api/creator-feed/${creatorPageState.feed.editingPostId}`
    : '/api/creator-feed';
  const res = await creatorApiFetch(url, {
    method,
    headers,
    body,
  });
  ensureFeedApiResponse(res, 'feed_save_failed');
  creatorPageState.feed.editingPostId = null;
}

async function deleteFeedPost(item) {
  if (!item?.id || !creatorPageState.isSelf) return;
  if (!ensureFeedApiAvailable('피드')) return;
  if (!window.confirm('이 피드를 삭제할까요?')) return;
  try {
    const res = await creatorApiFetch(`/api/creator-feed/${item.id}`, {
      method: 'DELETE',
      headers: await getCreatorAuthHeaders(),
    });
    ensureFeedApiResponse(res, 'feed_delete_failed');
    loadFeed({ reset: true });
  } catch (e) {
    console.error('delete feed error', e);
    if (e?.message !== FEED_API_UNAVAILABLE_ERROR) {
      alert('삭제에 실패했습니다.');
    }
  }
}

async function toggleFeedLike(item, button) {
  if (!ensureLoggedIn()) return;
  if (!ensureFeedApiAvailable()) return;
  if (!item?.id) return;
  const liked = !item.liked;
  item.liked = liked;
  item.like_count = (Number(item.like_count) || 0) + (liked ? 1 : -1);
  updateFeedLikeButton(button, item);
  try {
    const res = await creatorApiFetch(`/api/creator-feed/${item.id}/like`, {
      method: liked ? 'POST' : 'DELETE',
      headers: await getCreatorAuthHeaders(),
    });
    ensureFeedApiResponse(res, 'like_failed');
  } catch (e) {
    console.error('toggle like failed', e);
    item.liked = !liked;
    item.like_count = (Number(item.like_count) || 0) + (liked ? -1 : 1);
    updateFeedLikeButton(button, item);
    if (e?.message === FEED_API_UNAVAILABLE_ERROR) return;
    if (!liked) alert('좋아요 취소에 실패했습니다.');
  }
}

function handleFeedDetailOpen(item) {
  if (!ensureFeedApiAvailable()) return;
  if (!creatorPageState.isLoggedIn) {
    ensureLoggedIn();
    return;
  }
  openFeedDetail(item.id);
}

async function openFeedDetail(postId) {
  if (!postId) return;
  const sheet = document.getElementById('feedDetailSheet');
  const bodyEl = document.getElementById('feedDetailBody');
  const typeEl = document.getElementById('feedDetailType');
  const dateEl = document.getElementById('feedDetailDate');
  const likeBtn = document.getElementById('feedDetailLikeBtn');
  const editBtn = document.getElementById('feedDetailEditBtn');
  const deleteBtn = document.getElementById('feedDetailDeleteBtn');
  const commentForm = document.getElementById('feedCommentForm');
  const commentInput = document.getElementById('feedCommentInput');
  const commentStatus = document.getElementById('feedCommentStatus');
  const detailImage = document.getElementById('feedDetailImage');
  if (!sheet || !bodyEl || !typeEl || !dateEl || !likeBtn || !commentForm) return;

  sheet.classList.remove('hidden');
  creatorPageState.feed.loadingDetail = true;
  currentFeedDetail = null;
  bodyEl.textContent = '불러오는 중...';
  typeEl.textContent = '';
  dateEl.textContent = '';
  likeBtn.textContent = '♡ 0';
  likeBtn.disabled = true;
  editBtn?.classList.add('hidden');
  deleteBtn?.classList.add('hidden');
  if (commentInput) commentInput.value = '';
  if (commentStatus) commentStatus.textContent = '';
  document.getElementById('feedComments')?.replaceChildren();

  try {
    const detail = await fetchFeedDetail(postId);
    currentFeedDetail = detail;
    bodyEl.innerHTML = renderMarkdownToHtml(detail.content || '');
    typeEl.textContent = detail.author_name || creatorPageState.targetDisplayName || '작가';
    dateEl.textContent = formatFeedDate(detail.created_at);
    if (detailImage) {
      if (detail.image_url) {
        detailImage.classList.remove('hidden');
        detailImage.innerHTML = `<img src="${detail.image_url}" alt="피드 이미지">`;
      } else {
        detailImage.classList.add('hidden');
        detailImage.innerHTML = '';
      }
    }
    likeBtn.disabled = false;
    updateFeedLikeButton(likeBtn, detail);
    likeBtn.onclick = () => toggleFeedLike(detail, likeBtn);
    if (detail.is_owner) {
      editBtn?.classList.remove('hidden');
      deleteBtn?.classList.remove('hidden');
      editBtn?.addEventListener('click', () => {
        beginEditFeedPost(detail);
        closeFeedDetail();
      });
      deleteBtn?.addEventListener('click', () => deleteFeedPost(detail));
    }

    renderFeedComments(detail.comments || []);
    if (commentForm && !commentForm.dataset.bound) {
      commentForm.addEventListener('submit', (event) => {
        event.preventDefault();
        submitFeedComment(detail.id, null);
      });
      commentForm.dataset.bound = '1';
    }
  } catch (e) {
    console.error('openFeedDetail failed', e);
    if (e?.message === FEED_API_UNAVAILABLE_ERROR) {
      bodyEl.textContent = FEED_UNAVAILABLE_MESSAGE;
      closeFeedDetail();
      return;
    }
    bodyEl.textContent = '상세 정보를 불러올 수 없습니다.';
  } finally {
    creatorPageState.feed.loadingDetail = false;
  }
}

function closeFeedDetail() {
  const sheet = document.getElementById('feedDetailSheet');
  if (sheet) sheet.classList.add('hidden');
  currentFeedDetail = null;
}

async function fetchFeedDetail(postId) {
  const res = await creatorApiFetch(`/api/creator-feed/${postId}`, {
    headers: await getCreatorAuthHeaders(),
  });
  ensureFeedApiResponse(res, 'feed_detail_failed');
  const detail = await res.json().catch(() => null);
  if (!detail) throw new Error('feed_detail_invalid');
  return detail;
}

function renderFeedComments(comments) {
  const listEl = document.getElementById('feedComments');
  if (!listEl) return;
  listEl.innerHTML = '';
  (comments || []).forEach((comment) => {
    const commentEl = createCommentElement(comment);
    listEl.appendChild(commentEl);
  });
  const form = document.getElementById('feedCommentForm');
  if (form) {
    form.classList.toggle('hidden', !creatorPageState.isLoggedIn);
  }
}

function createCommentElement(comment) {
  const commentEl = document.createElement('div');
  commentEl.className = 'feed-comment';
  commentEl.dataset.commentId = comment.id;

  const header = document.createElement('div');
  header.className = 'feed-comment-header';
  header.textContent = `${comment.author_name || '사용자'} · ${formatFeedDate(comment.created_at)}`;
  const actions = document.createElement('div');
  actions.className = 'feed-comment-actions';

  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.textContent = `${comment.liked ? '♥' : '♡'} ${Number(comment.like_count || 0).toLocaleString('ko-KR')}`;
  likeBtn.addEventListener('click', () => toggleCommentLike(comment, likeBtn));
  actions.appendChild(likeBtn);

  const replyBtn = document.createElement('button');
  replyBtn.type = 'button';
  replyBtn.textContent = '대댓글';
  replyBtn.addEventListener('click', () => showReplyForm(commentEl, comment));
  actions.appendChild(replyBtn);

  if (comment.is_owner) {
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '수정';
    editBtn.addEventListener('click', () => beginEditComment(commentEl, comment));
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '삭제';
    deleteBtn.addEventListener('click', () => deleteFeedComment(comment));
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
  }

  header.appendChild(actions);

  const body = document.createElement('div');
  body.className = 'feed-comment-body';
  body.innerHTML = renderMarkdownToHtml(comment.content || '');

  commentEl.appendChild(header);
  commentEl.appendChild(body);

  if (Array.isArray(comment.replies) && comment.replies.length) {
    const replyList = document.createElement('div');
    replyList.className = 'feed-reply-list';
    comment.replies.forEach((reply) => {
      replyList.appendChild(createCommentElement(reply));
    });
    commentEl.appendChild(replyList);
  }

  return commentEl;
}

function showReplyForm(commentEl, parentComment) {
  if (!ensureLoggedIn()) return;
  if (!commentEl || !parentComment) return;
  let form = commentEl.querySelector('.feed-reply-form');
  if (form) {
    form.classList.toggle('hidden');
    return;
  }
  form = document.createElement('form');
  form.className = 'feed-reply-form';
  const textarea = document.createElement('textarea');
  textarea.rows = 2;
  textarea.placeholder = '대댓글을 입력하세요.';
  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-accent';
  submitBtn.textContent = '등록';
  form.appendChild(textarea);
  form.appendChild(submitBtn);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitFeedComment(parentComment.root_post_id || parentComment.post_id || currentFeedDetail?.id, parentComment.id, textarea.value, () => {
      form.remove();
    });
  });
  commentEl.appendChild(form);
}

function beginEditComment(commentEl, comment) {
  if (!commentEl) return;
  const body = commentEl.querySelector('.feed-comment-body');
  if (!body) return;
  const textarea = document.createElement('textarea');
  textarea.value = comment.content || '';
  textarea.rows = 3;
  const actions = document.createElement('div');
  actions.className = 'feed-comment-actions';
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.textContent = '저장';
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = '취소';
  actions.append(saveBtn, cancelBtn);
  body.replaceWith(textarea);
  commentEl.appendChild(actions);

  saveBtn.addEventListener('click', async () => {
    const content = textarea.value.trim();
    if (!content) {
      alert('내용을 입력하세요.');
      return;
    }
    try {
      await updateFeedComment(comment, content);
      if (body) {
        body.innerHTML = renderMarkdownToHtml(content);
        textarea.replaceWith(body);
        actions.remove();
      }
    } catch (e) {
      console.error('comment edit failed', e);
      if (e?.message !== FEED_API_UNAVAILABLE_ERROR) {
        alert('수정에 실패했습니다.');
      }
    }
  });
  cancelBtn.addEventListener('click', () => {
    textarea.replaceWith(body);
    actions.remove();
  });
}

async function submitFeedComment(postId, parentId = null, overrideContent = null, callback = () => {}) {
  if (!ensureLoggedIn()) return;
  if (!ensureFeedApiAvailable('댓글')) return;
  if (!postId) return;
  const commentInput = parentId ? null : document.getElementById('feedCommentInput');
  const statusEl = parentId ? null : document.getElementById('feedCommentStatus');
  const content = overrideContent !== null ? overrideContent : (commentInput?.value || '');
  if (!content.trim()) {
    if (statusEl) statusEl.textContent = '내용을 입력해주세요.';
    return;
  }
  if (statusEl) statusEl.textContent = '등록 중...';
  try {
    const res = await creatorApiFetch(`/api/creator-feed/${postId}/comments`, {
      method: 'POST',
      headers: await getCreatorAuthHeaders(),
      body: JSON.stringify({
        content,
        parent_id: parentId,
      }),
    });
    ensureFeedApiResponse(res, 'comment_create_failed');
    if (commentInput) commentInput.value = '';
    if (statusEl) statusEl.textContent = '등록되었습니다.';
    const detail = await fetchFeedDetail(postId);
    currentFeedDetail = detail;
    renderFeedComments(detail.comments || []);
    callback();
  } catch (e) {
    console.error('submit comment failed', e);
    if (statusEl) {
      statusEl.textContent =
        e?.message === FEED_API_UNAVAILABLE_ERROR ? FEED_UNAVAILABLE_MESSAGE : '등록에 실패했습니다.';
    }
  } finally {
    if (statusEl) {
      setTimeout(() => {
        statusEl.textContent = '';
      }, 2000);
    }
  }
}

async function updateFeedComment(comment, content) {
  const postId = comment.root_post_id || comment.post_id || currentFeedDetail?.id;
  if (!postId) throw new Error('invalid_comment');
  if (!creatorPageState.feed.apiAvailable) {
    throw markFeedApiUnavailable();
  }
  const res = await creatorApiFetch(`/api/creator-feed/${postId}/comments/${comment.id}`, {
    method: 'PUT',
    headers: await getCreatorAuthHeaders(),
    body: JSON.stringify({ content }),
  });
  ensureFeedApiResponse(res, 'comment_update_failed');
  const detail = await fetchFeedDetail(postId);
  currentFeedDetail = detail;
  renderFeedComments(detail.comments || []);
}

async function deleteFeedComment(comment) {
  if (!window.confirm('댓글을 삭제할까요?')) return;
  const postId = comment.root_post_id || comment.post_id || currentFeedDetail?.id;
  if (!postId) return;
  if (!ensureFeedApiAvailable('댓글')) return;
  try {
    const res = await creatorApiFetch(`/api/creator-feed/${postId}/comments/${comment.id}`, {
      method: 'DELETE',
      headers: await getCreatorAuthHeaders(),
    });
    ensureFeedApiResponse(res, 'comment_delete_failed');
    const detail = await fetchFeedDetail(postId);
    currentFeedDetail = detail;
    renderFeedComments(detail.comments || []);
  } catch (e) {
    console.error('delete comment failed', e);
    if (e?.message !== FEED_API_UNAVAILABLE_ERROR) {
      alert('삭제에 실패했습니다.');
    }
  }
}

async function toggleCommentLike(comment, button) {
  if (!ensureLoggedIn()) return;
  if (!ensureFeedApiAvailable('댓글')) return;
  const postId = comment.root_post_id || comment.post_id || currentFeedDetail?.id;
  if (!postId) return;
  const liked = !comment.liked;
  comment.liked = liked;
  comment.like_count = (Number(comment.like_count) || 0) + (liked ? 1 : -1);
  button.textContent = `${liked ? '♥' : '♡'} ${Number(comment.like_count || 0).toLocaleString('ko-KR')}`;
  try {
    const res = await creatorApiFetch(`/api/creator-feed/${postId}/comments/${comment.id}/like`, {
      method: liked ? 'POST' : 'DELETE',
      headers: await getCreatorAuthHeaders(),
    });
    ensureFeedApiResponse(res, 'comment_like_failed');
  } catch (e) {
    console.error('comment like error', e);
    comment.liked = !liked;
    comment.like_count = (Number(comment.like_count) || 0) + (liked ? -1 : 1);
    button.textContent = `${comment.liked ? '♥' : '♡'} ${Number(comment.like_count || 0).toLocaleString('ko-KR')}`;
    if (e?.message === FEED_API_UNAVAILABLE_ERROR) return;
  }
}

async function getCreatorAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (!window.sb?.auth) return headers;
  try {
    const { data } = await window.sb.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.warn('getCreatorAuthHeaders failed', e);
  }
  return headers;
}

function ensureLoggedIn() {
  if (creatorPageState.isLoggedIn) return true;
  if (window.openLoginModal) {
    window.openLoginModal({ redirect: window.location.href });
  } else {
    window.location.href = '/login';
  }
  return false;
}
