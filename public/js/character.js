(function () {
const apiFetch = window.apiFetch || ((...args) => fetch(...args));

// ================================
// 탭 전환
// ================================
document.querySelectorAll('.character-side .side-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const panelId = tab.dataset.panel;

    document
      .querySelectorAll('.character-side .side-tab')
      .forEach(t => t.classList.remove('side-tab--active'));

    tab.classList.add('side-tab--active');

    document
      .querySelectorAll('.character-side .side-panel')
      .forEach(p => p.classList.remove('side-panel--active'));

    const panel = document.getElementById(panelId);
    if (panel) panel.classList.add('side-panel--active');
  });
});

const CHAT_FETCH_LIMIT = 30;
const CHAT_MODE_CONFIG_URL = '/data/chat-modes.json';
const CHAT_MODE_PREF_KEY = 'crama_chat_mode_pref';
const DEFAULT_MULTIPLIER_PRESET = [1, 1.25, 1.5, 2, 2.5, 3, 4, 5];
const DEFAULT_CHAT_MODE_FALLBACK = {
  key: 'default',
  name: '기본 모드',
  tagline: '표준 응답',
  baseTokens: 512,
  baseCredits: 10,
  extraCreditPerIncrement: 5,
  tokenIncrement: 100,
  multipliers: [1, 1.5, 2],
  defaultMultiplier: 1
};

let sceneModeEnabled = false;
let currentSceneTemplates = [];
let sceneTemplatesCollapsed = true;
let oldestMessageTimestamp = null;
let hasMoreChats = false;
let currentChatSessionId = null;
let loadMoreInFlight = false;
let chatModeConfigPayload = { tokenIncrement: 100, modes: [] };
let chatModePrefs = { multipliers: {}, selectedKey: null };
let activeChatModeKey = null;
let chatModeModalDraft = null;
let chatModeListBound = false;
let chatModeModalBound = false;
let chatModesInitialized = false;
let lastNonSceneModeKey = null;
let sceneModeNoteTimer = null;
let activeCharacterId = null;
let currentUserContext = null;
let currentUserId = null;
const DEFAULT_AVATAR_PLACEHOLDER = '/assets/sample-character-01.png';
let currentCharacterAvatarUrl = DEFAULT_AVATAR_PLACEHOLDER;
let currentCharacterData = null;
let headerSheetsInitialized = false;

function updateCharacterMetaTags(meta = {}) {
  const rawName = typeof meta.name === 'string' ? meta.name.trim() : '';
  const charName = rawName || '캐릭터';
  const summary = (meta.summary && meta.summary.trim()) || `${charName}와 대화를 이어가세요.`;
  const detail =
    (meta.description && meta.description.trim()) ||
    summary ||
    '크라마 캐릭터와 실시간으로 대화해 보세요.';
  const baseTitle = `${charName} | 크라마(crama)`;
  document.title = baseTitle;
  const setMeta = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && value) {
      el.setAttribute('content', value);
    }
  };
  setMeta('meta[property="og:title"]', `${charName} 캐릭터 대화 | 크라마(crama)`);
  setMeta('meta[name="twitter:title"]', `${charName} 캐릭터 대화 | 크라마(crama)`);
  setMeta('meta[name="description"]', summary);
  setMeta('meta[property="og:description"]', detail);
  setMeta('meta[name="twitter:description"]', detail);
}

