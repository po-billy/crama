document.addEventListener("DOMContentLoaded", () => {
  initCreatorPage();
});

async function initCreatorPage() {
  try {
    const ctx = await window.fetchUserContext();
    if (!ctx) {
      if (window.openLoginModal) {
        await window.openLoginModal({ redirect: window.location.href });
      } else {
        window.location.href = "/login";
      }
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("user") || ctx.user.id;
    const isSelf = targetUserId === ctx.user.id;
    const targetProfile = isSelf ? ctx.profile : await fetchProfileById(targetUserId);
    const targetUser = isSelf ? ctx.user : { id: targetUserId, email: "" };

    renderHero(targetProfile, targetUser, isSelf);
    const [characterItems, imageItems] = await Promise.all([
      fetchCharacterItems(targetUser),
      fetchImageItems(targetUser),
    ]);

    const allItems = [...characterItems, ...imageItems];
    renderGrid(allItems);
    setupFilters(allItems);
  } catch (e) {
    console.error("creator init error", e);
  }
}

function renderHero(profile, user, isSelf) {
  const name = profile?.display_name || user.user_metadata?.name || user.email?.split("@")[0] || "크리에이터";
  const handle = profile?.handle || user.user_metadata?.user_name || user.email?.split("@")[0] || "creator";
  const avatarEl = document.getElementById("creatorAvatar");
  if (avatarEl) avatarEl.textContent = name.slice(0, 2);
  const nameEl = document.getElementById("creatorName");
  if (nameEl) nameEl.textContent = name;
  const handleEl = document.getElementById("creatorHandle");
  if (handleEl) handleEl.textContent = `@${handle}`;

  const followBtn = document.getElementById("followBtn");
  if (followBtn) {
    if (isSelf) {
      followBtn.textContent = "프로필 수정";
      followBtn.onclick = () => (window.location.href = "/mypage");
    } else {
      followBtn.textContent = "팔로우";
    }
  }
}
`;
}

async function fetchCharacterItems(user) {
  try {
    const { data, error } = await window.sb
      .from("character_chats")
      .select("character_id, created_at, characters(name, avatar_url, description)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
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
      kind: "character",
      title: row.characters?.name || "罹먮┃??,
      subtitle: row.characters?.description || "罹먮┃??梨?,
      thumbUrl: row.characters?.avatar_url || "./assets/sample-character-01.png",
    }));
  } catch (e) {
    console.error("fetchCharacterItems error", e);
    return [];
  }
}

async function fetchImageItems(user) {
  try {
    const { data, error } = await window.sb
      .from("user_contents")
      .select("id, title, prompt, thumb_url, full_url, created_at")
      .eq("user_id", user.id)
      .eq("kind", "image")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;

    return (data || []).map((row) => ({
      id: row.id,
      kind: "image",
      title: row.title || row.prompt || "?대?吏",
      subtitle: row.created_at ? new Date(row.created_at).toLocaleDateString("ko-KR") : "",
      thumbUrl: row.thumb_url || row.full_url,
      fullUrl: row.full_url || row.thumb_url,
    }));
  } catch (e) {
    console.error("fetchImageItems error", e);
    return [];
  }
}

function renderGrid(items) {
  const grid = document.getElementById("creatorGrid");
  const empty = document.getElementById("creatorEmpty");
  if (!grid || !empty) return;
  grid.innerHTML = "";

  if (!items.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  items.forEach((item) => {
    const card = document.createElement("article");
    card.className = "creator-card";
    card.dataset.kind = item.kind;
    const thumb = document.createElement("div");
    thumb.className = "creator-card-thumb";
    thumb.innerHTML = `<img src="${item.thumbUrl || ""}" alt="${item.title}" />`;
    const body = document.createElement("div");
    body.className = "creator-card-body";
    body.innerHTML = `
      <div class="creator-card-title">${item.title}</div>
      <div class="creator-card-sub">${item.subtitle || ""}</div>
      <div class="creator-card-meta">${item.kind === "image" ? "?대?吏" : "罹먮┃??}</div>
    `;
    card.appendChild(thumb);
    card.appendChild(body);

    card.addEventListener("click", () => {
      if (item.kind === "image") {
        openDrawerImageModal(items.filter((i) => i.kind === "image"), item.id);
      } else if (item.kind === "character") {
        window.location.href = `/character?id=${item.id}`;
      }
    });

    grid.appendChild(card);
  });

  const worksCountEl = document.getElementById("creatorWorksCount");
  if (worksCountEl) worksCountEl.textContent = items.length.toString();
}

function setupFilters(allItems) {
  const chips = document.querySelectorAll(".filter-chip");
  const grid = document.getElementById("creatorGrid");
  const empty = document.getElementById("creatorEmpty");
  if (!chips.length || !grid || !empty) return;

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const filter = chip.dataset.filter || "all";
      let filtered = allItems;
      if (filter === "image") filtered = allItems.filter((i) => i.kind === "image");
      if (filter === "character") filtered = allItems.filter((i) => i.kind === "character");
      renderGrid(filtered);
    });
  });
}

async function fetchProfileById(userId) {
  try {
    const { data, error } = await window.sb.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data;
  } catch (e) {
    console.error("fetchProfileById error", e);
    return null;
  }
}
