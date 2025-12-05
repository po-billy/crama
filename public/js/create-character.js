// create-character.js
// - 스텝 이동
// - 미리보기(이름/이미지)
// - Supabase(sb)로 캐릭터 저장

const MAX_TAG_COUNT = 10;
const MAX_EXAMPLE_PAIRS = 10;
const MAX_CHARACTER_IMAGES = 5;
const MAX_SCENE_IMAGES = 10;
const SCENE_IMAGE_FOLDER = 'scene-templates';
const SCENE_EMOTION_OPTIONS = [
  { value: 'shy', label: '부끄러움 / 수줍음' },
  { value: 'surprised', label: '당황 / 놀람' },
  { value: 'happy', label: '기쁨 / 설렘' },
  { value: 'sad', label: '슬픔 / 우울' },
  { value: 'angry', label: '분노 / 결의' },
  { value: 'fight', label: '적과 맞서 싸울 때' },
  { value: 'romance', label: '로맨스 / 사랑' },
  { value: 'fear', label: '공포 / 위기' }
];

let currentTagList = [];
let tagInputFieldRef = null;
const exampleDialogPairs = [];
let sceneImages = [];
const apiFetch = window.apiFetch || ((...args) => fetch(...args));

function slugify(value) {
  return (value || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'scene';
}

function escapeHtml(value) {
  return (value || '')
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ---------- 예시 대화 관리 ----------

function addExamplePair(initial = { user: '', character: '' }) {
  if (exampleDialogPairs.length >= MAX_EXAMPLE_PAIRS) {
    alert(`예시 대화는 최대 ${MAX_EXAMPLE_PAIRS}쌍까지 추가할 수 있어요.`);
    return;
  }
  exampleDialogPairs.push({ user: initial.user || '', character: initial.character || '' });
  renderExamplePairs();
}

function updateExamplePair(index, field, value) {
  if (!exampleDialogPairs[index]) return;
  exampleDialogPairs[index][field] = value;
}

function removeExamplePair(index) {
  exampleDialogPairs.splice(index, 1);
  renderExamplePairs();
}

function renderExamplePairs() {
  const listEl = document.getElementById('exampleDialogList');
  if (!listEl) return;
  if (!exampleDialogPairs.length) {
    exampleDialogPairs.push({ user: '', character: '' });
  }
  listEl.innerHTML = '';
  exampleDialogPairs.forEach((pair, index) => {
    const item = document.createElement('div');
    item.className = 'example-pair';
    item.innerHTML = `
      <div class="example-pair__header">
        <span>예시 ${index + 1}</span>
        <button type="button" class="btn btn--ghost btn--small example-remove" data-index="${index}">삭제</button>
      </div>
      <div class="example-pair__body">
        <label class="field__label">사용자</label>
        <textarea class="field__control field__control--textarea example-user" data-index="${index}" placeholder="사용자의 메시지">${pair.user || ''}</textarea>
        <label class="field__label">캐릭터</label>
        <textarea class="field__control field__control--textarea example-character" data-index="${index}" placeholder="캐릭터의 답변">${pair.character || ''}</textarea>
      </div>
    `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll('.example-user').forEach(area => {
    area.addEventListener('input', (e) => updateExamplePair(Number(e.target.dataset.index), 'user', e.target.value));
  });
  listEl.querySelectorAll('.example-character').forEach(area => {
    area.addEventListener('input', (e) => updateExamplePair(Number(e.target.dataset.index), 'character', e.target.value));
  });
  listEl.querySelectorAll('.example-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = Number(e.currentTarget.dataset.index);
      removeExamplePair(idx);
    });
  });
}

function getExampleDialogPairsForPayload() {
  return exampleDialogPairs
    .map((pair) => ({
      user: pair.user?.trim() || '',
      character: pair.character?.trim() || '',
    }))
    .filter((pair) => pair.user || pair.character);
}

function serializeExampleDialogPairs() {
  return getExampleDialogPairsForPayload()
    .map(pair => `사용자: ${pair.user || ''}\n캐릭터: ${pair.character || ''}`)
    .filter(Boolean)
    .join('\n\n');
}

// ---------- 이미지 관리 ----------
const DEFAULT_THUMBNAIL = '/assets/sample-character-01.png';
const DEFAULT_INTRO_IMAGE = '/assets/sample-character-02.png';
let characterImages = [];
let thumbnailId = null;
let introImageId = null;

async function addImagesFromFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const remaining = MAX_CHARACTER_IMAGES - characterImages.length;
  if (remaining <= 0) {
    alert(`이미지는 최대 ${MAX_CHARACTER_IMAGES}장까지 업로드할 수 있어요.`);
    return;
  }
  const usableFiles = files.slice(0, remaining);
  const prepared = await Promise.all(
    usableFiles.map(async (file) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('PNG, JPG, WebP 형식만 업로드할 수 있어요.');
        return null;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 한 장당 최대 5MB까지 업로드할 수 있어요.');
        return null;
      }
      const preview = await fileToDataUrl(file);
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        uploadedUrl: null,
      };
    })
  );
  prepared.filter(Boolean).forEach((slot) => characterImages.push(slot));
  ensureDefaultSelections();
  renderImageGrid();
}