function escapeHtml(value) {
  return (value || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTokens(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')} 토큰`;
}

function formatScene(value) {
  return `${Number(value || 0).toLocaleString('ko-KR')} scene`;
}

function formatMultiplierLabel(multiplier) {
  if (multiplier === undefined || multiplier === null) return '기본';
  return Math.abs(Number(multiplier) - 1) < 0.0001 ? '기본' : `${Number(multiplier).toLocaleString('ko-KR')}x`;
}

let placeholderUserName = '손님';
let placeholderContextInitialized = false;
const DEFAULT_BACKGROUND_PREVIEW = '/assets/sample-character-02.png';
const backgroundState = {
  enabled: false,
  loading: false,
  error: null,
  entries: {},
  selectedKey: null
};

async function initPlaceholderContext(force = false) {
  if (placeholderContextInitialized && !force) {
    return placeholderUserName;
  }
  try {
    const ctx = await ensureUserContext(force);
    if (ctx) {
      const resolvedName =
        ctx.profile?.handle ||
        ctx.profile?.display_name ||
        ctx.user?.user_metadata?.user_name ||
        ctx.user?.user_metadata?.name ||
        ctx.user?.user_metadata?.full_name ||
        ctx.user?.email?.split('@')[0];
      if (resolvedName) placeholderUserName = resolvedName;
    }
  } catch (e) {
    console.warn('placeholder context init failed', e);
  } finally {
    placeholderContextInitialized = true;
  }
  return placeholderUserName;
}

function renderWithPlaceholders(input, charName, userName) {
  const base = input ?? '';
  const text = typeof base === 'string' ? base : String(base);
  if (!text) return '';
  const characterLabel = (charName && String(charName).trim()) || '캐릭터';
  const userLabel = (userName && String(userName).trim()) || placeholderUserName || '손님';
  return text
    .replace(/{{\s*char\s*}}/gi, characterLabel)
    .replace(/{{\s*user\s*}}/gi, userLabel);
}

window.initCharacterPlaceholderContext = initPlaceholderContext;
window.renderCharacterPlaceholders = renderWithPlaceholders;

async function ensureUserContext(force = false) {
  if (!force && currentUserContext) return currentUserContext;
  if (typeof window.fetchUserContext !== 'function') return null;
  try {
    currentUserContext = await window.fetchUserContext();
    currentUserId = currentUserContext?.user?.id || null;
  } catch (error) {
    console.warn('fetchUserContext failed', error);
    currentUserContext = null;
    currentUserId = null;
  }
  return currentUserContext;
}

function applyChatBackgroundFromSelection() {
  const container = document.querySelector('.chat-messages-container');
  if (!container) return;
  const selectedKey = backgroundState.selectedKey || null;
  const entry = selectedKey ? backgroundState.entries[selectedKey] : null;
  if (entry?.imageUrl) {
    container.style.setProperty('--chat-background-image', `url("${entry.imageUrl}")`);
    container.classList.add('chat-messages-container--custom');
  } else {
    container.style.removeProperty('--chat-background-image');
    container.classList.remove('chat-messages-container--custom');
  }
}

async function loadCharacterBackgroundState(characterId, options = {}) {
  backgroundState.loading = true;
  backgroundState.error = null;
  backgroundState.entries = backgroundState.entries || {};
  backgroundState.enabled = false;
  renderBackgroundCollection();
  if (!characterId || !window.sb) {
    backgroundState.loading = false;
    renderBackgroundCollection();
    applyChatBackgroundFromSelection();
    return;
  }
  await ensureUserContext(options.forceUserContext);
  if (!currentUserId) {
    backgroundState.loading = false;
    renderBackgroundCollection();
    applyChatBackgroundFromSelection();
    return;
  }
  try {
    const { data, error } = await window.sb
      .from('character_backgrounds')
      .select('background_key,label,description,image_url,is_active')
      .eq('character_id', characterId)
      .order('unlocked_at', { ascending: true });
    if (error) throw error;
    const map = {};
    let selectedKey = null;
    (data || []).forEach((row) => {
      map[row.background_key] = {
        key: row.background_key,
        label: row.label || '',
        description: row.description || '',
        imageUrl: row.image_url || '',
        isActive: Boolean(row.is_active)
      };
      if (row.is_active) selectedKey = row.background_key;
    });
    backgroundState.entries = map;
    backgroundState.selectedKey = selectedKey;
    backgroundState.enabled = true;
  } catch (error) {
    console.warn('background load failed', error);
    backgroundState.entries = {};
    backgroundState.selectedKey = null;
    backgroundState.error = error;
    backgroundState.enabled = false;
  } finally {
    backgroundState.loading = false;
    renderBackgroundCollection();
    applyChatBackgroundFromSelection();
  }
}

function generateSceneBackgroundKey(scene) {
  if (!scene) return null;
  if (scene.id) return `id:${scene.id}`;
  const url = scene.image_url || scene.url || scene.imageUrl;
  if (url) return url;
  if (scene.label) return `label:${scene.label.trim().toLowerCase()}`;
  if (scene.description) return `desc:${scene.description.trim().slice(0, 40)}`;
  return null;
}

function renderBackgroundCollection() {
  const container = document.getElementById('chatBackgroundCollection');
  if (!container) return;
  if (!activeCharacterId) {
    container.innerHTML =
      '<p class="background-collection__empty">캐릭터 정보를 불러오는 중입니다.</p>';
    return;
  }
  if (!backgroundState.enabled) {
    if (backgroundState.loading) {
      container.innerHTML =
        '<p class="background-collection__empty">Scene 배경을 불러오는 중입니다...</p>';
    } else if (!currentUserId) {
      container.innerHTML =
        '<p class="background-collection__empty">로그인하면 Scene 배경을 수집하고 사용할 수 있습니다.</p>';
    } else if (backgroundState.error) {
      container.innerHTML =
        '<p class="background-collection__empty">Scene 배경을 불러오지 못했습니다. 새로고침해 주세요.</p>';
    } else {
      container.innerHTML =
        '<p class="background-collection__empty">Scene 배경 기능을 사용할 수 없습니다.</p>';
    }
    return;
  }
  const unlockedMap = backgroundState.entries || {};
  const selectedKey = backgroundState.selectedKey || null;

  const unlockedEntries = [];
  const lockedEntries = [];

  const baseEntry = {
    key: 'default',
    label: '기본 배경',
    description: '크라마 기본 어두운 테마',
    unlocked: true,
    imageUrl: null,
    preview: DEFAULT_BACKGROUND_PREVIEW,
    isDefault: true
  };
  unlockedEntries.push(baseEntry);

  const templateKeys = new Set();
  const matchedUnlockedKeys = new Set();

  const matchUnlockedEntry = (templateKey, template) => {
    if (unlockedMap[templateKey]) {
      matchedUnlockedKeys.add(templateKey);
      return { key: templateKey, data: unlockedMap[templateKey] };
    }
    const tmplImage = template.image_url || template.url || template.imageUrl || '';
    const tmplLabel = (template.label || '').trim().toLowerCase();
    const tmplDesc = (template.description || '').trim().toLowerCase();
    for (const [storedKey, info] of Object.entries(unlockedMap)) {
      if (matchedUnlockedKeys.has(storedKey)) continue;
      const infoImage = info.imageUrl || info.url || '';
      const infoLabel = (info.label || '').trim().toLowerCase();
      const infoDesc = (info.description || '').trim().toLowerCase();
      const matched =
        (tmplImage && infoImage && tmplImage === infoImage) ||
        (tmplLabel && infoLabel && tmplLabel === infoLabel) ||
        (tmplDesc && infoDesc && tmplDesc === infoDesc);
      if (matched) {
        matchedUnlockedKeys.add(storedKey);
        return { key: storedKey, data: info };
      }
    }
    return null;
  };

  currentSceneTemplates.forEach((template, idx) => {
    const templateKey = generateSceneBackgroundKey(template) || `template:${idx}`;
    const matchInfo = matchUnlockedEntry(templateKey, template);
    const key = matchInfo?.key || templateKey;
    templateKeys.add(templateKey);
    templateKeys.add(key);
    const unlockedData = matchInfo?.data || unlockedMap[templateKey];
    const entry = {
      key,
      label: template.label || `Scene ${idx + 1}`,
      description: template.description || (Array.isArray(template.keywords) ? template.keywords.join(', ') : ''),
      unlocked: Boolean(unlockedData),
      imageUrl: (unlockedData && (unlockedData.imageUrl || unlockedData.url)) || template.image_url || template.url || null,
      preview: template.image_url || template.url || DEFAULT_BACKGROUND_PREVIEW
    };
    if (entry.unlocked) {
      unlockedEntries.push(entry);
    } else {
      lockedEntries.push(entry);
    }
  });

  Object.keys(unlockedMap || {}).forEach((key) => {
    if (templateKeys.has(key)) return;
    if (matchedUnlockedKeys.has(key)) return;
    const info = unlockedMap[key];
    unlockedEntries.push({
      key,
      label: info.label || '수집된 Scene',
      description: info.description || '',
      unlocked: true,
      imageUrl: info.imageUrl || info.url || null,
      preview: info.imageUrl || info.url || DEFAULT_BACKGROUND_PREVIEW,
      customOrigin: true
    });
  });

  const entries = [...unlockedEntries, ...lockedEntries];

  const cards = entries
    .map((entry) => {
      const isDefault = entry.key === 'default';
      const unlocked = entry.unlocked || isDefault;
      const isActive = (selectedKey === entry.key) || (!selectedKey && isDefault);
      const previewSrc = entry.imageUrl || entry.preview || DEFAULT_BACKGROUND_PREVIEW;
      const preview = encodeURI(previewSrc);
      const safeLabel = escapeHtml(entry.label || 'Scene');
      const descriptionSource = (entry.description && entry.description.trim()) || '';
      const descriptionText = descriptionSource || (unlocked ? '' : 'Scene 모드에서 수집하세요.');
      const safeDescription = escapeHtml(descriptionText);
      const actionLabel = isActive ? '사용 중' : unlocked ? '적용' : '잠금';
      const safeKey = escapeHtml(entry.key);
      const collectedBadge = !isDefault && unlocked ? '<span class="background-card__collected">수집 완료</span>' : '';
      const lockedBadge = !isDefault && !unlocked ? '<span class="background-card__lock">LOCKED</span>' : '';
      return `
        <div class="background-card${unlocked ? '' : ' background-card--locked'}${isActive ? ' background-card--active' : ''}">
          <div class="background-card__thumb" style="background-image: url('${preview}');">
            ${isDefault ? '<span class="background-card__badge">기본</span>' : ''}
            ${collectedBadge}
            ${lockedBadge}
            ${isActive ? '<span class="background-card__active">ACTIVE</span>' : ''}
          </div>
          <div class="background-card__body">
            <strong>${safeLabel}</strong>
            <p>${safeDescription}</p>
          </div>
          <button
            type="button"
            class="background-card__action"
            data-bg-key="${safeKey}"
            ${!unlocked ? 'disabled' : ''}
          >
            ${actionLabel}
          </button>
        </div>
      `;
    })
    .join('');

  if (cards) {
    container.dataset.empty = 'false';
    container.innerHTML = cards;
  } else {
    container.dataset.empty = 'true';
    container.innerHTML = `
      <p class="background-collection__empty">
        Scene 이미지를 모으면 배경으로 사용할 수 있어요.
      </p>
    `;
  }
}

async function selectChatBackground(key) {
  if (!activeCharacterId) return;
  const normalizedKey = key && key !== 'default' ? key : null;
  if (normalizedKey && !backgroundState.entries[normalizedKey]) return;
  if (!window.sb || !currentUserId) {
    backgroundState.selectedKey = normalizedKey;
    applyChatBackgroundFromSelection();
    renderBackgroundCollection();
    return;
  }
  try {
    await window.sb
      .from('character_backgrounds')
      .update({ is_active: false })
      .eq('character_id', activeCharacterId)
      .eq('user_id', currentUserId);
    if (normalizedKey) {
      await window.sb
        .from('character_backgrounds')
        .update({ is_active: true })
        .eq('character_id', activeCharacterId)
        .eq('user_id', currentUserId)
        .eq('background_key', normalizedKey);
    }
    Object.values(backgroundState.entries).forEach((entry) => {
      entry.isActive = entry.key === normalizedKey;
    });
    backgroundState.selectedKey = normalizedKey;
  } catch (error) {
    console.warn('selectChatBackground failed', error);
  }
  applyChatBackgroundFromSelection();
  renderBackgroundCollection();
}

async function maybeCollectSceneBackground(scene) {
  if (!scene || !activeCharacterId) return;
  const key = generateSceneBackgroundKey(scene);
  const imageUrl = scene.image_url || scene.url || scene.imageUrl;
  if (!key || !imageUrl) return;
  if (!window.sb || !currentUserId) return;
  if (backgroundState.entries[key]) return;
  try {
    const payload = {
      user_id: currentUserId,
      character_id: activeCharacterId,
      background_key: key,
      label: scene.label || 'Scene 이미지',
      description: scene.description || '',
      image_url: imageUrl
    };
    await window.sb.from('character_backgrounds').upsert(payload, {
      onConflict: 'user_id,character_id,background_key'
    });
    backgroundState.entries[key] = {
      key,
      label: payload.label,
      description: payload.description,
      imageUrl,
      isActive: false
    };
    renderBackgroundCollection();
    if (typeof showSceneModeNote === 'function') {
      showSceneModeNote(`새 Scene 배경을 수집했습니다: ${scene.label || '장면 이미지'}`);
    }
  } catch (error) {
    console.warn('background collect failed', error);
  }
}

function bindBackgroundSettings() {
  const collection = document.getElementById('chatBackgroundCollection');
  if (collection && !collection.dataset.bound) {
    collection.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('.background-card__action');
      if (!actionBtn) return;
      const key = actionBtn.dataset.bgKey;
      if (!key) return;
      selectChatBackground(key);
    });
    collection.dataset.bound = '1';
  }
  const resetBtn = document.getElementById('resetChatBackgroundBtn');
  if (resetBtn && !resetBtn.dataset.bound) {
    resetBtn.addEventListener('click', () => selectChatBackground(null));
    resetBtn.dataset.bound = '1';
  }
}

function initChatSettingsNav() {
  const nav = document.getElementById('chatSettingsNav');
  if (!nav) return;
  nav.addEventListener('click', (event) => {
    const btn = event.target.closest('.chat-settings-nav__btn');
    if (!btn) return;
    const targetId = btn.getAttribute('data-settings-view');
    if (!targetId) return;
    nav.querySelectorAll('.chat-settings-nav__btn').forEach((el) => el.classList.remove('chat-settings-nav__btn--active'));
    btn.classList.add('chat-settings-nav__btn--active');
    document.querySelectorAll('.chat-settings-view').forEach((view) => {
      view.classList.toggle('chat-settings-view--active', view.id === targetId);
    });
  });
}

function getExtraCreditPerIncrement(mode) {
  return (
    Number(
      mode?.extraCreditPerIncrement ??
        mode?.perIncrementCredits ??
        mode?.per100Tokens ??
        DEFAULT_CHAT_MODE_FALLBACK.extraCreditPerIncrement
    ) || 0
  );
}

