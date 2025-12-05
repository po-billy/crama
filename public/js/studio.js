// New studio: character image generation UI
const apiFetch = window.apiFetch || ((...args) => fetch(...args));

document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.studio-tab');
  const tabUnderline = document.querySelector('.studio-tab-underline');
  const promptInput = document.getElementById('promptInput');
  const countBadge = document.getElementById('promptCount');
  const generateBtn = document.getElementById('generateBtn');
  const styleList = document.getElementById('styleList');
  const gallery = document.getElementById('gallery');
  const cautionModal = document.getElementById('cautionModal');
  const cautionClose = document.getElementById('cautionClose');
  const cautionAgree = document.getElementById('cautionAgree');
  const ratioOptions = document.getElementById('ratioOptions');
  const countOptions = document.getElementById('countOptions');
  const directPromptPanel = document.getElementById('directPromptPanel');
  const transformPanel = document.getElementById('transformPanel');
  const baseImageInput = document.getElementById('baseImageInput');
  const maskImageInput = document.getElementById('maskImageInput');
  const baseImagePreview = document.getElementById('baseImagePreview');
  const transformPromptInput = document.getElementById('transformPrompt');
  const helperBtn = document.getElementById('promptHelperBtn');
  let currentMode = 'direct';
  const optionPanel = document.getElementById('optionPanel');
  const mobilePanelToggle = document.getElementById('mobileOptionToggle');
  const mobilePanelOverlay = document.getElementById('mobilePanelOverlay');
  const mobilePanelClose = document.getElementById('mobilePanelClose');

  // Tab underline animation
  const setUnderline = (active) => {
    if (!tabUnderline || !active) return;
    const rect = active.getBoundingClientRect();
    const container = active.parentElement.getBoundingClientRect();
    tabUnderline.style.width = `${rect.width}px`;
    tabUnderline.style.transform = `translateX(${rect.left - container.left}px)`;
  };
  const setGenerateButtonLabel = () => {
    if (!generateBtn) return;
    generateBtn.textContent = currentMode === 'transform' ? '이미지 변형 🪙 190' : '이미지 생성 🪙 190';
  };

  const updateCount = () => {
    const source = currentMode === 'transform' ? transformPromptInput : promptInput;
    if (!countBadge) return;
    if (!source) {
      countBadge.textContent = '0/0';
      return;
    }
    const len = source.value.trim().length;
    const max = Number(source.getAttribute('maxlength')) || source.maxLength || 1000;
    countBadge.textContent = `${len}/${max}`;
  };

  const applyModeUI = () => {
    directPromptPanel?.classList.toggle('hidden', currentMode !== 'direct');
    transformPanel?.classList.toggle('hidden', currentMode !== 'transform');
    if (helperBtn) {
      helperBtn.textContent = currentMode === 'transform' ? '✎ 변형 가이드' : '✎ 프롬프트 헬퍼';
    }
    setGenerateButtonLabel();
    updateCount();
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      currentMode = tab.dataset.mode || 'direct';
      applyModeUI();
      setUnderline(tab);
    });
  });
  const initialTab = document.querySelector('.studio-tab.active');
  currentMode = initialTab?.dataset.mode || 'direct';
  applyModeUI();
  setTimeout(() => setUnderline(initialTab), 0);

  promptInput?.addEventListener('input', updateCount);
  transformPromptInput?.addEventListener('input', updateCount);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  baseImageInput?.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) {
      if (baseImagePreview) {
        baseImagePreview.src = '';
        baseImagePreview.classList.remove('preview-visible');
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (baseImagePreview) {
        baseImagePreview.src = evt.target.result;
        baseImagePreview.classList.add('preview-visible');
      }
    };
    reader.readAsDataURL(file);
  });

  // Style selection
  styleList?.addEventListener('click', (e) => {
    const card = e.target.closest('.style-card');
    if (!card) return;
    styleList.querySelectorAll('.style-card').forEach((c) => c.classList.remove('selected'));
    card.classList.add('selected');
  });

  // Caution modal
  const openCaution = () => cautionModal?.classList.remove('hidden');
  const closeCaution = () => cautionModal?.classList.add('hidden');
  cautionClose?.addEventListener('click', () => {
    localStorage.setItem('studioCautionAccepted', 'true');
    closeCaution();
  });
  cautionAgree?.addEventListener('click', () => {
    localStorage.setItem('studioCautionAccepted', 'true');
    closeCaution();
  });
  cautionModal?.addEventListener('click', (e) => {
    if (e.target === cautionModal) {
      localStorage.setItem('studioCautionAccepted', 'true');
      closeCaution();
    }
  });

  // Mobile option panel toggle
  const openMobilePanel = () => {
    optionPanel?.classList.add('panel-open');
    mobilePanelOverlay?.classList.add('active');
    mobilePanelToggle?.setAttribute('aria-expanded', 'true');
  };
  const closeMobilePanel = () => {
    optionPanel?.classList.remove('panel-open');
    mobilePanelOverlay?.classList.remove('active');
    mobilePanelToggle?.setAttribute('aria-expanded', 'false');
  };
  mobilePanelToggle?.addEventListener('click', () => {
    if (optionPanel?.classList.contains('panel-open')) {
      closeMobilePanel();
    } else {
      openMobilePanel();
    }
  });
  mobilePanelOverlay?.addEventListener('click', closeMobilePanel);
  mobilePanelClose?.addEventListener('click', closeMobilePanel);
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeMobilePanel();
    }
  });

  async function ensureLoggedIn() {
    const { data, error } = await window.sb.auth.getSession();
    if (error || !data.session) {
      window.location.href = '/login';
      return null;
    }
    return data.session;
  }

  function saveLocalHistory(images, meta) {
    try {
      const raw = localStorage.getItem('seobaHistory');
      const history = raw ? JSON.parse(raw) : { images: [], chats: [] };
      const now = new Date().toISOString();
      const newItems = images.map((url, idx) => ({
        id: `${Date.now()}_${idx}`,
        url,
        thumbUrl: url,
        prompt: meta.prompt,
        createdAt: now,
        title:
          (meta.prompt && meta.prompt.slice(0, 20) + (meta.prompt.length > 20 ? '...' : '')) ||
          `이미지 ${idx + 1}`,
      }));
      history.images = [...newItems, ...(history.images || [])].slice(0, 50);
      localStorage.setItem('seobaHistory', JSON.stringify(history));
    } catch (e) {
      console.warn('saveLocalHistory error', e);
    }
  }

  const stylePromptMap = {
    기본: 'anime style, clean cel-shading, expressive eyes, soft lighting',
    모에: 'moe anime style, cute proportions, bright pastel colors, clean lines, soft shading',
    로판: 'romantic fantasy illustration, elegant lighting, ornate details, painterly anime style',
    클래식: 'classic anime style, clean line art, vibrant colors, studio quality',
    모던: 'modern webtoon style, crisp edges, gradient lighting, fashionable outfits',
  };

  async function generateImages() {
    if (!localStorage.getItem('studioCautionAccepted')) {
      openCaution();
      return;
    }

    const session = await ensureLoggedIn();
    if (!session) return;

    const selected = styleList?.querySelector('.style-card.selected');
    const styleName = selected ? selected.dataset.name : '기본';
    const ratio = ratioOptions?.querySelector('.btn-option.active')?.dataset.ratio || '1:1';
    const count = Number(countOptions?.querySelector('.btn-option.active')?.dataset.count || 2);
    const directPrompt = promptInput?.value?.trim() || '';
    const transformPromptText = transformPromptInput?.value?.trim() || '';
    const promptText = currentMode === 'transform' ? transformPromptText : directPrompt;
    if (!promptText) {
      alert(currentMode === 'transform' ? '변경할 내용을 입력해 주세요.' : '생성할 이미지를 설명해 주세요.');
      return;
    }
    const stylePrompt = stylePromptMap[styleName] || stylePromptMap['기본'];
    let baseImageData = null;
    let maskImageData = null;

    if (currentMode === 'transform') {
      if (!baseImageInput?.files?.[0]) {
        alert('기준 이미지를 업로드해 주세요.');
        return;
      }
      baseImageData = await fileToDataUrl(baseImageInput.files[0]);
      if (maskImageInput?.files?.[0]) {
        maskImageData = await fileToDataUrl(maskImageInput.files[0]);
      }
    }

    generateBtn.disabled = true;
    generateBtn.textContent = currentMode === 'transform' ? '변형 중...' : '생성 중...';

    try {
      const payload = {
        prompt: promptText,
        style: styleName,
        stylePrompt,
        ratio,
        count,
        mode: currentMode === 'transform' ? 'transform' : 'direct',
      };
      if (baseImageData) {
        payload.baseImage = baseImageData;
      }
      if (maskImageData) {
        payload.maskImage = maskImageData;
      }

      const res = await apiFetch('/api/generate-images', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      if (res.status === 402) {
        await window.loadCreditUpsellPartial?.();
        window.openCreditUpsell?.();
        return;
      }
      if (!res.ok) {
        const msg = (await res.json().catch(() => ({}))).error || '이미지 생성 오류';
        alert(msg);
        return;
      }

      const data = await res.json();
      const images = (data.images || []).slice(0, count);
      gallery.innerHTML = '';
      images.forEach((src, idx) => {
        const card = document.createElement('div');
        card.className = 'gen-card';
        card.innerHTML = `
          <img src="${src}" alt="generated ${idx + 1}">
          <div class="gen-meta">
            <span class="gen-style">${styleName || '기본'}</span>
            <span class="gen-idx">${ratio}</span>
            <span class="gen-idx">#${idx + 1}</span>
          </div>
        `;
        gallery.appendChild(card);
      });

      saveLocalHistory(images, { prompt: promptText });
      window.updateSidebarUserInfo?.();
    } catch (e) {
      console.error('generate error', e);
      alert('이미지 생성 중 오류가 발생했습니다.');
    } finally {
      generateBtn.disabled = false;
      setGenerateButtonLabel();
    }
  }

  generateBtn?.addEventListener('click', generateImages);

  // 옵션 선택 토글
  const toggleGroup = (root) => {
    if (!root) return;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-option');
      if (!btn) return;
      root.querySelectorAll('.btn-option').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
    });
  };
  toggleGroup(ratioOptions);
  toggleGroup(countOptions);
  if (!localStorage.getItem('studioCautionAccepted')) {
    openCaution();
  }
});
