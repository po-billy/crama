document.addEventListener('DOMContentLoaded', () => {
  const heroBtn = document.getElementById('pricingHeroBuy');
  if (heroBtn && !heroBtn.dataset.bound) {
    heroBtn.dataset.bound = '1';
    heroBtn.addEventListener('click', () => {
      if (typeof window.openCreditUpsell === 'function') {
        window.openCreditUpsell();
      } else {
        window.location.href = '/characters';
      }
    });
  }

  const loadingState = document.getElementById('pricingSubscriptionStatus');
  if (loadingState) {
    const handleLoaded = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      const plans = detail.plans || [];
      const subCount = plans.filter((p) => !(p.features || {}).is_one_time).length;
      loadingState.textContent = subCount
        ? `구독 옵션 ${subCount}개`
        : '구독 옵션을 불러오는 데 실패했습니다.';
    };
    window.addEventListener('creditConfig:loaded', handleLoaded, { once: true });
  }
});