function normalizeMultiplierList(list) {
  return Array.from(
    new Set(
      (list || [])
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 1)
    )
  ).sort((a, b) => a - b);
}

function getModeMultipliers(mode) {
  const base = normalizeMultiplierList(mode?.multipliers);
  if (!base.length) {
    return normalizeMultiplierList(DEFAULT_MULTIPLIER_PRESET);
  }
  const extended = normalizeMultiplierList([...base, ...DEFAULT_MULTIPLIER_PRESET]);
  return extended.length ? extended : normalizeMultiplierList(DEFAULT_MULTIPLIER_PRESET);
}

async function loadChatModeConfig() {
  try {
    const res = await fetch(CHAT_MODE_CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('failed to load chat mode config');
    const payload = await res.json();
    if (!payload || !Array.isArray(payload.modes)) {
      throw new Error('invalid chat mode config');
    }
    chatModeConfigPayload = payload;
  } catch (e) {
    console.warn('chat mode config fetch failed', e);
    chatModeConfigPayload = { tokenIncrement: DEFAULT_CHAT_MODE_FALLBACK.tokenIncrement, modes: [] };
  }
}

function getChatModeList() {
  const modes = Array.isArray(chatModeConfigPayload?.modes) ? chatModeConfigPayload.modes : [];
  return modes.length ? modes : [DEFAULT_CHAT_MODE_FALLBACK];
}

function resolveDefaultMultiplier(mode) {
  const multipliers = getModeMultipliers(mode);
  const preferred = Number(mode?.defaultMultiplier);
  if (!Number.isNaN(preferred) && multipliers.includes(preferred)) {
    return preferred;
  }
  return multipliers[0];
}

function resolveModeMultiplierClient(mode, multiplier) {
  const multipliers = getModeMultipliers(mode);
  const numeric = Number(multiplier);
  if (!Number.isNaN(numeric)) {
    const matched = multipliers.find((value) => Math.abs(value - numeric) < 0.0001);
    if (typeof matched === 'number') return matched;
  }
  return resolveDefaultMultiplier(mode);
}

function computeChatModeUsageClient(modeInput, multiplier) {
  const mode = modeInput || getChatModeList()[0] || DEFAULT_CHAT_MODE_FALLBACK;
  const baseTokens = Number(mode?.baseTokens) || DEFAULT_CHAT_MODE_FALLBACK.baseTokens;
  const baseCredits = Number(mode?.baseCredits) || DEFAULT_CHAT_MODE_FALLBACK.baseCredits;
  const incrementSize =
    Number(mode?.tokenIncrement || chatModeConfigPayload?.tokenIncrement || DEFAULT_CHAT_MODE_FALLBACK.tokenIncrement) ||
    DEFAULT_CHAT_MODE_FALLBACK.tokenIncrement;
  const extraCreditPerIncrement =
    getExtraCreditPerIncrement(mode);
  const selectedMultiplier = resolveModeMultiplierClient(mode, multiplier);
  const rawTokens = Math.round(baseTokens * selectedMultiplier);
  const maxTokens = Math.max(baseTokens, rawTokens);
  const additionalTokens = Math.max(0, maxTokens - baseTokens);
  const increments = incrementSize > 0 ? Math.ceil(additionalTokens / incrementSize) : 0;
  const creditCost = baseCredits + increments * extraCreditPerIncrement;
  return {
    mode,
    multiplier: selectedMultiplier,
    maxTokens,
    creditCost,
    extraCreditPerIncrement,
    incrementSize
  };
}

function loadChatModePrefsFromStorage() {
  try {
    const raw = localStorage.getItem(CHAT_MODE_PREF_KEY);
    if (!raw) return { multipliers: {}, selectedKey: null };
    const parsed = JSON.parse(raw);
    const multipliers =
      parsed && typeof parsed.multipliers === 'object' && parsed.multipliers !== null ? parsed.multipliers : {};
    const selectedKey = typeof parsed?.selectedKey === 'string' ? parsed.selectedKey : null;
    return { multipliers, selectedKey };
  } catch (e) {
    console.warn('chat mode pref parse failed', e);
    return { multipliers: {}, selectedKey: null };
  }
}

function persistChatModePrefs() {
  if (!chatModesInitialized) return;
  try {
    localStorage.setItem(
      CHAT_MODE_PREF_KEY,
      JSON.stringify({
        selectedKey: chatModePrefs.selectedKey,
        multipliers: chatModePrefs.multipliers
      })
    );
  } catch (e) {
    console.warn('chat mode pref save failed', e);
  }
}

function ensureModePref(mode) {
  if (!mode?.key) return;
  if (typeof chatModePrefs.multipliers?.[mode.key] !== 'number') {
    chatModePrefs.multipliers = chatModePrefs.multipliers || {};
    chatModePrefs.multipliers[mode.key] = resolveDefaultMultiplier(mode);
  }
}

function getActiveChatModeSelection() {
  const modes = getChatModeList();
  let mode = modes.find((item) => item.key === activeChatModeKey);
  if (!mode) {
    mode = modes.find((item) => item.key === chatModePrefs.selectedKey) || modes[0];
    if (mode) {
      activeChatModeKey = mode.key;
      chatModePrefs.selectedKey = mode.key;
    }
  }
  if (!mode) {
    mode = DEFAULT_CHAT_MODE_FALLBACK;
    activeChatModeKey = mode.key;
    chatModePrefs.selectedKey = mode.key;
  }
  const hasSceneTemplates = currentSceneTemplates.length > 0;
  if (mode?.sceneMode && !hasSceneTemplates) {
    const fallback = modes.find((item) => !item.sceneMode) || mode;
    if (fallback && fallback.key !== mode.key) {
      mode = fallback;
      activeChatModeKey = fallback.key;
      chatModePrefs.selectedKey = fallback.key;
      persistChatModePrefs();
    }
  }
  ensureModePref(mode);
  if (!mode.sceneMode) {
    lastNonSceneModeKey = mode.key;
  }
  sceneModeEnabled = Boolean(mode.sceneMode && hasSceneTemplates);
  const multiplier = chatModePrefs.multipliers?.[mode.key];
  return {
    mode,
    multiplier,
    usage: computeChatModeUsageClient(mode, multiplier)
  };
}

function renderChatModeCards() {
  const container = document.getElementById('chatModeList');
  if (!container) return;
  const modes = getChatModeList();
  if (!modes.length) {
    container.innerHTML = '<p class="chat-mode-panel__empty">사용 가능한 모드가 없습니다.</p>';
    return;
  }
  const fragment = document.createDocumentFragment();
  const hasSceneTemplates = currentSceneTemplates.length > 0;
  modes.forEach((mode) => {
    ensureModePref(mode);
    const selection = computeChatModeUsageClient(mode, chatModePrefs.multipliers?.[mode.key]);
    const button = document.createElement('button');
    button.type = 'button';
    const requiresScene = Boolean(mode.sceneMode);
    const locked = requiresScene && !hasSceneTemplates;
    const isActive = mode.key === activeChatModeKey;
    const classNames = ['chat-mode-card'];
    if (isActive) classNames.push('chat-mode-card--active');
    if (locked) classNames.push('chat-mode-card--locked');
    button.className = classNames.join(' ');
    button.dataset.modeKey = mode.key;
    if (locked) {
      button.setAttribute('aria-disabled', 'true');
      button.dataset.locked = '1';
    } else {
      button.removeAttribute('aria-disabled');
      delete button.dataset.locked;
    }
    const badge = document.createElement('span');
    badge.className = 'chat-mode-card__badge';
    badge.textContent = mode.badge || '모드';
    const name = document.createElement('span');
    name.className = 'chat-mode-card__name';
    name.textContent = mode.name || '모드';
    const tagline = document.createElement('span');
    tagline.className = 'chat-mode-card__tagline';
    if (locked) {
      tagline.textContent = '상황 이미지가 없어 사용할 수 없습니다.';
    } else {
      tagline.textContent = mode.tagline || mode.description || '';
    }
    const meta = document.createElement('div');
    meta.className = 'chat-mode-card__meta';
    const metaTokens = document.createElement('span');
    metaTokens.textContent = formatTokens(selection.maxTokens);
    const metaCredits = document.createElement('span');
    metaCredits.textContent = formatScene(selection.creditCost);
    meta.append(metaTokens, metaCredits);
    button.append(badge, name, tagline, meta);
    fragment.appendChild(button);
  });
  container.innerHTML = '';
  container.appendChild(fragment);
}

function updateChatModeSummary() {
  const summary = getActiveChatModeSelection();
  if (!summary) return;
  const { mode, usage } = summary;
  const metaText = `${formatTokens(usage.maxTokens)} · ${formatScene(usage.creditCost)}`;
  const nameEl = document.getElementById('chatModeActiveName');
  const metaEl = document.getElementById('chatModeActiveMeta');
  const tipEl = document.getElementById('chatModeCreditTip');
  const indicator = document.getElementById('chatCostIndicator');
  if (nameEl) nameEl.textContent = mode.name || '기본 모드';
  if (metaEl) metaEl.textContent = metaText;
  if (tipEl) {
    if (mode.sceneMode) {
      tipEl.textContent = sceneModeEnabled
        ? '상황 이미지를 함께 사용하며 장면 몰입도를 높입니다.'
        : '이 모드는 Scene 이미지를 사용하지만 현재 캐릭터에는 상황 이미지가 없습니다.';
    } else {
      const tagline = mode.description || mode.tagline || '응답 길이와 톤이 다른 모드입니다.';
      tipEl.textContent = `${tagline} · 토큰 길이는 모드별로 다릅니다.`;
    }
  }
  if (indicator) {
    let sceneSuffix = '';
    if (mode.sceneMode) {
      sceneSuffix = sceneModeEnabled
        ? ' · 상황 이미지 사용 시 scene이 추가로 차감됩니다.'
        : ' · 상황 이미지를 등록하면 SCENE 모드를 활성화할 수 있습니다.';
    } else {
      sceneSuffix = ' · Scene 소모 없이 대화에 집중합니다.';
    }
    indicator.textContent = `예상 ${formatScene(usage.creditCost)} · 최대 ${formatTokens(usage.maxTokens)}${sceneSuffix}`;
  }
  updateSceneModeIndicator(mode, usage);
}

function setActiveChatMode(modeKey) {
  if (!modeKey) return;
  const mode = getChatModeList().find((item) => item.key === modeKey);
  if (!mode) return;
  const hasSceneTemplates = currentSceneTemplates.length > 0;
  if (mode.sceneMode && !hasSceneTemplates) {
    showSceneModeNote('상황 이미지가 없어서 SCENE 연출만 비활성화됩니다.');
  }
  ensureModePref(mode);
  activeChatModeKey = mode.key;
  chatModePrefs.selectedKey = mode.key;
  if (!mode.sceneMode) {
    lastNonSceneModeKey = mode.key;
  }
  sceneModeEnabled = Boolean(mode.sceneMode && hasSceneTemplates);
  clearSceneModeNote();
  persistChatModePrefs();
  renderChatModeCards();
  updateChatModeSummary();
}

function bindChatModeListEvents() {
  if (chatModeListBound) return;
  const container = document.getElementById('chatModeList');
  if (!container) return;
  container.addEventListener('click', (event) => {
    const card = event.target.closest('.chat-mode-card');
    if (!card) return;
    if (card.classList.contains('chat-mode-card--locked') || card.getAttribute('aria-disabled') === 'true') {
      showSceneModeNote('상황 이미지를 등록하면 이 모드를 사용할 수 있습니다.');
      return;
    }
    setActiveChatMode(card.dataset.modeKey);
  });
  chatModeListBound = true;
}

function updateSliderVisual(slider, currentIndex, maxIndex) {
  if (!slider) return;
  const progress = maxIndex <= 0 ? 100 : Math.max(0, Math.min(1, currentIndex / maxIndex)) * 100;
  slider.style.setProperty('--slider-progress', `${progress}%`);
}

function renderChatModeModalBody() {
  const bodyEl = document.getElementById('chatModeModalBody');
  if (!bodyEl) return;
  const modes = getChatModeList();
  if (!chatModeModalDraft) chatModeModalDraft = { ...(chatModePrefs.multipliers || {}) };
  bodyEl.innerHTML = '';
  const fragment = document.createDocumentFragment();
  modes.forEach((mode) => {
    ensureModePref(mode);
    const multipliers = getModeMultipliers(mode);
    const storedMultiplier = chatModeModalDraft?.[mode.key] ?? chatModePrefs.multipliers?.[mode.key];
    const usage = computeChatModeUsageClient(mode, storedMultiplier);
    const item = document.createElement('article');
    item.className = 'chat-mode-modal-item';
    const header = document.createElement('div');
    header.className = 'chat-mode-modal-item__header';
    const titleWrap = document.createElement('div');
    titleWrap.className = 'chat-mode-modal-item__title-wrap';
    const title = document.createElement('h4');
    title.className = 'chat-mode-modal-item__title';
    title.textContent = mode.name || '모드';
    const multiplierBadge = document.createElement('span');
    multiplierBadge.className = 'chat-mode-modal-item__multiplier';
    multiplierBadge.textContent = `${formatMultiplierLabel(usage.multiplier)} (${formatTokens(usage.maxTokens)})`;
    const sub = document.createElement('p');
    sub.className = 'chat-mode-modal-item__sub';
    sub.textContent = `추가 100토큰당 ${getExtraCreditPerIncrement(mode).toLocaleString('ko-KR')} scene`;
    titleWrap.append(title, multiplierBadge, sub);
    const limit = document.createElement('span');
    limit.className = 'chat-mode-modal-item__limit';
    limit.textContent = `최대 ${formatScene(usage.creditCost)}`;
    header.append(titleWrap, limit);
    const tagline = document.createElement('p');
    tagline.className = 'chat-mode-modal-item__tagline';
    tagline.textContent = mode.description || mode.tagline || '응답 길이를 조절하세요.';
    const sliderWrap = document.createElement('div');
    sliderWrap.className = 'chat-mode-modal-slider';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'chat-mode-slider-input';
    slider.min = 0;
    slider.max = multipliers.length - 1;
    slider.step = 1;
    const initialIndex = multipliers.findIndex((value) => Math.abs(value - storedMultiplier) < 0.0001);
    slider.value = String(initialIndex >= 0 ? initialIndex : 0);
    slider.dataset.modeKey = mode.key;
    updateSliderVisual(slider, Number(slider.value), multipliers.length - 1);
    const labels = document.createElement('div');
    labels.className = 'chat-mode-slider-labels';
    multipliers.forEach((value, idx) => {
      const option = document.createElement('span');
      option.textContent = idx === 0 ? '기본' : `${value}x`;
      option.dataset.index = String(idx);
      if (idx === Number(slider.value)) option.classList.add('active');
      labels.appendChild(option);
    });
    sliderWrap.append(slider, labels);
    const summary = document.createElement('div');
    summary.className = 'chat-mode-modal-summary';
    const tokenSpan = document.createElement('span');
    tokenSpan.textContent = formatTokens(usage.maxTokens);
    tokenSpan.dataset.modeKey = `${mode.key}-token`;
    const creditSpan = document.createElement('span');
    creditSpan.textContent = formatScene(usage.creditCost);
    creditSpan.dataset.modeKey = `${mode.key}-credit`;
    summary.append(tokenSpan, creditSpan);
    slider.addEventListener('input', () => {
      const idx = Number(slider.value);
      const nextMultiplier = multipliers[idx] ?? multipliers[0];
      chatModeModalDraft[mode.key] = nextMultiplier;
      const nextUsage = computeChatModeUsageClient(mode, nextMultiplier);
      Array.from(labels.children).forEach((child) => {
        child.classList.toggle('active', child.dataset.index === String(idx));
      });
      multiplierBadge.textContent = `${formatMultiplierLabel(nextUsage.multiplier)} (${formatTokens(nextUsage.maxTokens)})`;
      tokenSpan.textContent = formatTokens(nextUsage.maxTokens);
      creditSpan.textContent = formatScene(nextUsage.creditCost);
      updateSliderVisual(slider, idx, multipliers.length - 1);
    });
    item.append(header, tagline, sliderWrap, summary);
    fragment.appendChild(item);
  });
  bodyEl.appendChild(fragment);
}

function openChatModeModal() {
  const modal = document.getElementById('chatModeModal');
  if (!modal) return;
  chatModeModalDraft = { ...(chatModePrefs.multipliers || {}) };
  renderChatModeModalBody();
  modal.classList.add('chat-mode-modal--open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

function closeChatModeModal() {
  const modal = document.getElementById('chatModeModal');
  if (!modal) return;
  modal.classList.remove('chat-mode-modal--open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  chatModeModalDraft = null;
}

function bindChatModeModalEvents() {
  if (chatModeModalBound) return;
  const adjustBtn = document.getElementById('chatModeAdjustBtn');
  const modal = document.getElementById('chatModeModal');
  const saveBtn = document.getElementById('chatModeModalSave');
  if (adjustBtn) {
    adjustBtn.addEventListener('click', openChatModeModal);
  }
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target.closest('[data-chat-mode-close]')) {
        closeChatModeModal();
      }
    });
  }
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      if (chatModeModalDraft) {
        chatModePrefs.multipliers = {
          ...chatModePrefs.multipliers,
          ...chatModeModalDraft
        };
        persistChatModePrefs();
        renderChatModeCards();
        updateChatModeSummary();
      }
      closeChatModeModal();
    });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const modalEl = document.getElementById('chatModeModal');
      if (modalEl?.classList.contains('chat-mode-modal--open')) {
        closeChatModeModal();
      }
    }
  });
  chatModeModalBound = true;
}

