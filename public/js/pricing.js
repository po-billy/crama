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
  const packState = document.getElementById('pricingPackStatus');
  if (loadingState || packState) {
    const handleLoaded = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      const plans = detail.plans || [];
      const subs = plans.filter((p) => !(p.features || {}).is_one_time);
      const packs = plans.filter((p) => (p.features || {}).is_one_time);
      if (loadingState) {
        loadingState.textContent = subs.length
          ? `구독 옵션 ${subs.length}개`
          : 'Scene 구독 옵션 준비 중';
      }
      if (packState) {
        packState.textContent = packs.length
          ? `충전 팩 ${packs.length}개`
          : 'Scene 충전 팩 준비 중';
      }
    };
    window.addEventListener('creditConfig:loaded', handleLoaded, { once: true });
  }
});
