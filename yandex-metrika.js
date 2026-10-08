(function () {
  const counterId = 113542901;

  window.ym = window.ym || function () {
    (window.ym.a = window.ym.a || []).push(arguments);
  };
  window.ym.l = Date.now();

  if (!document.querySelector('script[data-sitro-metrika]')) {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.sitroMetrika = 'true';
    script.src = `https://mc.yandex.ru/metrika/tag.js?id=${counterId}`;
    document.head.appendChild(script);
  }

  window.ym(counterId, 'init', {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true
  });

  window.SitroMetrikaGoal = function (name, parameters) {
    if (!name) return;
    window.ym(counterId, 'reachGoal', name, parameters || {});
  };

  document.addEventListener('click', function (event) {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href') || '';
    let method = '';
    if (href.startsWith('tel:')) method = 'phone';
    else if (href.startsWith('mailto:')) method = 'email';
    else if (href.includes('t.me/')) method = 'telegram';
    else if (href.includes('max.ru/')) method = 'max';
    if (method) window.SitroMetrikaGoal('contact_click', {method: method});
  });
})();
