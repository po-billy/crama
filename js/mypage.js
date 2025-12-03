// js/mypage.js

document.addEventListener("DOMContentLoaded", () => {
  initMyPage();
});

async function initMyPage() {
  // 1) 세션 체크: 비로그인 → 로그인 페이지
  const { data, error } = await window.sb.auth.getSession();
  if (error || !data.session) {
    window.location.href = "login.html";
    return;
  }

  // 2) 공통 컨텍스트 가져오기 (common.js 에서 만든 함수 재사용)
  let ctx;
  try {
    ctx = await window.fetchUserContext(); // { user, profile, wallet, subscription }
  } catch (e) {
    console.error("fetchUserContext error", e);
  }

  if (!ctx) {
    alert("계정 정보를 불러오지 못했습니다. 다시 로그인해주세요.");
    window.location.href = "login.html";
    return;
  }

  const { user, profile, wallet, subscription } = ctx;

  // 3) 뷰모델 만들기
  const vm = buildProfileViewModel({ user, profile, wallet, subscription });

  // 4) DOM에 바인딩
  bindProfileToDom(vm);

  // 5) 버튼 이벤트
  setupMyPageActions();

  // 6) 핸들 수정 폼
  setupHandleEditor(vm.handle);

  // 7) 웰컴 scene 위젯
  initDailyWelcomeWidget();
}

function buildProfileViewModel({ user, profile, wallet, subscription }) {
  const displayName =
    profile?.display_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "사용자";

  const handle =
    profile?.handle ||
    user.user_metadata?.user_name ||
    (user.email ? user.email.split("@")[0] : null);

  const joinedAt = profile?.joined_at || user.created_at;
  const joinedText = joinedAt
    ? new Date(joinedAt).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "-";

  const planName = subscription?.plans?.name || "무료";

  const credits = wallet?.balance ?? profile?.current_credits ?? 0;

  return {
    displayName,
    handle,
    joinedText,
    planName,
    credits,
    // 추가 정보
    bio: profile?.bio || "",
    website: profile?.website || "",
    job: profile?.job || "",
    gender: profile?.gender || "",
    ageRange: profile?.age_range || "",
  };
}

function safeText(value, fallback = "정보 없음") {
  if (!value || !String(value).trim()) return fallback;
  return value;
}

function bindProfileToDom(vm) {
  const avatarCircle = document.getElementById("profileAvatarCircle");
  const displayNameEl = document.getElementById("profileDisplayName");
  const handleEl = document.getElementById("profileHandle");
  const joinedAtEl = document.getElementById("profileJoinedAt");
  const nicknameEl = document.getElementById("profileNickname");
  const planEl = document.getElementById("profilePlan");
  const creditsEl = document.getElementById("profileCredits");

  const bioEl = document.getElementById("profileBio");
  const websiteEl = document.getElementById("profileWebsite");
  const jobEl = document.getElementById("profileJob");
  const genderEl = document.getElementById("profileGender");
  const ageRangeEl = document.getElementById("profileAgeRange");

  const shortName =
    vm.displayName.length <= 2
      ? vm.displayName
      : vm.displayName.slice(-2);

  if (avatarCircle) {
    avatarCircle.textContent = shortName;
    avatarCircle.title = vm.displayName;
  }

  if (displayNameEl) displayNameEl.textContent = vm.displayName;
  if (handleEl) handleEl.textContent = vm.handle ? `@${vm.handle}` : "";
  if (joinedAtEl) joinedAtEl.textContent = vm.joinedText;
  if (nicknameEl) nicknameEl.textContent = vm.handle || vm.displayName;
  if (planEl) planEl.textContent = vm.planName;
  if (creditsEl) creditsEl.textContent = vm.credits.toLocaleString("ko-KR");

  if (bioEl) bioEl.textContent = safeText(vm.bio);
  if (websiteEl) websiteEl.textContent = safeText(vm.website);
  if (jobEl) jobEl.textContent = safeText(vm.job);
  if (genderEl) genderEl.textContent = safeText(vm.gender);
  if (ageRangeEl) ageRangeEl.textContent = safeText(vm.ageRange);
}

