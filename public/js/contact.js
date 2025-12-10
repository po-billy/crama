// public/js/contact.js

document.addEventListener('DOMContentLoaded', () => {

  const form = document.getElementById('contactForm');
  if (!form) return;
  const statusEl = document.getElementById('contactStatus');
  const submitBtn = document.getElementById('contactSubmitBtn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.apiFetch) {
      setStatus('전송 도중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.', true);
      return;
    }

    const formData = new FormData(form);
    const payload = {
      name: formData.get('name')?.toString().trim(),
      email: formData.get('email')?.toString().trim(),
      category: formData.get('category')?.toString() || 'general',
      message: formData.get('message')?.toString().trim(),
      page: window.location.href,
    };

    if (!payload.name || !payload.email || !payload.message) {
      setStatus('필수 항목을 모두 입력해주세요.', true);
      return;
    }

    setLoading(true);
    setStatus('전송 중...', false);

    try {
      const res = await window.apiFetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorData = await safeJson(res);
        throw new Error(errorData?.message || '전송에 실패했습니다.');
      }
      form.reset();
      setStatus('문의가 접수되었습니다. 빠르게 답변드릴게요!', false, true);
    } catch (err) {
      console.error('contact submit failed', err);
      setStatus(err.message || '전송에 실패했습니다. 다시 시도해주세요.', true);
    } finally {
      setLoading(false);
    }
  });

  function setStatus(message, isError = false, success = false) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('error', Boolean(isError));
    statusEl.classList.toggle('success', Boolean(success));
  }

  function setLoading(isLoading) {
    if (submitBtn) submitBtn.disabled = isLoading;
  }

  async function safeJson(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }
});