async function initChatModes() {
  try {
    await loadChatModeConfig();
  } catch (e) {
    console.warn('chat mode init failed', e);
  }
  chatModePrefs = loadChatModePrefsFromStorage();
  const modes = getChatModeList();
  modes.forEach((mode) => ensureModePref(mode));
  const firstNonSceneMode = modes.find((mode) => !mode.sceneMode);
  if (firstNonSceneMode) {
    lastNonSceneModeKey = firstNonSceneMode.key;
  }
  const storedKey = chatModePrefs.selectedKey;
  const storedExists = storedKey && modes.some((m) => m.key === storedKey);
  if (storedExists) {
    activeChatModeKey = storedKey;
  } else {
    const fallback =
      modes.find((mode) => mode.key === chatModeConfigPayload?.defaultMode) || modes[0] || DEFAULT_CHAT_MODE_FALLBACK;
    activeChatModeKey = fallback?.key || DEFAULT_CHAT_MODE_FALLBACK.key;
    chatModePrefs.selectedKey = activeChatModeKey;
  }
  chatModesInitialized = true;
  setActiveChatMode(activeChatModeKey);
  bindChatModeListEvents();
  bindChatModeModalEvents();
}

function setSceneTemplateCollapsed(collapsed) {
  sceneTemplatesCollapsed = collapsed;
  const strip = document.getElementById('sceneTemplateStrip');
  const toggle = document.getElementById('sceneTemplateToggle');
  const collapsedLabel = 'SCENE 미리보기 열기';
  const expandedLabel = 'SCENE 미리보기 닫기';
  if (strip) {
    strip.classList.toggle('scene-template-strip--expanded', !collapsed);
    strip.classList.toggle('scene-template-strip--collapsed', collapsed);
  }
  if (toggle) {
    const isEmpty = strip?.dataset.empty === 'true';
    const label = isEmpty ? 'SCENE 미리보기 없음' : (collapsed ? collapsedLabel : expandedLabel);
    toggle.setAttribute('aria-expanded', (!collapsed).toString());
    toggle.disabled = isEmpty;
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
  }
}

