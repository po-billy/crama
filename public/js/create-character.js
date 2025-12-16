(function () {
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
const imagePickerState = {
  context: 'character',
  isMobile: window.matchMedia('(max-width: 768px)'),
  sourceModal: null,
  libraryModal: null,
  cropModal: null,
  library: {
    loading: false,
    loaded: false,
    items: [],
  },
  crop: {
    canvas: null,
    ctx: null,
    image: null,
    scale: 1,
    minScale: 1,
    maxScale: 3,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0,
    sourceName: '',
    objectUrl: null,
  },
};
let editingCharacterId = null;
let editingCharacterData = null;

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
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'image-upload-placeholder';
    placeholder.innerHTML = `
      <div class="placeholder-icon">+</div>
      <div class="placeholder-text">
        <strong>이미지를 업로드해 주세요</strong>
        <span>PNG, JPG, WebP · 최대 5장</span>
      </div>
    `;
    placeholder.addEventListener('click', (e) => {
      e.preventDefault();
      openImageSourceModal('character');
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
    const addCard = document.createElement('button');
    addCard.type = 'button';
    addCard.className = 'image-slot image-slot--add';
    addCard.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">이미지 추가</div>
      <div class="add-card-hint">PNG, JPG, WebP</div>
    `;
    addCard.addEventListener('click', (e) => {
      e.preventDefault();
      openImageSourceModal('character');
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

function triggerImagePicker(target = imagePickerState.context || 'character') {
  const normalized = target === 'scene' ? 'scene' : 'character';
  imagePickerState.context = normalized;
  const inputId = normalized === 'scene' ? 'sceneImageInput' : 'characterImageInput';
  const input = document.getElementById(inputId);
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
    const placeholder = document.createElement('button');
    placeholder.type = 'button';
    placeholder.className = 'scene-slot scene-slot--add';
    placeholder.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">상황 이미지 업로드</div>
      <div class="add-card-hint">최대 ${MAX_SCENE_IMAGES}장</div>
    `;
    placeholder.addEventListener('click', (e) => {
      e.preventDefault();
      openImageSourceModal('scene');
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
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'scene-slot scene-slot--add';
    addBtn.innerHTML = `
      <div class="add-card-icon">+</div>
      <div class="add-card-text">상황 이미지 추가</div>
      <div class="add-card-hint">PNG, JPG, WebP</div>
    `;
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openImageSourceModal('scene');
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
    const descriptionField = document.getElementById('descriptionTextarea');
    const description = descriptionField ? descriptionField.value.trim() : '';

    const genreSelect = document.getElementById('genreSelect');
    const targetSelect = document.getElementById('targetSelect');
    const genre = genreSelect ? genreSelect.value : '';
    const target = targetSelect ? targetSelect.value : '';

    commitPendingTag();
    const tags = currentTagList.slice(0, MAX_TAG_COUNT);

    const visibilityRadio = detail.querySelector('input[name="visibility"]:checked');
    const visibility = visibilityRadio ? visibilityRadio.value : 'public';

    const isMonetized = document.getElementById('monetizedToggle')
        ? document.getElementById('monetizedToggle').checked
        : false;
    const commentsEnabled = document.getElementById('commentToggle')
        ? document.getElementById('commentToggle').checked
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

let draftSaving = false;

function setDraftSaving(loading) {
  draftSaving = loading;
  document.querySelectorAll('[data-save-draft]').forEach((btn) => {
    if (loading) {
      btn.setAttribute('disabled', 'true');
    } else {
      btn.removeAttribute('disabled');
    }
  });
}

async function handleSaveDraft(event) {
  event?.preventDefault();
  if (draftSaving) return;
  const user = await getCurrentUser();
  if (!user) {
    alert('로그인이 필요합니다.');
    return;
  }
  const form = collectCharacterForm();
  if (!form.name || form.name.length < 2) {
    alert('임시 저장을 위해 캐릭터 이름(2자 이상)이 필요합니다.');
    goStep('step-basic');
    return;
  }

  setDraftSaving(true);
  try {
    const uploadedImages = await uploadSelectedImages(form.images);
    const sceneTemplates = await uploadSceneImageTemplates(form.sceneImages);
    const examplePairsPayload = getExampleDialogPairsForPayload();
    const metadata = Object.assign({}, editingCharacterData?.metadata || {}, {
      status: 'draft',
      draft_saved_at: new Date().toISOString(),
    });
    const payload = {
      owner_id: user.id,
      name: form.name,
      one_line: form.oneLine || null,
      intro: form.intro || null,
      example_dialog: form.exampleDialog || null,
      play_guide: form.playGuide || null,
      prompt: form.prompt || null,
      description: form.description || null,
      genre: form.genre || null,
      target: form.target || null,
      tags: form.tags || [],
      visibility: 'draft',
      is_monetized: form.isMonetized,
      comment_enabled: form.commentsEnabled,
      avatar_url: uploadedImages.thumbnail || null,
      metadata,
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

    let response;
    if (editingCharacterId) {
      response = await updateCharacter(editingCharacterId, payload);
    } else {
      response = await insertCharacter(payload);
    }
    const { data, error } = response;
    if (error) {
      throw error;
    }
    if (data?.id) {
      editingCharacterId = data.id;
      editingCharacterData = data;
    }
    alert('임시 저장되었습니다. 내 작품 > 미등록에서 확인할 수 있어요.');
  } catch (err) {
    console.error('draft save failed', err);
    alert('임시 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    setDraftSaving(false);
  }
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
  if (!form.genre) { alert('장르를 선택해 주세요.'); goStep('step-detail'); return; }
  if (!form.target) { alert('타깃을 선택해 주세요.'); goStep('step-detail'); return; }

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

  let response;
  if (editingCharacterId) {
    response = await updateCharacter(editingCharacterId, payload);
  } else {
    response = await insertCharacter(payload);
  }

  const { data, error } = response;

  if (error) {
    console.error(error);
    alert('캐릭터 생성 중 오류가 발생했습니다.');
    return;
  }

  const redirectId = data?.id || editingCharacterId;
  alert(editingCharacterId ? '캐릭터가 수정되었습니다.' : '캐릭터가 생성되었습니다.');
  if (redirectId) {
    window.location.href = `/character?id=${redirectId}`;
  } else {
    window.location.href = '/works';
  }
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

async function updateCharacter(id, payload) {
  const extraKeys = ['gallery_image_urls', 'intro_image_url', 'thumbnail_image_url', 'example_dialog', 'scene_image_templates', 'example_dialog_pairs'];
  let result = await sb
    .from('characters')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (result.error && /gallery_image_urls|intro_image_url|thumbnail_image_url|example_dialog/.test(result.error.message || '')) {
    const fallbackPayload = { ...payload };
    extraKeys.forEach((key) => delete fallbackPayload[key]);
    result = await sb
      .from('characters')
      .update(fallbackPayload)
      .eq('id', id)
      .select()
      .single();
  }

  return result;
}

function sanitizeTags(tags = []) {
  return (tags || [])
    .map((tag) => (typeof tag === 'string' ? tag.replace(/^#/, '').trim() : ''))
    .filter(Boolean);
}

function hydrateImageState(character) {
  characterImages = [];
  thumbnailId = null;
  introImageId = null;
  const seen = new Set();
  const addSlot = (url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    const id = crypto.randomUUID();
    characterImages.push({
      id,
      file: null,
      preview: url,
      uploadedUrl: url,
    });
    if (character.thumbnail_image_url === url) thumbnailId = id;
    if (character.intro_image_url === url) introImageId = id;
  };
  addSlot(character.thumbnail_image_url);
  addSlot(character.intro_image_url);
  (character.gallery_image_urls || []).forEach(addSlot);
  addSlot(character.avatar_url);
  ensureDefaultSelections();
  renderImageGrid();
}

function hydrateSceneState(character) {
  sceneImages = (character.scene_image_templates || []).map((scene) => {
    const keywords = Array.isArray(scene.keywords)
      ? scene.keywords.join(', ')
      : (scene.keywords || '');
    return {
      id: scene.id || crypto.randomUUID(),
      file: null,
      preview: scene.image_url || scene.imageUrl || '',
      uploadedUrl: scene.image_url || scene.imageUrl || '',
      label: scene.label || '',
      keywords,
      description: scene.description || '',
      emotionKey: scene.emotion_key || scene.emotionKey || slugify(scene.label || 'scene'),
    };
  });
  renderSceneImageGrid();
}

function hydrateExamplePairs(character) {
  exampleDialogPairs.length = 0;
  const pairs = Array.isArray(character.example_dialog_pairs) ? character.example_dialog_pairs : [];
  if (pairs.length) {
    pairs.forEach((pair) => {
      exampleDialogPairs.push({
        user: pair.user || pair.User || '',
        character: pair.character || pair.char || '',
      });
    });
  }
  renderExamplePairs();
}

function applyCharacterDataToForm(character) {
  const basic = document.getElementById('step-basic');
  if (basic) {
    const basicTextInputs = basic.querySelectorAll('input.field__control[type="text"]');
    if (basicTextInputs[0]) {
      basicTextInputs[0].value = character.name || '';
      basicTextInputs[0].dispatchEvent(new Event('input'));
    }
    if (basicTextInputs[1]) {
      basicTextInputs[1].value = character.one_line || '';
      basicTextInputs[1].dispatchEvent(new Event('input'));
    }
  }
  const introField = document.getElementById('introTextarea');
  if (introField) {
    introField.value = character.intro || '';
    introField.dispatchEvent(new Event('input'));
  }
  const playGuideField = document.getElementById('playGuideTextarea');
  if (playGuideField) playGuideField.value = character.play_guide || '';
  const promptField = document.getElementById('promptTextarea');
  if (promptField) promptField.value = character.prompt || '';
  const descriptionField = document.getElementById('descriptionTextarea');
  if (descriptionField) descriptionField.value = character.description || '';
  const genreSelect = document.getElementById('genreSelect');
  if (genreSelect) genreSelect.value = character.genre || '';
  const targetSelect = document.getElementById('targetSelect');
  if (targetSelect) targetSelect.value = character.target || '';
  currentTagList = sanitizeTags(character.tags || []);
  renderTagChips();
  document.querySelectorAll('input[name="visibility"]').forEach((radio) => {
    radio.checked = radio.value === (character.visibility || 'public');
  });
  const monetizedToggle = document.getElementById('monetizedToggle');
  if (monetizedToggle) {
    monetizedToggle.checked = !!character.is_monetized;
    updatePreviewShareBadge(monetizedToggle.checked);
  }
  const commentToggle = document.getElementById('commentToggle');
  if (commentToggle) commentToggle.checked = character.comment_enabled !== false;
  hydrateImageState(character);
  hydrateSceneState(character);
  hydrateExamplePairs(character);
}

async function loadCharacterForEdit(characterId) {
  if (!window.sb) return;
  try {
    let sessionUser = await getCurrentUser();
    if (!sessionUser && typeof window.requireLogin === 'function') {
      const ok = await window.requireLogin({ redirect: window.location.href });
      if (!ok) return;
      sessionUser = await getCurrentUser();
    }
    const { data, error } = await window.sb
      .from('characters')
      .select(
        'id, owner_id, name, one_line, intro, play_guide, prompt, description, genre, target, tags, visibility, is_monetized, comment_enabled, avatar_url, gallery_image_urls, intro_image_url, thumbnail_image_url, example_dialog, example_dialog_pairs, scene_image_templates, metadata'
      )
      .eq('id', characterId)
      .single();
    if (error) throw error;
    if (data.owner_id && sessionUser && data.owner_id !== sessionUser.id) {
      alert('해당 캐릭터를 수정할 권한이 없습니다.');
      window.location.href = '/works';
      return;
    }
    editingCharacterId = data.id;
    editingCharacterData = data;
    applyCharacterDataToForm(data);
    const headerTitle = document.querySelector('.top-title');
    if (headerTitle) headerTitle.textContent = '캐릭터 수정';
    document.title = `${data.name || '캐릭터'} 수정 | 크라마(crama)`;
  } catch (err) {
    console.error('loadCharacterForEdit failed', err);
    alert('캐릭터 정보를 불러오지 못했습니다.');
  }
}

function handleDeviceImageSelection(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (files.length > 1) {
    alert('한 번에 한 장씩 편집할 수 있어요. 첫 번째 이미지만 불러옵니다.');
  }
  const file = files[0];
  if (!file) return;
  openCropModalFromFile(file);
}

async function addCroppedFileToContext(file) {
  const context = imagePickerState.context === 'scene' ? 'scene' : 'character';
  if (context === 'scene') {
    await addSceneImagesFromFiles([file]);
    return;
  }
  await addImagesFromFiles([file]);
}

function initImagePickerModals() {
  ensureImageSourceModal();
  ensureImageLibraryModal();
  ensureCropModal();
}

function ensureImageSourceModal() {
  if (imagePickerState.sourceModal) return imagePickerState.sourceModal;
  const modal = document.createElement('div');
  modal.id = 'imageSourceModal';
  modal.className = 'image-picker-modal image-picker-modal--hidden';
  modal.innerHTML = `
    <div class="image-picker-modal__panel">
      <button type="button" class="image-picker-modal__close" data-image-picker-close>&times;</button>
      <h3 class="image-picker-modal__title">이미지를 가져오기</h3>
      <div class="image-picker-options">
        <button type="button" class="image-picker-option" data-image-source="device">
          <span>기기에서 가져오기</span>
        </button>
        <button type="button" class="image-picker-option" data-image-source="library">
          <span>라이브러리에서 가져오기</span>
        </button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.hasAttribute('data-image-picker-close')) {
      closeImageSourceModal();
      return;
    }
    const option = event.target.closest('[data-image-source]');
    if (option) {
      handleImageSourceChoice(option.dataset.imageSource);
    }
  });
  document.body.appendChild(modal);
  imagePickerState.sourceModal = modal;
  return modal;
}

function openImageSourceModal(context = 'character') {
  imagePickerState.context = context;
  const modal = ensureImageSourceModal();
  if (imagePickerState.isMobile.matches) {
    modal.classList.add('image-picker-modal--sheet');
  } else {
    modal.classList.remove('image-picker-modal--sheet');
  }
  modal.classList.remove('image-picker-modal--hidden');
}

function closeImageSourceModal() {
  const modal = ensureImageSourceModal();
  modal.classList.add('image-picker-modal--hidden');
}

function handleImageSourceChoice(choice) {
  closeImageSourceModal();
  const context = imagePickerState.context || 'character';
  if (choice === 'device') {
    triggerImagePicker(context);
    return;
  }
  if (choice === 'library') {
    openImageLibraryModal();
  }
}

function ensureImageLibraryModal() {
  if (imagePickerState.libraryModal) return imagePickerState.libraryModal;
  const modal = document.createElement('div');
  modal.id = 'imageLibraryModal';
  modal.className = 'image-picker-modal image-picker-modal--hidden';
  modal.innerHTML = `
    <div class="image-library">
      <div class="image-library__header">
        <h3>라이브러리에서 선택</h3>
        <button type="button" class="image-picker-modal__close" data-image-library-close>&times;</button>
      </div>
      <div class="image-library__body">
        <div class="image-library__status" id="imageLibraryStatus">이미지를 불러오는 중입니다...</div>
        <div class="image-library__grid" id="imageLibraryGrid"></div>
      </div>
    </div>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.hasAttribute('data-image-library-close')) {
      closeImageLibraryModal();
      return;
    }
    const card = event.target.closest('[data-library-url]');
    if (card) {
      const url = card.dataset.libraryUrl;
      const name = card.dataset.libraryName;
      handleLibraryImageSelect(url, name);
    }
  });
  document.body.appendChild(modal);
  imagePickerState.libraryModal = modal;
  return modal;
}

function openImageLibraryModal() {
  const modal = ensureImageLibraryModal();
  if (imagePickerState.isMobile.matches) {
    modal.classList.add('image-picker-modal--sheet');
  } else {
    modal.classList.remove('image-picker-modal--sheet');
  }
  modal.classList.remove('image-picker-modal--hidden');
  if (!imagePickerState.library.loaded && !imagePickerState.library.loading) {
    loadImageLibrary();
  }
}

function closeImageLibraryModal() {
  const modal = ensureImageLibraryModal();
  modal.classList.add('image-picker-modal--hidden');
}

async function loadImageLibrary() {
  imagePickerState.library.loading = true;
  const statusEl = document.getElementById('imageLibraryStatus');
  const gridEl = document.getElementById('imageLibraryGrid');
  if (statusEl) statusEl.textContent = '이미지를 불러오는 중입니다...';
  if (gridEl) gridEl.innerHTML = '';
  try {
    if (!window.sb) throw new Error('Supabase 연결을 확인해 주세요.');
    const session = await window.sb?.auth?.getSession();
    const accessToken = session?.data?.session?.access_token;
    if (!accessToken) throw new Error('로그인이 필요합니다.');
    const response = await apiFetch('/api/user-contents/images?limit=60', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || payload?.message || '이미지를 불러오지 못했습니다.');
    }
    const items = (payload.items || []).map((row) => {
      const sourceUrl = row.full_url || row.thumb_url;
      return {
        id: row.id,
        title:
          row.title ||
          (row.prompt && row.prompt.slice(0, 20) + (row.prompt.length > 20 ? '...' : '')) ||
          '이미지',
        url: sourceUrl,
        thumb: row.thumb_url || sourceUrl,
      };
    }).filter((item) => !!item.url);
    imagePickerState.library.items = items;
    imagePickerState.library.loaded = true;
    renderImageLibrary();
  } catch (err) {
    console.error('loadImageLibrary failed', err);
    if (statusEl) statusEl.textContent = err.message || '이미지를 불러오지 못했습니다.';
  } finally {
    imagePickerState.library.loading = false;
  }
}

function renderImageLibrary() {
  const gridEl = document.getElementById('imageLibraryGrid');
  const statusEl = document.getElementById('imageLibraryStatus');
  if (!gridEl) return;
  gridEl.innerHTML = '';
  if (!imagePickerState.library.items.length) {
    if (statusEl) statusEl.textContent = '저장된 이미지가 없습니다.';
    return;
  }
  if (statusEl) statusEl.textContent = '';
  imagePickerState.library.items.forEach((item) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'image-library-card';
    card.dataset.libraryUrl = item.url;
    card.dataset.libraryName = item.title || 'library-image.png';
    card.innerHTML = `
      <div class="image-library-card__thumb" style="background-image:url('${escapeHtml(item.thumb)}')"></div>
      <div class="image-library-card__title">${escapeHtml(item.title)}</div>
    `;
    gridEl.appendChild(card);
  });
}

async function handleLibraryImageSelect(url, name) {
  if (!url) return;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('이미지를 불러오지 못했습니다.');
    const blob = await response.blob();
    closeImageLibraryModal();
    openCropModalFromBlob(blob, name || 'library-image.png');
  } catch (err) {
    console.error('handleLibraryImageSelect error', err);
    alert(err.message || '이미지를 불러오지 못했습니다.');
  }
}

function ensureCropModal() {
  if (imagePickerState.cropModal) return imagePickerState.cropModal;
  const modal = document.createElement('div');
  modal.id = 'imageCropModal';
  modal.className = 'image-picker-modal image-picker-modal--hidden';
  modal.innerHTML = `
    <div class="image-cropper">
      <div class="image-cropper__header">
        <h3>이미지 조정</h3>
        <button type="button" class="image-picker-modal__close" data-crop-cancel>&times;</button>
      </div>
      <canvas id="imageCropCanvas" width="450" height="600"></canvas>
      <div class="image-cropper__controls">
        <label for="imageCropZoom">확대</label>
        <input type="range" id="imageCropZoom" min="0" max="100" value="0" step="1">
      </div>
      <div class="image-cropper__actions">
        <button type="button" class="btn btn--ghost" data-crop-cancel>취소</button>
        <button type="button" class="btn btn--primary" data-crop-apply>자르기</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.hasAttribute('data-crop-cancel')) {
      closeCropModal();
    }
  });
  const applyBtn = modal.querySelector('[data-crop-apply]');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => handleCropApply());
  }
  const zoomInput = modal.querySelector('#imageCropZoom');
  if (zoomInput) {
    zoomInput.addEventListener('input', (event) => updateCropScale(Number(event.target.value)));
  }
  const canvas = modal.querySelector('#imageCropCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    imagePickerState.crop.canvas = canvas;
    imagePickerState.crop.ctx = ctx;
    bindCropCanvasEvents(canvas);
  }
  document.body.appendChild(modal);
  imagePickerState.cropModal = modal;
  return modal;
}

function openCropModalFromFile(file) {
  const objectUrl = URL.createObjectURL(file);
  openCropModal({
    src: objectUrl,
    name: file.name,
    revoke: true,
  });
}

function openCropModalFromBlob(blob, name = 'library-image.png') {
  const objectUrl = URL.createObjectURL(blob);
  openCropModal({
    src: objectUrl,
    name,
    revoke: true,
  });
}

function openCropModal(options) {
  if (!options?.src) return;
  const modal = ensureCropModal();
  if (imagePickerState.isMobile.matches) {
    modal.classList.add('image-picker-modal--sheet');
  } else {
    modal.classList.remove('image-picker-modal--sheet');
  }
  if (imagePickerState.crop.objectUrl) {
    URL.revokeObjectURL(imagePickerState.crop.objectUrl);
    imagePickerState.crop.objectUrl = null;
  }
  if (options.revoke) {
    imagePickerState.crop.objectUrl = options.src;
  }
  imagePickerState.crop.sourceName = options.name || `character-${Date.now()}.png`;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    imagePickerState.crop.image = img;
    setupCropDefaults();
    renderCropCanvas();
    modal.classList.remove('image-picker-modal--hidden');
  };
  img.onerror = () => {
    alert('이미지를 불러오지 못했습니다.');
    closeCropModal();
  };
  img.src = options.src;
}

function closeCropModal() {
  const modal = ensureCropModal();
  modal.classList.add('image-picker-modal--hidden');
  const cropState = imagePickerState.crop;
  cropState.dragging = false;
  if (cropState.objectUrl) {
    URL.revokeObjectURL(cropState.objectUrl);
    cropState.objectUrl = null;
  }
}

function setupCropDefaults() {
  const cropState = imagePickerState.crop;
  const canvas = cropState.canvas;
  const img = cropState.image;
  if (!canvas || !img) return;
  const cw = canvas.width;
  const ch = canvas.height;
  const scaleX = cw / img.width;
  const scaleY = ch / img.height;
  cropState.minScale = Math.max(scaleX, scaleY);
  cropState.maxScale = cropState.minScale * 3;
  cropState.scale = cropState.minScale;
  const scaledWidth = img.width * cropState.scale;
  const scaledHeight = img.height * cropState.scale;
  cropState.offsetX = (cw - scaledWidth) / 2;
  cropState.offsetY = (ch - scaledHeight) / 2;
  const zoomInput = document.getElementById('imageCropZoom');
  if (zoomInput) zoomInput.value = '0';
}

function renderCropCanvas() {
  const cropState = imagePickerState.crop;
  const canvas = cropState.canvas;
  const ctx = cropState.ctx;
  const img = cropState.image;
  if (!canvas || !ctx || !img) return;
  ctx.save();
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(cropState.offsetX, cropState.offsetY);
  ctx.scale(cropState.scale, cropState.scale);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function clampCropOffsets() {
  const cropState = imagePickerState.crop;
  const canvas = cropState.canvas;
  const img = cropState.image;
  if (!canvas || !img) return;
  const scaledWidth = img.width * cropState.scale;
  const scaledHeight = img.height * cropState.scale;
  const minX = Math.min(0, canvas.width - scaledWidth);
  const minY = Math.min(0, canvas.height - scaledHeight);
  cropState.offsetX = Math.min(0, Math.max(cropState.offsetX, minX));
  cropState.offsetY = Math.min(0, Math.max(cropState.offsetY, minY));
}

function updateCropScale(value) {
  const cropState = imagePickerState.crop;
  const normalized = Number(value || 0) / 100;
  cropState.scale =
    cropState.minScale + normalized * Math.max(0, cropState.maxScale - cropState.minScale);
  clampCropOffsets();
  renderCropCanvas();
}

function bindCropCanvasEvents(canvas) {
  canvas.addEventListener('mousedown', startCropDrag);
  canvas.addEventListener('touchstart', startCropDrag, { passive: false });
  window.addEventListener('mousemove', handleCropDrag);
  window.addEventListener('touchmove', handleCropDrag, { passive: false });
  window.addEventListener('mouseup', endCropDrag);
  window.addEventListener('touchend', endCropDrag);
}

function startCropDrag(event) {
  event.preventDefault();
  const cropState = imagePickerState.crop;
  const point = getEventPoint(event);
  cropState.dragging = true;
  cropState.lastX = point.x;
  cropState.lastY = point.y;
}

function handleCropDrag(event) {
  const cropState = imagePickerState.crop;
  if (!cropState.dragging) return;
  event.preventDefault();
  const point = getEventPoint(event);
  const dx = point.x - cropState.lastX;
  const dy = point.y - cropState.lastY;
  cropState.lastX = point.x;
  cropState.lastY = point.y;
  cropState.offsetX += dx;
  cropState.offsetY += dy;
  clampCropOffsets();
  renderCropCanvas();
}

function endCropDrag() {
  const cropState = imagePickerState.crop;
  cropState.dragging = false;
}

function getEventPoint(event) {
  if (event.touches && event.touches[0]) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function handleCropApply() {
  const cropState = imagePickerState.crop;
  const canvas = cropState.canvas;
  const img = cropState.image;
  if (!canvas || !img) {
    closeCropModal();
    return;
  }
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = 768;
  exportCanvas.height = 1024;
  const ratioX = exportCanvas.width / canvas.width;
  const ratioY = exportCanvas.height / canvas.height;
  const ctx = exportCanvas.getContext('2d');
  ctx.save();
  ctx.fillStyle = '#050608';
  ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
  ctx.translate(cropState.offsetX * ratioX, cropState.offsetY * ratioY);
  ctx.scale(cropState.scale * ratioX, cropState.scale * ratioY);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
  exportCanvas.toBlob(async (blob) => {
    if (!blob) {
      alert('이미지 변환에 실패했습니다.');
      return;
    }
    try {
      const croppedFile = new File(
        [blob],
        cropState.sourceName || `character-${Date.now()}.png`,
        { type: 'image/png' }
      );
      await addCroppedFileToContext(croppedFile);
      closeCropModal();
    } catch (err) {
      console.error('addImagesFromFiles error', err);
      alert('이미지를 추가하지 못했습니다. 다시 시도해 주세요.');
    }
  }, 'image/png', 0.95);
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
            imagePickerState.context = 'character';
            handleDeviceImageSelection(e.target.files);
            imageInputEl.value = '';
        });
    }
    const uploadTrigger = document.getElementById('imageUploadTrigger');
    if (uploadTrigger) {
        uploadTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            openImageSourceModal('character');
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
            imagePickerState.context = 'scene';
            handleDeviceImageSelection(e.target.files);
            sceneImageInput.value = '';
        });
    }
    const sceneImageUploadTrigger = document.getElementById('sceneImageUploadTrigger');
    if (sceneImageUploadTrigger) {
        sceneImageUploadTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            openImageSourceModal('scene');
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

    document.querySelectorAll('[data-save-draft]').forEach((btn) => {
      if (btn.dataset.draftBound) return;
      btn.addEventListener('click', handleSaveDraft);
      btn.dataset.draftBound = '1';
    });

    const params = new URLSearchParams(window.location.search);
    const editId = params.get('id');
    if (editId) {
      loadCharacterForEdit(editId);
    }
    initImagePickerModals();
});

})();