function setupHandleEditor(currentHandle) {
  const form = document.getElementById("handleForm");
  const input = document.getElementById("handleInput");
  const button = document.getElementById("handleSaveBtn");
  const status = document.getElementById("handleStatus");

  if (!form || !input || !button) return;

  input.value = currentHandle || "";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const val = (input.value || "").trim().toLowerCase();
    if (!val || val.length < 3 || val.length > 32) {
      if (status) {
        status.textContent = "닉네임은 3~32자여야 합니다.";
        status.className = "handle-status error";
      }
      return;
    }
    button.disabled = true;
    if (status) {
      status.textContent = "변경 중...";
      status.className = "handle-status";
    }
    try {
      const { data } = await window.sb.auth.getSession();
      const token = data?.session?.access_token;
      const res = await fetch("/api/profile/change-handle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ handle: val }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        if (status) {
          if (json?.message === "handle_change_cooldown") {
            status.textContent = `최근 변경 후 ${json?.remainingDays || 0}일 남았습니다.`;
          } else if (json?.message === "handle_taken") {
            status.textContent = "이미 사용 중인 닉네임입니다.";
          } else {
            status.textContent = json?.message || "변경 실패";
          }
          status.className = "handle-status error";
        }
        return;
      }
      if (status) {
        status.textContent = "변경 완료!";
        status.className = "handle-status success";
      }
      const handleValue = json?.handle || val;
      const handleEl = document.getElementById("profileHandle");
      if (handleEl) handleEl.textContent = handleValue ? `@${handleValue}` : "";
      const nicknameEl = document.getElementById("profileNickname");
      if (nicknameEl) nicknameEl.textContent = handleValue;
    } catch (err) {
      console.error("handle change error", err);
      if (status) {
        status.textContent = "오류가 발생했습니다.";
        status.className = "handle-status error";
      }
    } finally {
      button.disabled = false;
    }
  });
}

function setupMyPageActions() {
  const logoutBtn = document.getElementById("profileLogoutBtn");
  const deleteBtn = document.getElementById("profileDeleteBtn");
  const buyCreditsBtn = document.getElementById("buyCreditsBtn");
  const editBtn = document.getElementById("editProfileBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await window.sb.auth.signOut();
      window.location.href = "login.html";
    });
  }

  if (buyCreditsBtn) {
    buyCreditsBtn.addEventListener("click", () => {
      // TODO: 실제 scene 구매 페이지로 연결
      alert("scene 구매 기능은 추후 연결 예정입니다.");
    });
  }

  if (editBtn) {
    editBtn.addEventListener("click", () => {
      alert("프로필 수정 기능은 아직 준비 중입니다.");
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      alert(
        "계정 영구 삭제는 보안상 서버(관리자)에서만 가능하게 구현해야 합니다." +
          "별도의 백엔드/Edge Function에서 구현해 주세요."
      );
    });
  }
}

async function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (!window.sb?.auth) return headers;
  try {
    const { data } = await window.sb.auth.getSession();
    const token = data?.session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch (e) {
    console.error("getAuthHeaders error", e);
  }
  return headers;
}