function initSceneTemplateToggle() {
  const toggle = document.getElementById('sceneTemplateToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const strip = document.getElementById('sceneTemplateStrip');
    if (strip?.dataset.empty === 'true') return;
    setSceneTemplateCollapsed(!sceneTemplatesCollapsed);
  });
  setSceneTemplateCollapsed(sceneTemplatesCollapsed);
}

// ================================
// URL 파라미터로 캐릭터 ID 추출
// ================================
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

async function buildAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  } catch (e) {
    console.warn('session fetch failed', e);
  }
  return headers;
}

async function ensureCreditUpsell() {
  try {
    if (!document.getElementById('creditUpsellModal') && typeof window.loadCreditUpsellPartial === 'function') {
      await window.loadCreditUpsellPartial();
    }
  } catch (e) {
    console.warn('credit upsell load failed', e);
  }
}

async function openCreditUpsellSafe() {
  await ensureCreditUpsell();
  if (typeof window.openCreditUpsell === 'function') {
    window.openCreditUpsell();
  }
}

function initSceneModeToggle() {
  const infoBtn = document.getElementById('sceneModeInfoBtn');
  const infoPanel = document.getElementById('sceneModeInfo');
  if (infoBtn && infoPanel) {
    infoBtn.addEventListener('click', () => {
      const expanded = infoBtn.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      infoBtn.setAttribute('aria-expanded', next.toString());
      infoPanel.classList.toggle('hidden', !next);
    });
  }
  updateSceneModeIndicator();
}

function renderSceneTemplates(list = [], charName = '캐릭터', userName = placeholderUserName) {
  const strip = document.getElementById('sceneTemplateStrip');
  const toggle = document.getElementById('sceneTemplateToggle');
  currentSceneTemplates = Array.isArray(list) ? list : [];
  if (!strip) {
    renderBackgroundCollection();
    return;
  }
  strip.innerHTML = '';
  const hasTemplates = currentSceneTemplates.length > 0;
  strip.dataset.empty = hasTemplates ? 'false' : 'true';
  if (!hasTemplates) {
    strip.classList.add('scene-template-strip--empty');
    strip.innerHTML = '<p class="scene-template-empty">등록된 상황 이미지가 없습니다.</p>';
    setSceneTemplateCollapsed(true);
    if (toggle) {
      toggle.disabled = true;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'SCENE 미리보기 없음');
      toggle.title = 'SCENE 미리보기 없음';
    }
    renderBackgroundCollection();
    return;
  }
  strip.classList.remove('scene-template-strip--empty');
  if (toggle) {
    toggle.disabled = false;
  }
  setSceneTemplateCollapsed(sceneTemplatesCollapsed);
  currentSceneTemplates.forEach((template) => {
    const card = document.createElement('div');
    card.className = 'scene-template-card';
    const keywordsRaw = Array.isArray(template.keywords)
      ? template.keywords.map((kw) => renderWithPlaceholders(kw, charName, userName)).join(', ')
      : renderWithPlaceholders(template.keywords || '', charName, userName);
    const label = escapeHtml(renderWithPlaceholders(template.label || '상황 이미지', charName, userName) || '상황 이미지');
    const desc = escapeHtml(
      renderWithPlaceholders(template.description || keywordsRaw || '', charName, userName) || keywordsRaw || ''
    );
    card.innerHTML = `
      <div class="scene-template-thumb">
        <img src="${template.image_url || template.url || '/assets/sample-character-02.png'}" alt="${label}" />
      </div>
      <div class="scene-template-info">
        <strong>${label}</strong>
        <span>${desc}</span>
      </div>
    `;
    strip.appendChild(card);
  });
  renderBackgroundCollection();
  if (chatModesInitialized) {
    renderChatModeCards();
    updateChatModeSummary();
  }
}

function setBodyModalState() {
  const hasOpen =
    document.querySelector('.character-sheet:not(.hidden)') ||
    document.querySelector('.character-detail-modal:not(.hidden)') ||
    document.querySelector('.avatar-preview-modal:not(.hidden)');
  document.body.classList.toggle('modal-open', Boolean(hasOpen));
}

window.__cramaUpdateModalState = setBodyModalState;

function toggleSheet(id, show) {
  const sheet = document.getElementById(id);
  if (!sheet) return;
  sheet.classList.toggle('hidden', !show);
  sheet.setAttribute('aria-hidden', show ? 'false' : 'true');
  setBodyModalState();
}

function openChatModeSheet() {
  toggleSheet('chatModeSheet', true);
}

function openSceneSkinSheet() {
  toggleSheet('sceneSkinSheet', true);
}

function openCharacterDetailModalShared() {
  if (!currentCharacterData || !window.CharacterDetailModal) return;
  window.CharacterDetailModal.openWithData(currentCharacterData);
}

async function openAvatarPreviewPanel(src, caption) {
  if (!window.CharacterDetailModal?.openAvatarPreview) return;
  try {
    if (typeof window.CharacterDetailModal.ensureLoaded === 'function') {
      await window.CharacterDetailModal.ensureLoaded();
    }
  } catch (error) {
    console.warn('character detail modal load skipped', error);
  }
  window.CharacterDetailModal.openAvatarPreview(
    src || currentCharacterAvatarUrl || DEFAULT_AVATAR_PLACEHOLDER,
    caption || '캐릭터 프로필'
  );
}

function initHeaderSheets() {
  if (headerSheetsInitialized) return;
  headerSheetsInitialized = true;
  const chatBtn = document.getElementById('chatModeSheetBtn');
  if (chatBtn && !chatBtn.dataset.bound) {
    chatBtn.addEventListener('click', openChatModeSheet);
    chatBtn.dataset.bound = '1';
  }
  const skinBtn = document.getElementById('sceneSkinSheetBtn');
  if (skinBtn && !skinBtn.dataset.bound) {
    skinBtn.addEventListener('click', openSceneSkinSheet);
    skinBtn.dataset.bound = '1';
  }
  document.querySelectorAll('[data-sheet-close]').forEach((btn) => {
    if (btn.dataset.bound) return;
    const target = btn.getAttribute('data-sheet-close');
    btn.addEventListener('click', () => toggleSheet(target, false));
    btn.dataset.bound = '1';
  });
  const trigger = document.getElementById('characterDetailTrigger');
  if (trigger && !trigger.dataset.bound) {
    trigger.addEventListener('click', openCharacterDetailModalShared);
    trigger.dataset.bound = '1';
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    toggleSheet('chatModeSheet', false);
    toggleSheet('sceneSkinSheet', false);
  });
}

function openChatSettingsPanel() {
  openChatModeSheet();
}

function updateSceneModeIndicator(modeOverride, usageOverride) {
  const selection =
    modeOverride && usageOverride ? { mode: modeOverride, usage: usageOverride } : getActiveChatModeSelection();
  if (!selection) return;
  const { mode, usage } = selection;
  const pill = document.getElementById('sceneModeStatusValue');
  if (pill) {
    const isActive = Boolean(sceneModeEnabled);
    pill.textContent = isActive ? 'SCENE ON' : 'SCENE OFF';
    pill.classList.toggle('scene-mode-status__pill--active', isActive);
  }
  const nameEl = document.getElementById('sceneModeCurrentName');
  if (nameEl) {
    nameEl.textContent = `${mode.name || '모드'} · ${formatMultiplierLabel(usage?.multiplier)}`;
  }
  const metaEl = document.getElementById('sceneModeCurrentMeta');
  if (metaEl) {
    metaEl.textContent = `${formatTokens(usage?.maxTokens)} · ${formatScene(usage?.creditCost)}`;
  }
  const infoTitle = document.getElementById('sceneModeInfoTitle');
  if (infoTitle) infoTitle.textContent = mode.name || '챗 모드';
  const infoBody = document.getElementById('sceneModeInfoBody');
  if (infoBody) {
    const parts = [];
    if (mode.description || mode.tagline) {
      parts.push(mode.description || mode.tagline);
    }
    if (mode.sceneMode) {
      parts.push(
        sceneModeEnabled
          ? '상황 이미지를 자동으로 불러와 장면을 연출합니다.'
          : '상황 이미지를 등록하면 SCENE 모드를 활용할 수 있습니다.'
      );
    } else {
      parts.push('Scene을 차감하지 않고 텍스트 응답에 집중합니다.');
    }
    const extra = getExtraCreditPerIncrement(mode);
    if (extra > 0) {
      parts.push(`추가 100토큰당 ${extra.toLocaleString('ko-KR')} scene이 차감됩니다.`);
    }
    infoBody.textContent = parts.join(' ');
  }
}