function ensureDefaultSelections() {
  if (!characterImages.length) {
    thumbnailId = null;
    introImageId = null;
    return;
  }
  if (!thumbnailId) thumbnailId = characterImages[0].id;
  if (!introImageId) introImageId = characterImages[0].id;
}

function renderImageGrid() {
  const grid = document.getElementById('characterImageGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!characterImages.length) {
    const placeholder = document.createElement('label');
    placeholder.className = 'image-upload-placeholder';
    placeholder.setAttribute('for', 'characterImageInput');
    placeholder.innerHTML = `
      <div class="placeholder-icon">+</div>
      <div class="placeholder-text">
        <strong>이미지를 업로드해 주세요</strong>
        <span>PNG, JPG, WebP · 최대 5장</span>
      </div>
    `;
    placeholder.addEventListener('click', (e) => {
      e.preventDefault();
      triggerImagePicker();
    });
    grid.appendChild(placeholder);
    updatePreviewImage();
    updateIntroPreviewImage();
    return;
  }

  characterImages.forEach((slot) => {
    const item = document.createElement('div');
    item.className = 'image-slot';
    item.dataset.id = slot.id;
    item.innerHTML = `
      <div class="image-slot__preview">
        <img src="${slot.preview}" alt="캐릭터 이미지" />
      </div>
      <div class="image-slot__actions">
        <input type="file" accept="image/*" class="sr-only image-slot__file" data-id="${slot.id}" />
        <button type="button" class="btn btn--secondary image-replace-btn" data-id="${slot.id}">교체</button>
        <button type="button" class="btn btn--ghost btn--small image-remove-btn" data-id="${slot.id}">삭제</button>
      </div>
      <div class="image-slot__radios">
        <label><input type="radio" name="thumbnailImage" value="${slot.id}" ${slot.id === thumbnailId ? 'checked' : ''}> 썸네일로 사용</label>
        <label><input type="radio" name="introImage" value="${slot.id}" ${slot.id === introImageId ? 'checked' : ''}> 인트로 이미지로 사용</label>
      </div>
    `;
    grid.appendChild(item);
  });

  grid.querySelectorAll('.image-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => removeImageById(e.currentTarget.dataset.id));
  });

  grid.querySelectorAll('.image-replace-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const fileInput = grid.querySelector(`.image-slot__file[data-id="${id}"]`);
      fileInput?.click();
    });
  });

  grid.querySelectorAll('.image-slot__file').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const file = e.target.files && e.target.files[0];
      if (file) replaceImageById(id, file);
    });
  });

  grid.querySelectorAll('input[name="thumbnailImage"]').forEach((radio) => {
    radio.addEventListener('change', (e) => setThumbnailId(e.target.value));
  });

  grid.querySelectorAll('input[name="introImage"]').forEach((radio) => {
    radio.addEventListener('change', (e) => setIntroImageId(e.target.value));
  });

  if (characterImages.length < MAX_CHARACTER_IMAGES) {
    const addCard = document.createElement('label');
    addCard.className = 'image-slot image-slot--add';
    addCard.setAttribute('for', 'characterImageInput');
    addCard.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">이미지 추가</div>
      <div class="add-card-hint">PNG, JPG, WebP</div>
    `;
    addCard.addEventListener('click', (e) => {
      e.preventDefault();
      triggerImagePicker();
    });
    grid.appendChild(addCard);
  }

  updatePreviewImage();
  updateIntroPreviewImage();
}

function removeImageById(id) {
  characterImages = characterImages.filter((slot) => slot.id !== id);
  if (thumbnailId === id) thumbnailId = null;
  if (introImageId === id) introImageId = null;
  ensureDefaultSelections();
  renderImageGrid();
}

async function replaceImageById(id, file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    alert('PNG, JPG, WebP 형식만 업로드할 수 있어요.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('이미지 한 장당 최대 5MB까지 업로드할 수 있어요.');
    return;
  }
  const target = characterImages.find((slot) => slot.id === id);
  if (!target) return;
  target.preview = await fileToDataUrl(file);
  target.file = file;
  target.uploadedUrl = null;
  renderImageGrid();
}

function setThumbnailId(id) {
  if (!characterImages.find((slot) => slot.id === id)) return;
  thumbnailId = id;
  updatePreviewImage();
}

function setIntroImageId(id) {
  if (!characterImages.find((slot) => slot.id === id)) return;
  introImageId = id;
  updateIntroPreviewImage();
}

function updatePreviewImage() {
  const previewImage = document.getElementById('previewImage');
  if (!previewImage) return;
  const slot = characterImages.find((img) => img.id === thumbnailId);
  previewImage.src = slot?.preview || DEFAULT_THUMBNAIL;
}

function updateIntroPreviewImage() {
  const wrapper = document.getElementById('previewIntroImageWrapper');
  const img = document.getElementById('previewIntroImage');
  if (!wrapper || !img) return;
  const slot = characterImages.find((img) => img.id === introImageId);
  img.src = slot?.preview || DEFAULT_INTRO_IMAGE;
}

function updatePreviewShareBadge(enabled) {
  const badge = document.getElementById('previewShareBadge');
  if (!badge) return;
  badge.style.display = enabled ? 'inline-flex' : 'none';
}

async function populatePreviewCreatorInfo() {
  const nameEl = document.getElementById('previewCreatorName');
  const handleEl = document.getElementById('previewCreatorHandle');
  const avatarEl = document.getElementById('previewCreatorAvatar');
  if (!nameEl && !handleEl && !avatarEl) return;

  const applyPreviewCreator = (displayName, handleText, avatarText) => {
    if (nameEl) nameEl.textContent = displayName;
    if (handleEl) handleEl.textContent = handleText;
    if (avatarEl) avatarEl.textContent = avatarText;
  };

  const defaultName = '크리에이터';
  const defaultHandle = '@creator';
  const defaultAvatar = 'CR';
  applyPreviewCreator(defaultName, defaultHandle, defaultAvatar);

  if (typeof window.fetchUserContext !== 'function') return;

  try {
    const ctx = await window.fetchUserContext();
    if (!ctx?.user) return;

    const displayName =
      ctx.profile?.display_name ||
      ctx.user?.user_metadata?.name ||
      ctx.user?.email?.split('@')[0] ||
      defaultName;

    const rawHandle =
      ctx.profile?.handle ||
      ctx.user?.user_metadata?.user_name ||
      (ctx.user?.email ? ctx.user.email.split('@')[0] : '');
    const handleBase = rawHandle || 'creator';
    const handleText = handleBase ? `@${handleBase}` : defaultHandle;

    const initialsSource = (displayName || handleBase || defaultAvatar).replace(/\s+/g, '');
    const initials = initialsSource ? initialsSource.slice(0, 2) : defaultAvatar;

    applyPreviewCreator(displayName, handleText, initials || defaultAvatar);
  } catch (e) {
    console.warn('preview creator info load failed', e);
  }
}

function getImageState() {
  return {
    images: characterImages,
    thumbnailId,
    introImageId,
  };
}

function triggerImagePicker() {
  const input = document.getElementById('characterImageInput');
  if (input) input.click();
}

// ---------- 상황 이미지 관리 ----------
async function addSceneImagesFromFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const remaining = MAX_SCENE_IMAGES - sceneImages.length;
  if (remaining <= 0) {
    alert(`상황 이미지는 최대 ${MAX_SCENE_IMAGES}장까지 등록할 수 있어요.`);
    return;
  }
  const usableFiles = files.slice(0, remaining);
  const prepared = await Promise.all(
    usableFiles.map(async (file, idx) => {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        alert('PNG, JPG, WebP 형식만 업로드할 수 있어요.');
        return null;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('이미지 한 장당 최대 5MB까지 업로드할 수 있어요.');
        return null;
      }
      const preview = await fileToDataUrl(file);
      const preset = SCENE_EMOTION_OPTIONS[(sceneImages.length + idx) % SCENE_EMOTION_OPTIONS.length];
      return {
        id: crypto.randomUUID(),
        file,
        preview,
        uploadedUrl: null,
        label: preset?.label?.split('/')[0]?.trim() || '',
        keywords: '',
        description: '',
        emotionKey: preset?.value || '',
      };
    })
  );
  prepared.filter(Boolean).forEach((slot) => sceneImages.push(slot));
  renderSceneImageGrid();
}

function buildEmotionOptionHtml(selected) {
  const placeholder = '<option value="">감정 선택 (선택)</option>';
  const options = SCENE_EMOTION_OPTIONS
    .map(opt => `<option value="${opt.value}" ${opt.value === selected ? 'selected' : ''}>${opt.label}</option>`)
    .join('');
  return placeholder + options;
}

function renderSceneImageGrid() {
  const grid = document.getElementById('sceneImageGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!sceneImages.length) {
    const placeholder = document.createElement('label');
    placeholder.className = 'scene-slot scene-slot--add';
    placeholder.setAttribute('for', 'sceneImageInput');
    placeholder.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">상황 이미지 업로드</div>
      <div class="add-card-hint">최대 ${MAX_SCENE_IMAGES}장</div>
    `;
    placeholder.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSceneImagePicker();
    });
    grid.appendChild(placeholder);
    return;
  }

  sceneImages.forEach((slot) => {
    const item = document.createElement('div');
    item.className = 'scene-slot';
    item.innerHTML = `
      <div class="scene-slot__preview">
        <img src="${slot.preview}" alt="상황 이미지" />
      </div>
      <div class="scene-slot__fields">
        <label>상황 키워드</label>
        <input type="text" class="scene-label-input" data-id="${slot.id}" value="${escapeHtml(slot.label || '')}" placeholder="예: 부끄러울 때" maxlength="40" />
        <label>추천 감정</label>
        <select class="scene-emotion-select" data-id="${slot.id}">
          ${buildEmotionOptionHtml(slot.emotionKey)}
        </select>
        <label>관련 키워드 (쉼표 구분)</label>
        <input type="text" class="scene-keyword-input" data-id="${slot.id}" value="${escapeHtml(slot.keywords || '')}" placeholder="예: 수줍음, 얼굴 빨개짐" maxlength="80" />
        <label>상황 설명</label>
        <textarea class="scene-description-input" data-id="${slot.id}" placeholder="이 이미지가 사용될 상황을 설명해 주세요.">${escapeHtml(slot.description || '')}</textarea>
      </div>
      <div class="scene-slot__actions">
        <button type="button" class="btn btn--secondary scene-replace-btn" data-id="${slot.id}">교체</button>
        <button type="button" class="btn btn--ghost btn--small scene-remove-btn" data-id="${slot.id}">삭제</button>
      </div>
      <input type="file" class="sr-only scene-file-input" data-id="${slot.id}" accept="image/*" />
    `;
    grid.appendChild(item);
  });

  grid.querySelectorAll('.scene-label-input').forEach((input) => {
    input.addEventListener('input', (e) => updateSceneImageField(e.target.dataset.id, 'label', e.target.value));
  });
  grid.querySelectorAll('.scene-keyword-input').forEach((input) => {
    input.addEventListener('input', (e) => updateSceneImageField(e.target.dataset.id, 'keywords', e.target.value));
  });
  grid.querySelectorAll('.scene-description-input').forEach((input) => {
    input.addEventListener('input', (e) => updateSceneImageField(e.target.dataset.id, 'description', e.target.value));
  });
  grid.querySelectorAll('.scene-emotion-select').forEach((select) => {
    select.addEventListener('change', (e) => updateSceneImageField(e.target.dataset.id, 'emotionKey', e.target.value));
  });
  grid.querySelectorAll('.scene-remove-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => removeSceneImageById(e.currentTarget.dataset.id));
  });
  grid.querySelectorAll('.scene-replace-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      const fileInput = grid.querySelector(`.scene-file-input[data-id="${id}"]`);
      fileInput?.click();
    });
  });
  grid.querySelectorAll('.scene-file-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const file = e.target.files && e.target.files[0];
      if (file) replaceSceneImageById(id, file);
    });
  });

  if (sceneImages.length < MAX_SCENE_IMAGES) {
    const addBtn = document.createElement('label');
    addBtn.className = 'scene-slot scene-slot--add';
    addBtn.setAttribute('for', 'sceneImageInput');
    addBtn.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">상황 이미지 추가</div>
      <div class="add-card-hint">PNG, JPG, WebP</div>
    `;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      triggerSceneImagePicker();
    });
    grid.appendChild(addBtn);
  }
}

function updateSceneImageField(id, field, value) {
  const target = sceneImages.find((slot) => slot.id === id);
  if (!target) return;
  target[field] = value;
}

function removeSceneImageById(id) {
  sceneImages = sceneImages.filter((slot) => slot.id !== id);
  renderSceneImageGrid();
}

async function replaceSceneImageById(id, file) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    alert('PNG, JPG, WebP 형식만 업로드할 수 있어요.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert('이미지 한 장당 최대 5MB까지 업로드할 수 있어요.');
    return;
  }
  const target = sceneImages.find((slot) => slot.id === id);
  if (!target) return;
  target.preview = await fileToDataUrl(file);
  target.file = file;
  target.uploadedUrl = null;
  renderSceneImageGrid();
}

function getSceneImageState() {
  return sceneImages.map((slot) => ({
    ...slot,
    label: slot.label?.trim() || '',
    keywords: slot.keywords?.trim() || '',
    description: slot.description?.trim() || '',
    emotionKey: slot.emotionKey || slugify(slot.label || 'scene'),
  }));
}

function triggerSceneImagePicker() {
  const input = document.getElementById('sceneImageInput');
  if (input) input.click();
}


async function uploadSelectedImages(imageState) {
  if (!imageState?.images?.length) {
    return { gallery: [], thumbnail: null, intro: null };
  }
  const uploaded = [];
  for (const slot of imageState.images) {
    let url = slot.uploadedUrl || null;
    if (!url && slot.file) {
      url = await uploadImageAsset(slot.file, 'avatars');
      slot.uploadedUrl = url;
    }
    if (url) uploaded.push({ id: slot.id, url });
  }
  const findUrl = (id) => uploaded.find(item => item.id === id)?.url;
  const defaultUrl = uploaded[0]?.url || null;
  const thumbnail = findUrl(imageState.thumbnailId) || defaultUrl;
  const intro = findUrl(imageState.introImageId) || thumbnail || defaultUrl;
  return {
    gallery: uploaded.map(item => item.url),
    thumbnail,
    intro,
  };
}

async function uploadSceneImageTemplates(sceneState) {
  if (!sceneState?.length) return [];
  const result = [];
  for (const slot of sceneState) {
    let url = slot.uploadedUrl || null;
    if (!url && slot.file) {
      url = await uploadImageAsset(slot.file, SCENE_IMAGE_FOLDER);
      slot.uploadedUrl = url;
    }
    if (!url) continue;
    const keywords = slot.keywords
      ? slot.keywords
          .split(',')
          .map((word) => word.trim())
          .filter(Boolean)
      : [];
    result.push({
      id: slot.id,
      image_url: url,
      label: slot.label || '',
      description: slot.description || '',
      keywords,
      emotion_key: slot.emotionKey || slugify(slot.label || 'scene'),
    });
  }
  return result;
}

// ---------- 공통 유틸 ----------

// 현재 로그인 유저 가져오기
async function getCurrentUser() {
    if (typeof window.sb === 'undefined') {
        console.error('Supabase 클라이언트(window.sb)가 없습니다. common.js 로드 순서를 확인하세요.');
        return null;
    }

    const { data, error } = await window.sb.auth.getSession();
    if (error || !data || !data.session) return null;
    return data.session.user;
}

// 특정 스텝으로 이동
function goStep(stepId) {
    const stepTabs = document.querySelectorAll('.steps-nav__item');
    const steps = document.querySelectorAll('.step');

    stepTabs.forEach(btn => {
        const active = btn.dataset.step === stepId;
        btn.classList.toggle('steps-nav__item--active', active);
    });

    steps.forEach(step => {
        step.classList.toggle('step--active', step.id === stepId);
    });
}

// 폼 데이터 수집
function collectCharacterForm() {
    // STEP 1: 기본 정보
    const basic = document.getElementById('step-basic');
    const basicTextInputs = basic.querySelectorAll('input.field__control[type="text"]');
    const name = basicTextInputs[0] ? basicTextInputs[0].value.trim() : '';
    const oneLine = basicTextInputs[1] ? basicTextInputs[1].value.trim() : '';

    // STEP 2: 인트로 / 예시 / 가이드
    const introField = document.getElementById('introTextarea');
    const playGuideField = document.getElementById('playGuideTextarea');
    const intro = introField ? introField.value.trim() : '';
    const playGuide = playGuideField ? playGuideField.value.trim() : '';
    const exampleDialog = serializeExampleDialogPairs();

    const promptTextarea = document.getElementById('promptTextarea');
    const prompt = promptTextarea ? promptTextarea.value.trim() : '';

    // STEP 5: 상세
    const detail = document.getElementById('step-detail');
    const detailTextareas = detail.querySelectorAll('textarea.field__control');
    const description = detailTextareas[0] ? detailTextareas[0].value.trim() : '';

    const selects = detail.querySelectorAll('select.field__control');
    const genre = selects[0] ? selects[0].value : '';
    const target = selects[1] ? selects[1].value : '';

    commitPendingTag();
    const tags = currentTagList.slice(0, MAX_TAG_COUNT);

    const visibilityRadio = detail.querySelector('input[name="visibility"]:checked');
    const visibility = visibilityRadio ? visibilityRadio.value : 'public';

    const toggleCheckboxes = detail.querySelectorAll('.toggle input[type="checkbox"]');
    const isMonetized = toggleCheckboxes[0] ? toggleCheckboxes[0].checked : false;
    const commentsEnabled = toggleCheckboxes[1]
        ? toggleCheckboxes[1].checked
        : true;

    return {
        name,
        oneLine,
        intro,
        exampleDialog,
        playGuide,
        prompt,
        description,
        genre,
        target,
        tags,
        visibility,
        isMonetized,
        commentsEnabled,
        images: getImageState(),
        sceneImages: getSceneImageState(),
    };
}

const AVATAR_BUCKET = 'character_profile';  // 🔴 여기: Supabase Storage에서 실제 버킷 이름으로 바꾸기


function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addTagFromValue(value) {
    if (!value) return;
    const normalized = value.replace(/^#/, '').trim();
    if (!normalized) return;
    if (currentTagList.includes(normalized)) return;
    if (currentTagList.length >= MAX_TAG_COUNT) {
        alert('해시태그는 최대 10개까지 등록할 수 있어요.');
        return;
    }
    currentTagList.push(normalized);
    renderTagChips();
}

function removeTagAt(index) {
    currentTagList.splice(index, 1);
    renderTagChips();
}

function renderTagChips() {
    const chipList = document.getElementById('tagChipList');
    if (!chipList) return;
    chipList.innerHTML = '';
    currentTagList.forEach((tag, idx) => {
        const chip = document.createElement('span');
        chip.className = 'tag-chip';
        const label = document.createElement('span');
        label.textContent = `#${tag}`;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => removeTagAt(idx));
        chip.append(label, removeBtn);
        chipList.appendChild(chip);
    });
    if (tagInputFieldRef) {
        chipList.appendChild(tagInputFieldRef);
        const atMax = currentTagList.length >= MAX_TAG_COUNT;
        tagInputFieldRef.placeholder = atMax ? '최대 10개까지 등록 가능' : '#태그 입력 후 Enter';
        tagInputFieldRef.disabled = atMax;
        if (!atMax) {
            tagInputFieldRef.focus();
        }
    }
    updatePreviewTags();
}

