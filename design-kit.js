(() => {
  const icons = [
    '/design-assets/icon-cube.svg',
    '/design-assets/icon-materials.svg',
    '/design-assets/icon-speed.svg',
    '/design-assets/icon-clients.svg'
  ];

  document.querySelectorAll('.trust-item i').forEach((holder, index) => {
    if (!icons[index]) return;
    holder.innerHTML = `<img src="${icons[index]}" alt="" aria-hidden="true">`;
  });

  const mobileMenu = document.getElementById('mobileMenu');
  if (mobileMenu) {
    mobileMenu.innerHTML = [
      ['#services', 'Услуги'],
      ['#how', 'Как это работает'],
      ['#materials', 'Материалы и цены'],
      ['#portfolio', 'Наши работы'],
      ['#calculator', 'Калькулятор'],
      ['#contacts', 'Контакты'],
      ['#faq', 'Частые вопросы']
    ].map(([href, label]) => `<a href="${href}">${label}</a>`).join('');

    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        document.body.classList.remove('menu-open');
        document.getElementById('mobileMenuButton')?.setAttribute('aria-expanded', 'false');
      });
    });
  }
})();