function showSceneModeNote(message) {
  const noteEl = document.getElementById('sceneModeNote');
  if (!noteEl) return;
  clearTimeout(sceneModeNoteTimer);
  if (!message) {
    noteEl.textContent = '';
    noteEl.classList.remove('scene-mode-note--visible');
    return;
  }
  noteEl.textContent = message;
  noteEl.classList.add('scene-mode-note--visible');
  sceneModeNoteTimer = setTimeout(() => {
    noteEl.classList.remove('scene-mode-note--visible');
  }, 5000);
}

function clearSceneModeNote() {
  showSceneModeNote('');
}

function getOrCreateChatSessionId(characterId) {
  if (currentChatSessionId) return currentChatSessionId;
  const sessionKey = `cc_session_${characterId}`;
  let sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(sessionKey, sessionId);
  }
  currentChatSessionId = sessionId;
  return sessionId;
}

let typingIndicatorEl = null;

function showTypingIndicator() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  hideTypingIndicator();
  const el = document.createElement('div');
  el.className = 'chat-message chat-message--character chat-message--typing';
  el.innerHTML = `
    <div class="chat-message__avatar"><div class="typing-dot typing-dot--avatar"></div></div>
    <div class="chat-message__bubble">
      <div class="chat-message__name">캐릭터</div>
      <div class="chat-message__text">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    </div>
  `;
  chatWindow.appendChild(el);
  typingIndicatorEl = el;
  ensureLatestMessageVisible({ focus: 'character' });
}

function hideTypingIndicator() {
  if (typingIndicatorEl && typingIndicatorEl.parentNode) {
    typingIndicatorEl.parentNode.removeChild(typingIndicatorEl);
  }
  typingIndicatorEl = null;
}

function renderCharacterMessageGradual(characterMessage = {}) {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  hideTypingIndicator();
  const finalText = characterMessage.content || '';
  const msgEl = renderMessage({
    role: 'character',
    content: '',
    sceneImage: characterMessage.sceneImage || null,
  });
  const textEl = msgEl.querySelector('.chat-message__text');
  if (!textEl) {
    msgEl.querySelector('.chat-message__bubble')?.append(finalText);
    chatWindow.appendChild(msgEl);
    return;
  }
  chatWindow.appendChild(msgEl);
  let index = 0;
  const chunk = Math.max(1, Math.floor(finalText.length / 60)); // ~60 steps max
  const step = () => {
    index = Math.min(finalText.length, index + chunk);
    const partial = finalText.slice(0, index);
    textEl.innerHTML = renderChatTextContent(partial);
    if (index < finalText.length) {
      setTimeout(step, 16);
    }
  };
  step();
}

function persistChatSessionId(characterId, sessionId) {
  if (!sessionId) return;
  const sessionKey = `cc_session_${characterId}`;
  try {
    localStorage.setItem(sessionKey, sessionId);
  } catch (e) {
    console.warn('failed to persist chat session', e);
  }
  currentChatSessionId = sessionId;
}

function updateLoadMoreButton() {
  const btn = document.getElementById('chatLoadMoreBtn');
  if (!btn) return;
  if (hasMoreChats) {
    btn.classList.remove('hidden');
    btn.disabled = loadMoreInFlight;
  } else {
    btn.classList.add('hidden');
  }
}

function scrollChatToBottom() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  requestAnimationFrame(() => {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

function immediateScrollToBottom() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function ensureLatestMessageVisible(options = {}) {
  const focusTarget = options.focus || (options.focus === null ? null : 'character');
  const chatWindow = document.getElementById('chatWindow');
  const scrollToLatest = () => {
    if (!chatWindow || !chatWindow.lastElementChild) return;
    chatWindow.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };
  immediateScrollToBottom();
  scrollChatToBottom();
  scrollToLatest();
  if (focusTarget === 'character') {
    focusLatestCharacterMessage();
  } else if (focusTarget === 'user') {
    focusLatestUserMessage();
  }
  setTimeout(() => {
    scrollChatToBottom();
    scrollToLatest();
    if (focusTarget === 'character') {
      focusLatestCharacterMessage();
    } else if (focusTarget === 'user') {
      focusLatestUserMessage();
    }
  }, 120);
}

function appendChatMessages(messages = []) {
  if (!messages.length) return;
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const frag = document.createDocumentFragment();
  messages.forEach((msg) => {
    frag.appendChild(renderMessage(msg));
  });
  chatWindow.appendChild(frag);
  ensureLatestMessageVisible();
}

function prependChatMessages(messages = []) {
  if (!messages.length) return;
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const prevHeight = chatWindow.scrollHeight;
  const frag = document.createDocumentFragment();
  messages.forEach((msg) => {
    frag.appendChild(renderMessage(msg));
  });
  const firstNonIntro = Array.from(chatWindow.children).find((child) => child.dataset.intro !== 'true');
  if (firstNonIntro) {
    chatWindow.insertBefore(frag, firstNonIntro);
  } else {
    chatWindow.appendChild(frag);
  }
  const newHeight = chatWindow.scrollHeight;
  chatWindow.scrollTop = newHeight - prevHeight;
}

async function fetchChatBatch(characterId, sessionId, options = {}) {
  const params = new URLSearchParams({ limit: CHAT_FETCH_LIMIT, sessionId });
  if (options.before) params.set('before', options.before);
  const headers = await buildAuthHeaders();
  const fetchHeaders = {};
  if (headers?.Authorization) {
    fetchHeaders.Authorization = headers.Authorization;
  }
  const res = await apiFetch(`/api/characters/${characterId}/chats?${params.toString()}`, {
    headers: Object.keys(fetchHeaders).length ? fetchHeaders : undefined,
  });
  if (!res.ok) throw new Error('채팅 기록을 불러오지 못했습니다.');
  const nextSessionId = res.headers?.get('x-chat-session-id') || null;
  const payload = await res.json();
  const messages = Array.isArray(payload) ? payload : payload?.messages || [];
  return { messages, sessionId: nextSessionId };
}

async function initializeChatHistory(characterId, introText = '') {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  let sessionId = getOrCreateChatSessionId(characterId);
  chatWindow.innerHTML = '';
  oldestMessageTimestamp = null;
  hasMoreChats = false;
  if (introText) {
    const introMessage = renderMessage({ role: 'character', content: introText });
    introMessage.dataset.intro = 'true';
    chatWindow.appendChild(introMessage);
  }
  try {
    const { messages, sessionId: serverSessionId } = await fetchChatBatch(characterId, sessionId);
    if (serverSessionId && serverSessionId !== sessionId) {
      persistChatSessionId(characterId, serverSessionId);
      sessionId = serverSessionId;
    }
    appendChatMessages(messages);
    if (messages.length) {
      oldestMessageTimestamp = messages[0].created_at;
      hasMoreChats = messages.length === CHAT_FETCH_LIMIT;
    } else {
      oldestMessageTimestamp = null;
      hasMoreChats = false;
    }
  } catch (e) {
    console.error('chat history load failed', e);
    hasMoreChats = false;
  }
  updateLoadMoreButton();
  window.checkChatEmpty?.();
  ensureLatestMessageVisible();
}

async function loadMoreChats(characterId) {
  if (!hasMoreChats || !oldestMessageTimestamp || loadMoreInFlight) return;
  let sessionId = getOrCreateChatSessionId(characterId);
  loadMoreInFlight = true;
  updateLoadMoreButton();
  try {
    const { messages: batch, sessionId: serverSessionId } = await fetchChatBatch(
      characterId,
      sessionId,
      { before: oldestMessageTimestamp }
    );
    if (serverSessionId && serverSessionId !== sessionId) {
      persistChatSessionId(characterId, serverSessionId);
      sessionId = serverSessionId;
    }
    if (batch.length) {
      prependChatMessages(batch);
      oldestMessageTimestamp = batch[0].created_at;
      hasMoreChats = batch.length === CHAT_FETCH_LIMIT;
    } else {
      hasMoreChats = false;
    }
  } catch (e) {
    console.error('load more chats failed', e);
  } finally {
    loadMoreInFlight = false;
    updateLoadMoreButton();
  }
}

function bindLoadMoreButton(characterId) {
  const btn = document.getElementById('chatLoadMoreBtn');
  if (!btn) return;
  if (btn.dataset.bound === '1') return;
  btn.addEventListener('click', () => loadMoreChats(characterId));
  btn.dataset.bound = '1';
}

// ================================
// 캐릭터 데이터 로드
// ================================
async function fetchCharacter(id) {
  const { data, error } = await sb
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("캐릭터 조회 오류:", error);
    return null;
  }
  return data;
}

async function fetchCharacterStats(id) {
  try {
    const res = await apiFetch(`/api/characters/${id}/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('fetchCharacterStats error', e);
    return null;
  }
}

async function likeCharacter(id) {
  const headers = await buildAuthHeaders();
  const res = await apiFetch(`/api/characters/${id}/like`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    alert('좋아요 처리 중 오류가 발생했습니다.');
    return null;
  }
  return await res.json(); // { like_count }
}

// ================================
// HTML 렌더링: HTML 구조에 맞춰 매핑
// ================================
function renderCharacterDetail(c) {
  const charName = c.name || '캐릭터';
  const userName = placeholderUserName;
  const applyPlaceholders = (value) => renderWithPlaceholders(value || '', charName, userName);
  updateCharacterMetaTags({
    name: charName,
    summary: applyPlaceholders(c.one_line || ''),
    description: applyPlaceholders(c.description || '')
  });

  currentCharacterAvatarUrl = c.avatar_url || DEFAULT_AVATAR_PLACEHOLDER;
  currentCharacterData = c;

  // 캐릭터 이름
  const nameEl = document.querySelector(".character-name");
  if (nameEl) nameEl.textContent = charName || "";

  // 한줄 소개/태그라인
  const taglineEl = document.querySelector(".character-tagline");
  if (taglineEl) taglineEl.textContent = applyPlaceholders(c.one_line || "");

  // 수익배분 뱃지
  const shareBadge = document.querySelector(".badge--share");
  if (shareBadge) shareBadge.style.display = c.is_monetized ? "inline-flex" : "none";

  // 좋아요/채팅/조회수
  const statNumbers = document.querySelectorAll(".character-stats .stat-item span:last-child");
  const formatCount = (value) => {
    if (value === undefined || value === null) return "0";
    const num = Number(value);
    return Number.isNaN(num) ? String(value) : num.toLocaleString();
  };
  if (statNumbers[0]) statNumbers[0].textContent = formatCount(c.like_count);
  if (statNumbers[1]) statNumbers[1].textContent = formatCount(c.chat_count);
  if (statNumbers[2]) statNumbers[2].textContent = formatCount(c.view_count);

  // 상세 패널: 설명
  const descPanel = document.querySelector("#profilePanel .panel-section-text");
  if (descPanel) descPanel.textContent = applyPlaceholders(c.description || "");

  // 상세 패널: 장르/대상/해시태그
  const infoValues = document.querySelectorAll("#profilePanel .info-value");
  if (infoValues[0]) infoValues[0].textContent = c.genre ? applyPlaceholders(c.genre) : "-";
  if (infoValues[1]) infoValues[1].textContent = c.target ? applyPlaceholders(c.target) : "-";
  if (infoValues[2]) {
    const tagsText = (c.tags || []).map(t => `#${t}`).join(" ");
    infoValues[2].textContent = tagsText ? applyPlaceholders(tagsText) : "-";
  }

  // 플레이 가이드
  const guideEl = document.querySelector("#guidePanel .panel-section-text");
  if (guideEl) guideEl.textContent = applyPlaceholders(c.play_guide || "");

  // 인트로 히어로 영역
  const introHero = document.getElementById('characterIntroHero');
  const introHeroImage = document.getElementById('characterIntroHeroImage');
  const introHeroText = document.getElementById('characterIntroHeroText');
  if (introHero && introHeroImage && introHeroText) {
    if (c.intro_image_url) {
      introHero.style.display = 'flex';
      introHeroImage.src = c.intro_image_url;
      introHeroImage.alt = `${charName || ''} 인트로 이미지`;
      const introText = applyPlaceholders(c.intro || '인트로 정보가 제공되지 않았습니다.');
      introHeroText.innerHTML = renderChatTextContent(introText);
    } else {
      introHero.style.display = 'none';
    }
  }

  renderSceneTemplates(c.scene_image_templates || [], charName, userName);
}

function sanitizeChatText(value) {
  if (!value) return '';
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function splitSceneSegments(content = '') {
  const segments = [];
  if (!content) return segments;
  const regex = /(\*{1,2})([^*]+?)\1/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'line', text: content.slice(lastIndex, match.index) });
    }
    const sceneText = match[2]?.trim();
    if (sceneText) {
      segments.push({ type: 'scene', text: sceneText });
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'line', text: content.slice(lastIndex) });
  }
  return segments;
}