function commitPendingTag() {
    if (!tagInputFieldRef) return;
    const pending = tagInputFieldRef.value.trim();
    if (pending) {
        addTagFromValue(pending);
        tagInputFieldRef.value = '';
    }
}

function setupTagInput() {
    const chipList = document.getElementById('tagChipList');
    const input = document.getElementById('tagInputField');
    if (!chipList || !input) return;
    tagInputFieldRef = input;
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTagFromValue(input.value);
            input.value = '';
            requestAnimationFrame(() => input.focus());
        } else if (e.key === 'Backspace' && !input.value && currentTagList.length) {
            currentTagList.pop();
            renderTagChips();
        }
    });
    renderTagChips();
}

function updatePreviewTags() {
    const previewTags = document.getElementById('previewTags');
    if (!previewTags) return;
    previewTags.innerHTML = '';
    const visibleTags = currentTagList.slice(0, 3);
    if (!visibleTags.length) {
        const placeholder = document.createElement('span');
        placeholder.className = 'tag';
        placeholder.textContent = '#태그';
        previewTags.appendChild(placeholder);
        return;
    }
    visibleTags.forEach(tag => {
        const chip = document.createElement('span');
        chip.className = 'tag';
        chip.textContent = `#${tag}`;
        previewTags.appendChild(chip);
    });
}

