document.addEventListener('DOMContentLoaded', () => {
  initCreatorPage();
});

const PLACEHOLDER_AVATAR = './assets/sample-character-01.png';
const PLACEHOLDER_IMAGE = './assets/og-default.png';

let cachedImageItems = [];

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

    renderHero(targetProfile, isSelf ? ctx?.user : null, isSelf, Boolean(viewerUserId));

    const [characterItems, imageItems] = await Promise.all([
      fetchCharacterItems(targetUserId),
      fetchImageItems(targetUserId),
    ]);

    cachedImageItems = imageItems;
    updateHeroStats({
      characterCount: characterItems.length,
      imageCount: imageItems.length,
      followers: targetProfile.followers_count || 0,
    });
    renderCharacterHighlights(characterItems);

    const allItems = [...characterItems, ...imageItems];
    setupFilters(allItems, cachedImageItems);

    setupShareButton(targetProfile, targetUserId);
  } catch (e) {
    console.error('creator init error', e);
    showCreatorUnavailableState('페이지를 불러오는 중 문제가 발생했습니다.');
  }
}

function renderHero(profile, fallbackUser, isSelf, viewerLoggedIn) {
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

  const nameEl = document.getElementById('creatorName');
  if (nameEl) nameEl.textContent = displayName;
  const handleEl = document.getElementById('creatorHandle');
  if (handleEl) handleEl.textContent = `@${handle}`;
  const badgeEl = document.getElementById('creatorBadge');
  if (badgeEl) badgeEl.textContent = profile?.role?.toUpperCase() || 'CREATOR';

  const bioEl = document.getElementById('creatorBio');
  if (bioEl) bioEl.textContent = profile?.bio?.trim() || '자기소개를 작성하면 여기서 바로 소개됩니다.';
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
      followBtn.onclick = () => (window.location.href = '/mypage');
    } else if (!viewerLoggedIn) {
      followBtn.textContent = '로그인';
      followBtn.onclick = () => (window.location.href = '/login');
    } else {
      followBtn.textContent = '팔로우';
      followBtn.onclick = () => alert('팔로우 기능은 준비 중입니다.');
    }
  }
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

function updateHeroStats({ characterCount = 0, imageCount = 0, followers = 0 }) {
  const charEl = document.getElementById('creatorCharacterCount');
  if (charEl) charEl.textContent = characterCount.toLocaleString('ko-KR');
  const imageEl = document.getElementById('creatorImageCount');
  if (imageEl) imageEl.textContent = imageCount.toLocaleString('ko-KR');
  const followersEl = document.getElementById('creatorFollowers');
  if (followersEl) followersEl.textContent = followers.toLocaleString('ko-KR');
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

function renderGrid(items, imageItems = []) {
  const grid = document.getElementById('creatorGrid');
  const empty = document.getElementById('creatorEmpty');
  if (!grid || !empty) return;

  grid.innerHTML = '';
  if (!items.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const imagesOnly = imageItems.length ? imageItems : items.filter((i) => i.kind === 'image');

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'creator-card';
    card.dataset.kind = item.kind;

    const thumb = document.createElement('div');
    thumb.className = 'creator-card-thumb';
    const picture = createPictureElement(item.thumbUrl || PLACEHOLDER_IMAGE, {
      alt: item.title || (item.kind === 'image' ? '이미지 작품' : '캐릭터'),
    });
    thumb.appendChild(picture);

    const body = document.createElement('div');
    body.className = 'creator-card-body';
    const title = document.createElement('div');
    title.className = 'creator-card-title';
    title.textContent = item.title || (item.kind === 'image' ? '이미지 작품' : '캐릭터');
    const sub = document.createElement('div');
    sub.className = 'creator-card-sub';
    sub.textContent = item.subtitle || '';
    const meta = document.createElement('div');
    meta.className = 'creator-card-meta';
    meta.textContent = item.kind === 'image' ? '이미지' : '캐릭터';

    body.appendChild(title);
    body.appendChild(sub);
    body.appendChild(meta);

    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener('click', () => {
      if (item.kind === 'image' && typeof window.openDrawerImageModal === 'function') {
        window.openDrawerImageModal(imagesOnly, item.id);
      } else if (item.kind === 'character') {
        window.location.href = `/character?id=${item.id}`;
      }
    });

    grid.appendChild(card);
  });
}

function setupFilters(allItems, imageItems) {
  const chips = document.querySelectorAll('.filter-chip');
  if (!chips.length) return;

  const applyFilter = (filter) => {
    let filtered = allItems;
    if (filter === 'image') filtered = allItems.filter((i) => i.kind === 'image');
    if (filter === 'character') filtered = allItems.filter((i) => i.kind === 'character');
    renderGrid(filtered, imageItems);
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.dataset.filter || 'all';
      applyFilter(filter);
    });
  });

  const activeChip = document.querySelector('.filter-chip.active');
  applyFilter(activeChip?.dataset.filter || 'all');
}

async function fetchCharacterItems(userId) {
  if (!window.sb) return [];
  try {
    const { data, error } = await window.sb
      .from('character_chats')
      .select('character_id, created_at, characters(name, avatar_url, description)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(150);
    if (error) throw error;

    const seen = new Set();
    const unique = [];
    for (const row of data || []) {
      if (!row.character_id || seen.has(row.character_id)) continue;
      seen.add(row.character_id);
      unique.push(row);
    }

    return unique.map((row) => ({
      id: row.character_id,
      kind: 'character',
      title: row.characters?.name || '나의 캐릭터',
      subtitle: row.characters?.description || '소개가 아직 없습니다.',
      thumbUrl: row.characters?.avatar_url || PLACEHOLDER_AVATAR,
    }));
  } catch (e) {
    console.error('fetchCharacterItems error', e);
    return [];
  }
}

async function fetchImageItems(userId) {
  if (!window.sb) return [];
  try {
    const { data, error } = await window.sb
      .from('user_contents')
      .select('id, title, prompt, thumb_url, full_url, created_at')
      .eq('user_id', userId)
      .eq('kind', 'image')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      kind: 'image',
      title: row.title?.trim() || truncate(row.prompt, 40) || '이미지 작품',
      subtitle: row.created_at
        ? new Date(row.created_at).toLocaleDateString('ko-KR')
        : '최근 생성',
      thumbUrl: row.thumb_url || row.full_url || PLACEHOLDER_IMAGE,
      fullUrl: row.full_url || row.thumb_url || PLACEHOLDER_IMAGE,
    }));
  } catch (e) {
    console.error('fetchImageItems error', e);
    return [];
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
  if (!shareBtn) return;
  const shareUrl = new URL(window.location.origin + '/creator');
  if (targetUserId) {
    shareUrl.searchParams.set('user', targetUserId);
  }
  const shareData = {
    title: `${profile?.display_name || '크리에이터'} | crama`,
    text: '제가 만든 캐릭터와 이미지를 소개합니다.',
    url: shareUrl.toString(),
  };

  shareBtn.onclick = async () => {
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('share failed', err);
        }
      }
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareData.url);
      alert('링크가 복사되었습니다.');
    } else {
      prompt('아래 링크를 복사해서 공유하세요.', shareData.url);
    }
  };
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