function renderChatTextContent(content = '') {
  const text = typeof content === 'string' ? content : String(content ?? '');
  const segments = splitSceneSegments(text);
  if (!segments.length) {
    return `<div class="chat-text-line">${sanitizeChatText(text)}</div>`;
  }
  return segments
    .map((segment) => {
      const safe = sanitizeChatText(segment.text || '');
      if (!safe) return '';
      if (segment.type === 'scene') {
        return `<div class="chat-text-scene">${safe}</div>`;
      }
      return `<div class="chat-text-line">${safe}</div>`;
    })
    .join('');
}

function splitNarrationBlocks(text = '') {
  const lines = text.split('\n');
  const blocks = [];
  let buffer = [];
  let currentType = 'text';
  const flush = () => {
    if (!buffer.length) return;
    blocks.push({ type: currentType, text: buffer.join('\n').trim() });
    buffer = [];
  };
  const markerRegex = /^\[(?:NARRATION|나레이션)\]|^@:/i;
  const stripMarker = (value) => value.replace(/^\[(?:NARRATION|나레이션)\]\s*|^@:\s*/i, '');
  lines.forEach((line) => {
    const trimmed = line.trim();
    const isNarration = markerRegex.test(trimmed);
    if (isNarration && currentType !== 'narration') {
      flush();
      currentType = 'narration';
      buffer.push(stripMarker(trimmed));
    } else if (!isNarration && currentType === 'narration') {
      flush();
      currentType = 'text';
      buffer.push(line);
    } else {
      buffer.push(currentType === 'narration' ? stripMarker(trimmed) : line);
    }
  });
  flush();
  return blocks.filter((b) => b.text);
}

function focusLatestCharacterMessage() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const messages = chatWindow.querySelectorAll('.chat-message--character');
  if (!messages.length) return;
  const target = messages[messages.length - 1];
  if (!target) return;
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  requestAnimationFrame(() => {
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      target.focus();
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}

// ================================
// 말풍선 렌더
// ================================
function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = "chat-message " + (msg.role === "character" ? "chat-message--character" : "chat-message--user");

  const avatarSrc = currentCharacterAvatarUrl || DEFAULT_AVATAR_PLACEHOLDER;
  const characterName = document.querySelector('.character-name')?.textContent || '캐릭터';
  const sceneImage =
    msg.sceneImage ||
    msg.scene_image ||
    (msg.metadata && msg.metadata.scene_image) ||
    null;
  const sceneImageUrl = sceneImage?.image_url || sceneImage?.url || null;
  const sceneLabel = escapeHtml(sceneImage?.label || '상황 이미지');
  if (msg.role === 'character' && sceneImage) {
    maybeCollectSceneBackground(sceneImage);
  }
  const sceneMarkup = sceneImageUrl
    ? `
      <figure class="chat-scene">
        <img src="${sceneImageUrl}" alt="${sceneLabel}" />
        <figcaption>${sceneLabel}</figcaption>
      </figure>
    `
    : '';
  const formattedContent = renderChatTextContent(msg.content || '');

  if (msg.role === "character") {
    const narrationBlocks = splitNarrationBlocks(msg.content || '');
    if (narrationBlocks.length > 1 || (narrationBlocks.length === 1 && narrationBlocks[0].type === 'narration')) {
      const frag = document.createDocumentFragment();
      narrationBlocks.forEach((block) => {
        if (block.type === 'narration') {
          const nEl = document.createElement('div');
          nEl.className = 'chat-message chat-message--narration';
          nEl.innerHTML = `
            <div class="chat-message__bubble">
              <div class="chat-message__name"></div>
              <div class="chat-message__text">${renderChatTextContent(block.text)}</div>
            </div>
          `;
          frag.appendChild(nEl);
        } else {
          const cEl = document.createElement('div');
          cEl.className = "chat-message chat-message--character";
          cEl.innerHTML = `
            <div class="chat-message__avatar">
              <img src="${avatarSrc}" alt="${characterName}">
            </div>
            <div class="chat-message__bubble">
              <div class="chat-message__name">${characterName}</div>
              <div class="chat-message__text">${renderChatTextContent(block.text)}</div>
              ${sceneMarkup}
            </div>
          `;
          frag.appendChild(cEl);
        }
      });
      return frag;
    }
    el.innerHTML = `
      <div class="chat-message__avatar">
        <img src="${avatarSrc}" alt="${characterName}">
      </div>
      <div class="chat-message__bubble">
        <div class="chat-message__name">${characterName}</div>
        <div class="chat-message__text">${formattedContent}</div>
        ${sceneMarkup}
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="chat-message__bubble">
        <div class="chat-message__name">나</div>
        <div class="chat-message__text">${formattedContent}</div>
      </div>
    `;
  }

  if (msg.role === "character") {
    const avatarEl = el.querySelector('.chat-message__avatar img');
    if (avatarEl && !avatarEl.dataset.bound) {
      avatarEl.addEventListener('click', () => openAvatarPreviewPanel(avatarSrc, characterName));
      avatarEl.dataset.bound = '1';
    }
  }

  return el;
}

