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

  const nav = document.querySelector('.top nav');
  const menuButton = document.getElementById('mobileMenuButton');
  if (nav && menuButton && !document.querySelector('.mobile-call-button')) {
    const callButton = document.createElement('a');
    callButton.className = 'mobile-call-button';
    callButton.href = 'tel:+79056884443';
    callButton.setAttribute('aria-label', 'Позвонить в СИТРО: +7 905 688-44-43');
    callButton.title = '+7 905 688-44-43';
    callButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3 10 6 8.5 9.2c1 2.1 2.6 3.7 4.7 4.7l3.2-1.5 2.7 2.8c.5.5.5 1.2.1 1.8l-1.2 1.7c-.4.6-1.1.9-1.8.7C9.7 17.8 6.2 14.3 4.6 8c-.2-.7.1-1.4.7-1.8L7 3Z"/></svg><span>Позвонить</span>';
    nav.insertBefore(callButton, menuButton);
  }

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
