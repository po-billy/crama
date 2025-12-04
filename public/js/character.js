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
    const res = await fetch(`/api/characters/${id}/stats`);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn('fetchCharacterStats error', e);
    return null;
  }
}

async function likeCharacter(id) {
  const headers = await buildAuthHeaders();
  const res = await fetch(`/api/characters/${id}/like`, {
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
}

// ================================
// 채팅 기록 로드
// ================================
async function loadChatHistory(characterId, introText = '') {
  const sessionKey = `cc_session_${characterId}`;
  let sessionId = localStorage.getItem(sessionKey);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(sessionKey, sessionId);
  }

  const { data, error } = await sb
    .from("character_chats")
    .select("*")
    .eq("character_id", characterId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("채팅 기록 오류:", error);
    return;
  }

  const chatWindow = document.getElementById("chatWindow");
  if (!chatWindow) return;

  chatWindow.innerHTML = "";

  if (introText) {
    const introMessage = renderMessage({ role: "character", content: introText });
    introMessage.dataset.intro = 'true';
    chatWindow.appendChild(introMessage);
  }

  data.forEach(msg => {
    chatWindow.appendChild(renderMessage(msg));
  });

  chatWindow.scrollTop = chatWindow.scrollHeight;
  window.checkChatEmpty?.();
}

// ================================
// 말풍선 렌더
// ================================
function renderMessage(msg) {
  const el = document.createElement("div");
  el.className = "chat-message " + (msg.role === "character" ? "chat-message--character" : "chat-message--user");

  const avatarSrc = document.querySelector('.character-avatar-wrapper img')?.src || '/assets/img/sample-character-01.png';
  const characterName = document.querySelector('.character-name')?.textContent || '캐릭터';

  if (msg.role === "character") {
    el.innerHTML = `
      <div class="chat-message__avatar">
        <img src="${avatarSrc}" />
      </div>
      <div class="chat-message__bubble">
        <div class="chat-message__name">${characterName}</div>
        <div class="chat-message__text">${msg.content}</div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="chat-message__bubble">
        <div class="chat-message__name">나</div>
        <div class="chat-message__text">${msg.content}</div>
      </div>
    `;
  }

  return el;
}

// ================================
// 채팅 전송 기능
// ================================
async function setupChat(characterId) {
  const form = document.getElementById("chatForm");
  const textarea = form.querySelector("textarea");
  const chatWindow = document.getElementById("chatWindow");

  const sessionKey = `cc_session_${characterId}`;
  let sessionId = localStorage.getItem(sessionKey);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem(sessionKey, sessionId);
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = textarea.value.trim();
    if (!text) return;
    textarea.value = "";

    // 사용자 메시지 화면 반영
    chatWindow.appendChild(renderMessage({ role: "user", content: text }));
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // 서버 메시지 전송 및 답변 받기
    try {
      const headers = await buildAuthHeaders();
      const response = await fetch(`/api/characters/${characterId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId,
          message: text
        })
      });
      const result = await response.json();

      if (response.status === 401) {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "로그인이 필요합니다. 로그인 후 다시 시도해주세요."
        }));
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return;
      }

      if (response.status === 402 || result?.error === 'insufficient_credits') {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "scene이 부족합니다. 충전 또는 구독 후 시도해주세요."
        }));
        chatWindow.scrollTop = chatWindow.scrollHeight;
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
            content: result.characterMessage.content
          }));
        } else if (!result.introMessage) {
          chatWindow.appendChild(renderMessage({
            role: "character",
            content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
          }));
        }
        chatWindow.scrollTop = chatWindow.scrollHeight;
        window.checkChatEmpty();
      } else {
        chatWindow.appendChild(renderMessage({
          role: "character",
          content: "오류가 발생했습니다: " + (result.error || "알 수 없는 오류")
        }));
        chatWindow.scrollTop = chatWindow.scrollHeight;
        window.checkChatEmpty();
      }
    } catch (err) {
      chatWindow.appendChild(renderMessage({
        role: "character",
        content: "서버 연결 오류: " + err.message
      }));
      chatWindow.scrollTop = chatWindow.scrollHeight;
      window.checkChatEmpty();
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
  await loadChatHistory(characterId, data.intro || '');
  setupChat(characterId);

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
