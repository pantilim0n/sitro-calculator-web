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
})();