function updateDailyWelcomeUI(state, options = {}) {
  const card = document.getElementById("dailyWelcomeCard");
  const amountEl = document.getElementById("dailyWelcomeAmount");
  const statusEl = document.getElementById("dailyWelcomeStatus");
  const hintEl = document.getElementById("dailyWelcomeHint");
  const btn = document.getElementById("dailyWelcomeBtn");
  if (!card) return;

  const { forceVisible = false, message = null, isError = false } = options;
  let normalized = state;

  if ((!normalized || normalized.enabled === false) && !forceVisible) {
    card.style.display = "none";
    if (hintEl) hintEl.textContent = "";
    return;
  }
  if (!normalized || normalized.enabled === false) {
    normalized = {
      enabled: true,
      amount: 0,
      claimedToday: 0,
      maxPerDay: 0,
      canClaim: false,
      nextReset: null,
    };
  }

  card.style.display = "flex";

  const amount = Number(normalized.amount || 0);
  if (amountEl) {
    amountEl.textContent =
      amount > 0 ? `+${amount.toLocaleString("ko-KR")} scene` : "+0 scene";
  }

  const claimed = Number(normalized.claimedToday || 0);
  const maxPerDay = Number(normalized.maxPerDay || 0);
  if (statusEl) {
    const defaultLabel =
      maxPerDay > 0
        ? `오늘 ${claimed}/${maxPerDay}회 수령`
        : "진행 가능한 웰컴 scene이 없습니다.";
    statusEl.textContent = message || defaultLabel;
    if (isError) statusEl.classList.add("error");
    else statusEl.classList.remove("error");
  }

  if (hintEl) {
    const nextReset = normalized.nextReset ? new Date(normalized.nextReset) : null;
    if (nextReset && !Number.isNaN(nextReset.valueOf())) {
      const resetText = nextReset.toLocaleString("ko-KR", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      hintEl.textContent = `다음 초기화: ${resetText}`;
    } else {
      hintEl.textContent = "매일 자정에 초기화됩니다.";
    }
  }

  if (btn) {
    btn.disabled = !normalized.canClaim;
    btn.textContent = normalized.canClaim ? "받기" : "완료";
  }
}

async function requestDailyWelcome(method = "GET") {
  const headers = await getAuthHeaders();
  const res = await fetch("/api/daily-welcome", {
    method,
    headers,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(
      (json && (json.message || json.error)) || "daily_welcome_request_failed"
    );
    err.payload = json;
    err.status = res.status;
    throw err;
  }
  return json;
}

async function initDailyWelcomeWidget() {
  const card = document.getElementById("dailyWelcomeCard");
  if (!card) return;

  let latestState = null;
  const button = document.getElementById("dailyWelcomeBtn");
  if (button) button.disabled = true;

  async function refreshStatus() {
    try {
      const status = await requestDailyWelcome("GET");
      latestState = status;
      updateDailyWelcomeUI(status);
    } catch (err) {
      console.error("daily welcome status error", err);
      if (err.payload?.error === "daily_welcome_disabled") {
        updateDailyWelcomeUI({ enabled: false });
        return;
      }
      updateDailyWelcomeUI(latestState, {
        message: err.message || "상태를 불러오지 못했습니다.",
        isError: true,
        forceVisible: !latestState,
      });
    }
  }

  await refreshStatus();

  if (!button || button.dataset.dailyBound) return;
  button.dataset.dailyBound = "1";

  button.addEventListener("click", async () => {
    if (!latestState?.canClaim) return;
    button.disabled = true;
    updateDailyWelcomeUI(latestState, {
      message: "scene 지급 중...",
      forceVisible: true,
    });
    try {
      const claim = await requestDailyWelcome("POST");
      latestState = { ...claim, enabled: true };
      updateDailyWelcomeUI(latestState);
      if (typeof claim.balance === "number") {
        const creditsEl = document.getElementById("profileCredits");
        if (creditsEl) creditsEl.textContent = claim.balance.toLocaleString("ko-KR");
      }
      if (typeof window.updateSidebarUserInfo === "function") {
        window.updateSidebarUserInfo();
      }
    } catch (err) {
      console.error("daily welcome claim error", err);
      if (err.payload?.error === "daily_welcome_disabled") {
        updateDailyWelcomeUI({ enabled: false });
        return;
      }

      if (err.payload && typeof err.payload === "object") {
        latestState = {
          ...(latestState || {}),
          claimedToday:
            err.payload.claimedToday ?? latestState?.claimedToday ?? 0,
          maxPerDay: err.payload.maxPerDay ?? latestState?.maxPerDay ?? 0,
          nextReset: err.payload.nextReset ?? latestState?.nextReset ?? null,
          amount: latestState?.amount ?? err.payload.amount ?? 0,
          canClaim: false,
          enabled: true,
        };
      }

      const message =
        err.payload?.error === "limit_reached"
          ? "오늘 웰컴 scene을 이미 받았습니다."
          : err.message || "scene 지급 중 오류가 발생했습니다.";
      updateDailyWelcomeUI(latestState, {
        message,
        isError: true,
        forceVisible: true,
      });
    }
  });
}