async function uploadImageAsset(file, folder = 'avatars') {
  const dataUrl = await fileToDataUrl(file);
  const res = await apiFetch('/api/upload/avatar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dataUrl,
      fileName: file.name,
      bucket: AVATAR_BUCKET,
      folder,
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || 'upload failed');
  }

  const json = await res.json();
  if (!json?.url) throw new Error('no url returned');
  return json.url;
}

async function handleSubmitCharacter() {
  const user = await getCurrentUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }

  const form = collectCharacterForm();

  // 필수값 체크 (지금 쓰던 거 그대로)
  if (!form.name) { alert('캐릭터 이름을 입력해 주세요.'); goStep('step-basic'); return; }
  if (!form.oneLine) { alert('한 줄 소개를 입력해 주세요.'); goStep('step-basic'); return; }
  if (!form.intro) { alert('인트로를 입력해 주세요.'); goStep('step-intro'); return; }
  if (!form.prompt) { alert('캐릭터 프롬프트를 입력해 주세요.'); goStep('step-detail'); return; }
  if (!form.description) { alert('캐릭터 설명을 입력해 주세요.'); goStep('step-detail'); return; }

  if (!form.images.images.length) {
    alert('캐릭터 이미지를 최소 1장 업로드해 주세요.');
    goStep('step-basic');
    return;
  }

  let uploadedImages;
  try {
    uploadedImages = await uploadSelectedImages(form.images);
  } catch (uploadErr) {
    console.error('이미지 업로드 실패:', uploadErr);
    alert('이미지 업로드 중 오류가 발생했습니다. (콘솔 로그 참고)');
    return;
  }

  let sceneTemplates = [];
  try {
    sceneTemplates = await uploadSceneImageTemplates(form.sceneImages);
  } catch (sceneErr) {
    console.error('상황 이미지 업로드 실패:', sceneErr);
    alert('상황 이미지 업로드 중 오류가 발생했습니다. (콘솔 로그 참고)');
    return;
  }

  const examplePairsPayload = getExampleDialogPairsForPayload();

  const payload = {
    owner_id: user.id,
    name: form.name,
    one_line: form.oneLine,
    intro: form.intro,
    example_dialog: form.exampleDialog || null,
    play_guide: form.playGuide || null,
    prompt: form.prompt,
    description: form.description,
    genre: form.genre || null,
    target: form.target || null,
    tags: form.tags,
    visibility: form.visibility,
    is_monetized: form.isMonetized,
    comment_enabled: form.commentsEnabled,
    avatar_url: uploadedImages.thumbnail || null
  };

  if (uploadedImages.gallery.length) {
    payload.gallery_image_urls = uploadedImages.gallery;
  }
  if (uploadedImages.thumbnail) {
    payload.thumbnail_image_url = uploadedImages.thumbnail;
  }
  if (uploadedImages.intro) {
    payload.intro_image_url = uploadedImages.intro;
  }
  if (examplePairsPayload.length) {
    payload.example_dialog_pairs = examplePairsPayload;
  }
  if (sceneTemplates.length) {
    payload.scene_image_templates = sceneTemplates;
  }

  const { data, error } = await insertCharacter(payload);

  if (error) {
    console.error(error);
    alert('캐릭터 생성 중 오류가 발생했습니다.');
    return;
  }

  alert('캐릭터가 생성되었습니다.');
  window.location.href = `/character?id=${data.id}`;
}