function handleSceneModeFeedback(result) {
  if (!result) return;
  if (result.sceneModeDeniedReason) {
    sceneModeEnabled = false;
    showSceneModeNote(result.sceneModeDeniedReason);
    updateSceneModeIndicator();
    return;
  }
}

function initKeyboardAwareInput() {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  if (!root) return;

  let rafId = null;
  const applyOffset = () => {
    const baseHeight = window.innerHeight || document.documentElement.clientHeight || viewport?.height || 0;
    const viewportHeight = viewport?.height || baseHeight;
    root.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
    const offsetTop = viewport?.offsetTop || 0;
    const heightDiff = Math.max(0, baseHeight - viewportHeight - offsetTop);
    root.style.setProperty('--chat-input-keyboard-offset', `${heightDiff}px`);
  };

  const scheduleUpdate = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(applyOffset);
  };

  if (viewport) {
    viewport.addEventListener('resize', scheduleUpdate);
    viewport.addEventListener('scroll', scheduleUpdate);
  } else {
    window.addEventListener('resize', scheduleUpdate);
  }
  window.addEventListener('orientationchange', scheduleUpdate);
  scheduleUpdate();
}

// ================================
// 채팅 전송 기능
// ================================
async function setupChat(characterId) {
  const form = document.getElementById("chatForm");
  const textarea = form.querySelector("textarea");
  const chatWindow = document.getElementById("chatWindow");
  const insertSceneBtn = document.getElementById('chatInsertSceneBtn');

  if (insertSceneBtn && textarea) {
    insertSceneBtn.addEventListener('click', () => {
      const value = textarea.value || '';
      const selectionStart = textarea.selectionStart ?? value.length;
      const selectionEnd = textarea.selectionEnd ?? value.length;
      const insertText = '**';
      if (typeof textarea.setRangeText === 'function') {
        textarea.setRangeText(insertText, selectionStart, selectionEnd, 'end');
      } else {
        textarea.value =
          value.slice(0, selectionStart) + insertText + value.slice(selectionEnd);
      }
      const caretPos = selectionStart + 1;
      requestAnimationFrame(() => {
        textarea.focus();
        if (typeof textarea.setSelectionRange === 'function') {
          textarea.setSelectionRange(caretPos, caretPos);
        }
      });
    });
  }

  const sessionId = getOrCreateChatSessionId(characterId);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = "";
    const chatModeSelection = getActiveChatModeSelection();

    // 사용자 메시지 화면 반영
    const userMessageEl = renderMessage({ role: "user", content: text });
    chatWindow.appendChild(userMessageEl);
    ensureLatestMessageVisible({ focus: 'user' });
    showTypingIndicator();

    // 서버 메시지 전송 및 답변 받기
    try {
      const headers = await buildAuthHeaders();
    const response = await apiFetch(`/api/characters/${characterId}/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionId,
        message: text,
        sceneMode: sceneModeEnabled,
        chatModeKey: chatModeSelection?.mode?.key,
        tokenMultiplier: chatModeSelection?.multiplier
      })
    });
      const result = await response.json();

      if (response.status === 401) {
        hideTypingIndicator();
        const loginMessage = renderMessage({
          role: "character",
          content: "로그인이 필요합니다. 로그인 후 다시 시도해주세요."
        });
        chatWindow.appendChild(loginMessage);
        ensureLatestMessageVisible({ focus: 'character' });
        return;
      }

      if (response.status === 402 || result?.error === 'insufficient_credits') {
        hideTypingIndicator();
        const creditMessage = renderMessage({
          role: "character",
          content: "scene이 부족합니다. 충전 또는 구독 후 시도해주세요."
        });
        chatWindow.appendChild(creditMessage);
        ensureLatestMessageVisible({ focus: 'character' });
        openCreditUpsellSafe();
        return;
      }

      if (response.ok) {
        if (result.introMessage) {
          const introTextEl = chatWindow.querySelector('.chat-message[data-intro="true"] .chat-message__text');
          if (introTextEl) {
            introTextEl.innerHTML = result.introMessage.content;
          } else {
            const introMessageEl = renderMessage({
              role: "character",
              content: result.introMessage.content
            });
            introMessageEl.dataset.intro = 'true';
            chatWindow.insertBefore(introMessageEl, chatWindow.firstChild || null);
          }
        }
        if (result.characterMessage) {
          renderCharacterMessageGradual(result.characterMessage);
        } else if (!result.introMessage) {
          hideTypingIndicator();
          const errorMessageEl = renderMessage({
            role: "character",
            content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
          });
          chatWindow.appendChild(errorMessageEl);
        }
        ensureLatestMessageVisible({ focus: 'character' });
        window.checkChatEmpty();
        handleSceneModeFeedback(result);
      } else {
        hideTypingIndicator();
        const errorReply = renderMessage({
          role: "character",
          content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
        });
        chatWindow.appendChild(errorReply);
        ensureLatestMessageVisible({ focus: 'character' });
        window.checkChatEmpty();
        handleSceneModeFeedback(result);
      }
    } catch (err) {
      hideTypingIndicator();
      const connectionError = renderMessage({
        role: "character",
        content: "서버 연결 오류: " + err.message
      });
      chatWindow.appendChild(connectionError);
      ensureLatestMessageVisible({ focus: 'character' });
      window.checkChatEmpty();
      handleSceneModeFeedback({ sceneModeDeniedReason: '서버 응답을 받을 수 없습니다.' });
    }
  });
}

// ================================
// 우측 패널 토글(기본 닫힘)
// ================================
document.addEventListener('DOMContentLoaded', () => {
  const sidePanel = document.querySelector('.character-side');
  const sideToggleBtn = document.getElementById('sideToggleBtn');
  const closeSideBtn = document.getElementById('closeSideBtn');
  let sideCollapsed = true;
  initChatSettingsNav();
  bindBackgroundSettings();
  initSceneModeToggle();
  initSceneTemplateToggle();
  if (sidePanel) sidePanel.classList.add('character-side--collapsed');
  if (sideToggleBtn) {
    sideToggleBtn.innerText = 'i';
    sideToggleBtn.title = '패널 열기';
    sideToggleBtn.style.display = 'flex';
    sideToggleBtn.addEventListener('click', function() {
      sideCollapsed = !sideCollapsed;
      if (sideCollapsed) {
        sidePanel.classList.add('character-side--collapsed');
        sideToggleBtn.innerText = 'i';
        sideToggleBtn.title = '패널 열기';
      } else {
        sidePanel.classList.remove('character-side--collapsed');
        sideToggleBtn.innerText = 'i';
        sideToggleBtn.title = '패널 닫기';
      }
    });
  }

  // 우측 패널 내 X 버튼으로도 닫기
  if (closeSideBtn) {
    closeSideBtn.addEventListener('click', () => {
      sideCollapsed = true;
      sidePanel?.classList.add('character-side--collapsed');
      if (sideToggleBtn) {
        sideToggleBtn.innerText = 'i';
        sideToggleBtn.title = '패널 열기';
      }
    });
  }

  // ================================
  // 빈채팅 안내
  // ================================
  const chatWindow = document.getElementById('chatWindow');
  function checkChatEmpty() {
    if (!chatWindow.querySelector('.chat-message')) {
      chatWindow.classList.add('chat-window--empty');
      chatWindow.innerHTML = '<div>아직 대화가 없습니다.<br>메시지를 입력해 대화를 시작해보세요.</div>';
    } else {
      chatWindow.classList.remove('chat-window--empty');
    }
  }
  checkChatEmpty();
  window.checkChatEmpty = checkChatEmpty;
});

// ================================
// 페이지 초기화
// ================================
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (window.CharacterDetailModal?.ensureLoaded) {
      window.CharacterDetailModal.ensureLoaded();
    }
  } catch (error) {
    console.warn('character detail modal preload skipped', error);
  }
  initHeaderSheets();
  await initPlaceholderContext();
  const characterId = getParam("id");
  if (!characterId) return;
  currentChatSessionId = null;
  activeCharacterId = characterId;

  // DB에서 데이터가져오기
  const data = await fetchCharacter(characterId);
  if (!data) return;

  const stats = await fetchCharacterStats(characterId);
  if (stats) {
    data.like_count = stats.like_count;
    data.view_count = stats.view_count;
    data.chat_count = stats.chat_count;
  }

  renderCharacterDetail(data);
  await loadCharacterBackgroundState(characterId);
  await initChatModes();
  bindLoadMoreButton(characterId);
  const introForChat = renderWithPlaceholders(data.intro || '', data.name || '캐릭터', placeholderUserName);
  await initializeChatHistory(characterId, introForChat);
  setupChat(characterId);
  initKeyboardAwareInput();

});

window.requestCharacterBackgroundReload = function () {
  if (typeof loadCharacterBackgroundState === 'function' && activeCharacterId) {
    loadCharacterBackgroundState(activeCharacterId, { forceUserContext: true });
  }
};

})();
function focusLatestUserMessage() {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const messages = chatWindow.querySelectorAll('.chat-message--user');
  if (!messages.length) return;
  const target = messages[messages.length - 1];
  if (!target) return;
  if (!target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }
  requestAnimationFrame(() => {
    try {
      target.focus({ preventScroll: true });
    } catch (e) {
      target.focus();
    }
    target.scrollIntoView({ behavior: 'smooth', block: 'end' });
  });
}
