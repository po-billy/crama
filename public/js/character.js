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

const SCENE_MODE_STORAGE_KEY = 'crama_scene_mode';
const CHAT_FETCH_LIMIT = 30;

let sceneModeEnabled = (() => {
  try {
    return localStorage.getItem(SCENE_MODE_STORAGE_KEY) === '1';
  } catch (e) {
    return false;
  }
})();
let currentSceneTemplates = [];
let sceneTemplatesCollapsed = true;
let oldestMessageTimestamp = null;
let hasMoreChats = false;
let currentChatSessionId = null;
let loadMoreInFlight = false;

function escapeHtml(value) {
  return (value || '').toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setSceneTemplateCollapsed(collapsed) {
  sceneTemplatesCollapsed = collapsed;
  const strip = document.getElementById('sceneTemplateStrip');
  const toggle = document.getElementById('sceneTemplateToggle');
  if (strip) {
    strip.classList.toggle('scene-template-strip--expanded', !collapsed);
    strip.classList.toggle('scene-template-strip--collapsed', collapsed);
  }
  if (toggle) {
    toggle.textContent = collapsed ? '펼치기' : '접기';
    toggle.setAttribute('aria-expanded', (!collapsed).toString());
    if (strip?.dataset.empty === 'true') {
      toggle.disabled = true;
      toggle.textContent = '없음';
    } else {
      toggle.disabled = false;
    }
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
  const toggle = document.getElementById('sceneModeToggle');
  const infoBtn = document.getElementById('sceneModeInfoBtn');
  const infoPanel = document.getElementById('sceneModeInfo');
  if (!toggle) return;
  toggle.checked = !!sceneModeEnabled;
  toggle.addEventListener('change', () => {
    sceneModeEnabled = toggle.checked;
    try {
      localStorage.setItem(SCENE_MODE_STORAGE_KEY, sceneModeEnabled ? '1' : '0');
    } catch (e) {
      console.warn('scene mode pref save failed', e);
    }
  });
  if (infoBtn && infoPanel) {
    infoBtn.addEventListener('click', () => {
      const expanded = infoBtn.getAttribute('aria-expanded') === 'true';
      const next = !expanded;
      infoBtn.setAttribute('aria-expanded', next.toString());
      infoPanel.classList.toggle('hidden', !next);
    });
  }
}

function renderSceneTemplates(list = []) {
  const strip = document.getElementById('sceneTemplateStrip');
  const toggle = document.getElementById('sceneTemplateToggle');
  if (!strip) return;
  strip.innerHTML = '';
  currentSceneTemplates = Array.isArray(list) ? list : [];
  const hasTemplates = currentSceneTemplates.length > 0;
  strip.dataset.empty = hasTemplates ? 'false' : 'true';
  if (!hasTemplates) {
    strip.classList.add('scene-template-strip--empty');
    strip.innerHTML = '<p class="scene-template-empty">등록된 상황 이미지가 없습니다.</p>';
    setSceneTemplateCollapsed(true);
    if (toggle) {
      toggle.disabled = true;
      toggle.textContent = '없음';
      toggle.setAttribute('aria-expanded', 'false');
    }
    return;
  }
  strip.classList.remove('scene-template-strip--empty');
  if (toggle) {
    toggle.disabled = false;
    toggle.textContent = sceneTemplatesCollapsed ? '펼치기' : '접기';
    toggle.setAttribute('aria-expanded', (!sceneTemplatesCollapsed).toString());
  }
  setSceneTemplateCollapsed(sceneTemplatesCollapsed);
  currentSceneTemplates.forEach((template) => {
    const card = document.createElement('div');
    card.className = 'scene-template-card';
    const keywords = Array.isArray(template.keywords)
      ? template.keywords.join(', ')
      : (template.keywords || '');
    const label = escapeHtml(template.label || '상황 이미지');
    const desc = escapeHtml(template.description || keywords || '');
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

function ensureLatestMessageVisible() {
  immediateScrollToBottom();
  scrollChatToBottom();
  setTimeout(scrollChatToBottom, 80);
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
  return await res.json();
}

async function initializeChatHistory(characterId, introText = '') {
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;
  const sessionId = getOrCreateChatSessionId(characterId);
  chatWindow.innerHTML = '';
  oldestMessageTimestamp = null;
  hasMoreChats = false;
  if (introText) {
    const introMessage = renderMessage({ role: 'character', content: introText });
    introMessage.dataset.intro = 'true';
    chatWindow.appendChild(introMessage);
  }
  try {
    const messages = await fetchChatBatch(characterId, sessionId);
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
  const sessionId = getOrCreateChatSessionId(characterId);
  loadMoreInFlight = true;
  updateLoadMoreButton();
  try {
    const batch = await fetchChatBatch(characterId, sessionId, { before: oldestMessageTimestamp });
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

  // 아바타 이미지
  const avatarImg = document.querySelector(".character-avatar-wrapper img");
  if (avatarImg) {
    avatarImg.src = c.avatar_url || "/assets/img/sample-character-01.png";
    avatarImg.alt = c.name || "캐릭터";
  }

  // 캐릭터 이름
  const nameEl = document.querySelector(".character-name");
  if (nameEl) nameEl.textContent = c.name || "";

  // 한줄 소개/태그라인
  const taglineEl = document.querySelector(".character-tagline");
  if (taglineEl) taglineEl.textContent = c.one_line || "";

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
  if (descPanel) descPanel.textContent = c.description || "";

  // 상세 패널: 장르/대상/해시태그
  const infoValues = document.querySelectorAll("#profilePanel .info-value");
  if (infoValues[0]) infoValues[0].textContent = c.genre || "-";
  if (infoValues[1]) infoValues[1].textContent = c.target || "-";
  if (infoValues[2]) infoValues[2].textContent =
    (c.tags || []).map(t => `#${t}`).join(" ") || "-";

  // 플레이 가이드
  const guideEl = document.querySelector("#guidePanel .panel-section-text");
  if (guideEl) guideEl.textContent = c.play_guide || "";

  // 인트로 히어로 영역
  const introHero = document.getElementById('characterIntroHero');
  const introHeroImage = document.getElementById('characterIntroHeroImage');
  const introHeroText = document.getElementById('characterIntroHeroText');
  if (introHero && introHeroImage && introHeroText) {
    if (c.intro_image_url) {
      introHero.style.display = 'flex';
      introHeroImage.src = c.intro_image_url;
      introHeroImage.alt = `${c.name || ''} 인트로 이미지`;
      introHeroText.textContent = c.intro || '인트로 정보가 제공되지 않았습니다.';
    } else {
      introHero.style.display = 'none';
    }
  }

  renderSceneTemplates(c.scene_image_templates || []);
}

function sanitizeChatText(value) {
  if (!value) return '';
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function splitSceneSegments(content = '') {
  const segments = [];
  if (!content) return segments;
  const regex = /\*([^*]+)\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'line', text: content.slice(lastIndex, match.index) });
    }
    const sceneText = match[1]?.trim();
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

// ================================
// 말풍선 렌더
// ================================
function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = "chat-message " + (msg.role === "character" ? "chat-message--character" : "chat-message--user");

  const avatarSrc = document.querySelector('.character-avatar-wrapper img')?.src || '/assets/img/sample-character-01.png';
  const characterName = document.querySelector('.character-name')?.textContent || '캐릭터';
  const sceneImage =
    msg.sceneImage ||
    msg.scene_image ||
    (msg.metadata && msg.metadata.scene_image) ||
    null;
  const sceneImageUrl = sceneImage?.image_url || sceneImage?.url || null;
  const sceneLabel = escapeHtml(sceneImage?.label || '상황 이미지');
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
    el.innerHTML = `
      <div class="chat-message__avatar">
        <img src="${avatarSrc}" />
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

  return el;
}

function handleSceneModeFeedback(result) {
  if (!result) return;
  const toggle = document.getElementById('sceneModeToggle');
  if (result.sceneModeDeniedReason) {
    sceneModeEnabled = false;
    if (toggle) toggle.checked = false;
    try {
      localStorage.setItem(SCENE_MODE_STORAGE_KEY, '0');
    } catch (e) {
      console.warn('scene mode pref save failed', e);
    }
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

    // 사용자 메시지 화면 반영
    chatWindow.appendChild(renderMessage({ role: "user", content: text }));
    ensureLatestMessageVisible();

    // 서버 메시지 전송 및 답변 받기
    try {
      const headers = await buildAuthHeaders();
      const response = await apiFetch(`/api/characters/${characterId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          message: text,
          sceneMode: sceneModeEnabled
        })
      });
      const result = await response.json();

      if (response.status === 401) {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "로그인이 필요합니다. 로그인 후 다시 시도해주세요."
        }));
        ensureLatestMessageVisible();
        return;
      }

      if (response.status === 402 || result?.error === 'insufficient_credits') {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "scene이 부족합니다. 충전 또는 구독 후 시도해주세요."
        }));
        ensureLatestMessageVisible();
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
          chatWindow.appendChild(renderMessage({
            role: "character",
            content: result.characterMessage.content,
            sceneImage: result.characterMessage.sceneImage || null
          }));
        } else if (!result.introMessage) {
          chatWindow.appendChild(renderMessage({
            role: "character",
            content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
          }));
        }
        ensureLatestMessageVisible();
        window.checkChatEmpty();
        handleSceneModeFeedback(result);
      } else {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
        }));
        ensureLatestMessageVisible();
        window.checkChatEmpty();
        handleSceneModeFeedback(result);
      }
    } catch (err) {
      chatWindow.appendChild(renderMessage({
        role: "character",
        content: "서버 연결 오류: " + err.message
      }));
      ensureLatestMessageVisible();
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
  const characterId = getParam("id");
  if (!characterId) return;
  currentChatSessionId = null;

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
  bindLoadMoreButton(characterId);
  await initializeChatHistory(characterId, data.intro || '');
  setupChat(characterId);
  initKeyboardAwareInput();

  const likeBtn = document.querySelector('.btn-favorite');
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      const result = await likeCharacter(characterId);
      if (result && typeof result.like_count !== 'undefined') {
        const statNumbers = document.querySelectorAll(".character-stats .stat-item span:last-child");
        const formatCount = (value) => {
          if (value === undefined || value === null) return "0";
          const num = Number(value);
          return Number.isNaN(num) ? String(value) : num.toLocaleString();
        };
        if (statNumbers[0]) statNumbers[0].textContent = formatCount(result.like_count);
        likeBtn.classList.add('active');
      }
    });
  }
});

})();