async function insertCharacter(payload) {
  const extraKeys = ['gallery_image_urls', 'intro_image_url', 'thumbnail_image_url', 'example_dialog', 'scene_image_templates', 'example_dialog_pairs'];
  let result = await sb
    .from('characters')
    .insert(payload)
    .select()
    .single();

  if (result.error && /gallery_image_urls|intro_image_url|thumbnail_image_url|example_dialog/.test(result.error.message || '')) {
    const fallbackPayload = { ...payload };
    extraKeys.forEach((key) => delete fallbackPayload[key]);
    result = await sb
      .from('characters')
      .insert(fallbackPayload)
      .select()
      .single();
  }

  return result;
}

// ---------- DOM 초기화 ----------

document.addEventListener('DOMContentLoaded', () => {
    // 스텝 탭
    document.querySelectorAll('.steps-nav__item').forEach(btn => {
        btn.addEventListener('click', () => {
            const stepId = btn.dataset.step;
            if (stepId) goStep(stepId);
        });
    });

    // 다음/이전
    document.querySelectorAll('.step-next').forEach(btn => {
        btn.addEventListener('click', () => {
            const next = btn.dataset.next;
            if (next) goStep(next);
        });
    });
    document.querySelectorAll('.step-prev').forEach(btn => {
        btn.addEventListener('click', () => {
            const prev = btn.dataset.prev;
            if (prev) goStep(prev);
        });
    });

    // 이름 → 미리보기 이름
    const basic = document.getElementById('step-basic');
    if (basic) {
        const textInputs = basic.querySelectorAll('input.field__control[type="text"]');
        const nameInput = textInputs[0];
        const oneLineInput = textInputs[1];
        const previewName = document.getElementById('previewName');
        const previewOneLine = document.getElementById('previewOneLine');

        if (nameInput && previewName) {
            nameInput.addEventListener('input', () => {
                previewName.textContent = nameInput.value || '캐릭터 이름';
            });
        }
        if (oneLineInput && previewOneLine) {
            oneLineInput.addEventListener('input', () => {
                previewOneLine.textContent = oneLineInput.value || '한 줄 소개가 여기에 표시됩니다.';
            });
        }
    }

    const introTextarea = document.getElementById('introTextarea');
    const previewIntro = document.getElementById('previewIntro');
    if (introTextarea && previewIntro) {
        introTextarea.addEventListener('input', () => {
            previewIntro.textContent = introTextarea.value || '인트로 입력 시 첫 대화에 사용됩니다.';
        });
    }

    setupTagInput();
    renderImageGrid();
    renderSceneImageGrid();
    renderExamplePairs();
    const addPairBtn = document.getElementById('addExamplePairBtn');
    if (addPairBtn) {
        addPairBtn.addEventListener('click', () => addExamplePair());
    }

    const imageInputEl = document.getElementById('characterImageInput');
    if (imageInputEl) {
        imageInputEl.addEventListener('change', (e) => {
            addImagesFromFiles(e.target.files);
            imageInputEl.value = '';
        });
    }
    const uploadTrigger = document.getElementById('imageUploadTrigger');
    if (uploadTrigger) {
        uploadTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            triggerImagePicker();
        });
    }
    const imageGenerateBtn = document.getElementById('imageGenerateBtn');
    if (imageGenerateBtn) {
        imageGenerateBtn.addEventListener('click', () => {
            window.open('/studio', '_blank');
        });
    }

    const sceneImageInput = document.getElementById('sceneImageInput');
    if (sceneImageInput) {
        sceneImageInput.addEventListener('change', (e) => {
            addSceneImagesFromFiles(e.target.files);
            sceneImageInput.value = '';
        });
    }
    const sceneImageUploadTrigger = document.getElementById('sceneImageUploadTrigger');
    if (sceneImageUploadTrigger) {
        sceneImageUploadTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            triggerSceneImagePicker();
        });
    }

    const monetizedToggle = document.getElementById('monetizedToggle');
    if (monetizedToggle) {
        updatePreviewShareBadge(monetizedToggle.checked);
        monetizedToggle.addEventListener('change', () => updatePreviewShareBadge(monetizedToggle.checked));
    } else {
        updatePreviewShareBadge(false);
    }
    populatePreviewCreatorInfo();

    // 상단 "등록하기" 버튼
    const submitTopBtn = document.getElementById('submitCharacter');
    if (submitTopBtn) submitTopBtn.addEventListener('click', handleSubmitCharacter);

    // 마지막 스텝의 "등록" 버튼
    const finalSubmitBtn = document.querySelector(
        '#step-detail .step__footer .btn.btn--primary'
    );
    if (finalSubmitBtn) finalSubmitBtn.addEventListener('click', handleSubmitCharacter);
});
